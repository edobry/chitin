/**
 * Tools command for managing and displaying tool configurations
 */
import { Command } from 'commander';
import { loadAndValidateConfig } from '../utils';
import { UserConfig, Module } from '../../types';
import { ToolConfig } from '../../types';
import { discoverModulesFromConfig } from '../../modules/discovery';

// Import shared utilities
import { debug, error, info, setLogLevel, LogLevel } from '../../utils/logger';
import { setupProcessCleanup } from '../../utils/process';
import { shellPool } from '../../utils/shell-pool';
import { 
  initBrewEnvironment, 
  initializeBrewCaches,
  normalizeBrewConfig,
  getBrewDisplayString,
  getToolBrewPackageName,
  isToolBrewCask
} from '../../utils/homebrew';
import { 
  ToolStatus, 
  ToolStatusResult, 
  checkToolStatus, 
  batchCheckToolStatus 
} from '../../utils/tools';

// Import domain-specific utilities
import { loadParentConfig, extractAllTools } from './discovery';
import { filterTools, ToolFilterOptions } from './filter';
import { 
  displaySingleTool, 
  displayTools, 
  displayToolsAsJson, 
  displayToolsAsYaml,
  ToolDisplayOptions
} from './ui';

/**
 * Creates a tools command
 * @returns Configured Command object
 */
export function createToolsCommand(): Command {
  const cmd = new Command('tools')
    .description('Manage and display tool configurations')
    .addCommand(
      new Command('get')
        .description('Get detailed information about configured tools')
        .argument('[toolNames...]', 'Optional tool name(s) to display')
        .option('-d, --detailed', 'Show detailed tool configuration')
        .option('--status', 'Check if tools are installed')
        .option('--missing', 'Only show tools that are not installed')
        .option('--filter-source <source>', 'Filter tools by source')
        .option('--filter-check <method>', 'Filter tools by check method')
        .option('--filter-install <method>', 'Filter tools by install method')
        .option('-y, --yes', 'Skip confirmation when checking many tools')
        .option('--json', 'Output in JSON format')
        .option('--yaml', 'Output in YAML format')
        .option('--concurrency <number>', 'Number of tools to check in parallel', '5')
        .option('--queue', 'Use queue-based implementation instead of chunk-based (may be more efficient)')
        .action(handleToolsCommand)
    )
    .addCommand(
      new Command('list')
        .description('List tool names for scripts')
        .option('--filter-source <source>', 'Filter tools by source')
        .option('--filter-check <method>', 'Filter tools by check method')
        .option('--filter-install <method>', 'Filter tools by install method')
        .action(handleListCommand)
    );
  
  // Display help when no subcommand is specified instead of defaulting to 'get'
  cmd.action(() => {
    cmd.help();
  });
  
  // Set up process cleanup
  setupProcessCleanup();
  
  return cmd;
}

/**
 * Shared helper function for tool commands to handle common setup and cleanup tasks
 * @param callback Function that will be called with the tools and other context
 * @param options Command options
 */
async function withToolSetup<T>(
  callback: (context: { 
    tools: Map<string, { config: ToolConfig, source: string }>,
    filteredTools: Map<string, { config: ToolConfig, source: string }>,
    modules: Module[],
    options: any
  }) => Promise<T>,
  options: any
): Promise<T> {
  try {
    if (process.env.DEBUG === 'true') {
      setLogLevel(LogLevel.DEBUG);
    }
    
    // Initialize the shell pool early
    await shellPool.initialize();
    
    // Load configuration and validate
    const { config } = await loadAndValidateConfig();
    
    debug('Discovering modules');
    
    // Discover modules
    const discoveryResult = await discoverModulesFromConfig(config);
    const modules: Module[] = discoveryResult.modules || [];
    
    debug(`Found ${modules.length} modules`);
    
    // Initialize the parent project configuration
    // Always try to find the parent first
    let parentConfig = loadParentConfig(process.cwd());
    
    // Extract tools from all sources
    const tools = extractAllTools(config, modules);
    
    // Apply filters
    const filteredTools = filterTools(tools, {
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });
    
    // Call the specific handler with the prepared context
    return await callback({ tools, filteredTools, modules, options });
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    throw new Error('This code is unreachable due to process.exit(1)');
  } finally {
    // Make sure to clean up the shell pool
    try {
      await shellPool.shutdown();
    } catch (err) {
      debug(`Error shutting down shell pool: ${err}`);
    }
  }
}

/**
 * Handle the list command
 * @param options Command options
 */
async function handleListCommand(options: any): Promise<void> {
  await withToolSetup(async ({ filteredTools }) => {
    // Output tool names one per line for scripting use
    for (const toolId of filteredTools.keys()) {
      console.log(toolId);
    }
  }, options);
}

/**
 * Get timeout for tool status checks
 * @returns Timeout in milliseconds
 */
function getToolTimeout(): number {
  // Use a reasonable timeout for all tools to prevent hanging
  return 5000; // 5 seconds timeout for all tools
}

/**
 * Check status of multiple tools in parallel with concurrency control - chunk-based approach
 * Tools are processed in fixed-size batches
 * @param tools Tools to check
 * @param concurrency Maximum number of concurrent checks
 * @returns Map of tool status results
 */
async function checkToolsStatusInParallel(
  tools: Map<string, { config: ToolConfig; source: string }>,
  concurrency: number
): Promise<Map<string, ToolStatusResult>> {
  const results = new Map<string, ToolStatusResult>();
  const toolEntries = Array.from(tools.entries());
  const total = toolEntries.length;
  let completed = 0;
  
  // Process tools in chunks based on concurrency
  for (let i = 0; i < toolEntries.length; i += concurrency) {
    const chunk = toolEntries.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async ([toolId, { config }]) => {
      const timeout = getToolTimeout();
      try {
        const result = await checkToolStatus(toolId, config, timeout);
        completed++;
        // Update progress
        process.stdout.write(`\r\x1b[KChecking tools: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
        return { toolId, result };
      } catch (err) {
        completed++;
        process.stdout.write(`\r\x1b[KChecking tools: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
        return { 
          toolId, 
          result: { 
            status: ToolStatus.NOT_INSTALLED, 
            method: 'unknown', 
            error: err instanceof Error ? err : new Error(String(err)) 
          } 
        };
      }
    });
    
    // Wait for all tools in this chunk to complete
    const chunkResults = await Promise.all(chunkPromises);
    
    // Store results
    for (const { toolId, result } of chunkResults) {
      results.set(toolId, result);
    }
  }
  
  // Clear the progress line
  process.stdout.write('\r\x1b[K');
  return results;
}

/**
 * Check tool status using the queue-based approach from batchCheckToolStatus
 * This wraps the existing implementation with a progress indicator
 * @param tools Tools to check 
 * @param concurrency Maximum concurrent checks
 * @returns Map of tool status results
 */
async function checkToolsStatusWithQueue(
  tools: Map<string, { config: ToolConfig; source: string }>,
  concurrency: number
): Promise<Map<string, ToolStatusResult>> {
  // Convert the Map to format expected by batchCheckToolStatus
  const toolConfigs = new Map<string, ToolConfig>();
  for (const [toolId, { config }] of tools.entries()) {
    toolConfigs.set(toolId, config);
  }
  
  // Create a progress tracker
  const total = toolConfigs.size;
  let completed = 0;
  
  const onProgress = (checked: number, total: number) => {
    completed = checked;
    process.stdout.write(`\r\x1b[KChecking tools: ${checked}/${total} (${Math.round(checked/total*100)}%)`);
  };
  
  // Use the existing batch checker with our progress callback
  const results = await batchCheckToolStatus(toolConfigs, {
    timeout: getToolTimeout(),
    concurrency,
    onProgress
  });
  
  // Clear the progress line
  process.stdout.write('\r\x1b[K');
  return results;
}

/**
 * Handle the tools command
 * @param toolNames Optional tool name(s) to display
 * @param options Command options
 */
async function handleToolsCommand(toolNames: string[] | undefined, options: any): Promise<void> {
  await withToolSetup(async ({ tools, filteredTools, options }) => {
    // Parse concurrency option
    const concurrency = parseInt(options.concurrency, 10) || 5;
    // Determine which implementation to use
    const useQueueApproach = options.queue === true;
    
    if (useQueueApproach) {
      debug('Using queue-based parallel processing');
    } else {
      debug('Using chunk-based parallel processing');
    }
    
    // If specific tools are requested
    if (toolNames && toolNames.length > 0) {
      const toolsToDisplay = new Map();
      const notFoundTools: string[] = [];
      
      // Check each tool name
      for (const name of toolNames) {
        if (tools.has(name)) {
          toolsToDisplay.set(name, tools.get(name));
        } else {
          notFoundTools.push(name);
        }
      }
      
      // Report any tools that weren't found
      if (notFoundTools.length > 0) {
        console.error(`Tool${notFoundTools.length > 1 ? 's' : ''} not found: ${notFoundTools.join(', ')}`);
        if (toolsToDisplay.size === 0) {
          process.exit(1);
        }
      }
      
      // If all tools should be checked for status together
      if (options.status) {
        // Initialize Homebrew environment if needed
        const hasBrewTools = Array.from(toolsToDisplay.values()).some(
          tool => tool.config.brew || tool.config.checkBrew
        );
        
        if (hasBrewTools) {
          debug('Initializing Homebrew environment for status checks');
          await initBrewEnvironment();
          await initializeBrewCaches();
        }
        
        // Handle status checking based on selected approach
        let statusResults;
        
        if (toolsToDisplay.size > 1) {
          // Use selected parallel approach for multiple tools
          statusResults = useQueueApproach
            ? await checkToolsStatusWithQueue(toolsToDisplay, concurrency)
            : await checkToolsStatusInParallel(toolsToDisplay, concurrency);
        } else {
          // For a single tool, just check directly
          statusResults = new Map<string, ToolStatusResult>();
          const [toolId, toolData] = Array.from(toolsToDisplay.entries())[0];
          debug(`Checking status of ${toolId}`);
          const timeout = getToolTimeout();
          statusResults.set(toolId, await checkToolStatus(toolId, toolData.config, timeout));
        }
        
        // Display all tools with their status
        await displayTools(toolsToDisplay, {
          detailed: options.detailed,
          status: options.status,
          missing: options.missing,
          statusResults,
          filterSource: options.filterSource,
          filterCheck: options.filterCheck,
          filterInstall: options.filterInstall,
          skipStatusWarning: true // Skip warning since we're explicitly requesting these tools
        });
      } else {
        // Display tools without status
        await displayTools(toolsToDisplay, {
          detailed: options.detailed,
          status: false,
          missing: options.missing,
          filterSource: options.filterSource,
          filterCheck: options.filterCheck,
          filterInstall: options.filterInstall,
          skipStatusWarning: true
        });
      }
      
      return;
    }
    
    // Check if any tools were found
    if (filteredTools.size === 0) {
      console.log('No tools found matching the criteria.');
      return;
    }
    
    // Prepare display options
    const displayOptions: ToolDisplayOptions = {
      detailed: options.detailed,
      status: options.status,
      missing: options.missing,
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall,
      skipStatusWarning: options.yes
    };
    
    // If JSON output is requested
    if (options.json) {
      // If we need status information, get it first
      if (options.status) {
        // Initialize Homebrew environment if needed
        const hasBrewTools = Array.from(filteredTools.values()).some(
          tool => tool.config.brew || tool.config.checkBrew
        );
        
        if (hasBrewTools) {
          debug('Initializing Homebrew environment for status checks');
          await initBrewEnvironment();
          await initializeBrewCaches();
        }
        
        const statusResults = useQueueApproach
          ? await checkToolsStatusWithQueue(filteredTools, concurrency)
          : await checkToolsStatusInParallel(filteredTools, concurrency);
        
        displayToolsAsJson(filteredTools, statusResults, { missing: options.missing });
      } else {
        // No status information
        displayToolsAsJson(filteredTools, new Map(), { missing: false });
      }
      
      return;
    }
    
    // If YAML output is requested
    if (options.yaml) {
      // If we need status information, get it first
      if (options.status) {
        // Initialize Homebrew environment if needed
        const hasBrewTools = Array.from(filteredTools.values()).some(
          tool => tool.config.brew || tool.config.checkBrew
        );
        
        if (hasBrewTools) {
          debug('Initializing Homebrew environment for status checks');
          await initBrewEnvironment();
          await initializeBrewCaches();
        }
        
        const statusResults = useQueueApproach
          ? await checkToolsStatusWithQueue(filteredTools, concurrency)
          : await checkToolsStatusInParallel(filteredTools, concurrency);
        
        displayToolsAsYaml(filteredTools, statusResults, { missing: options.missing });
      } else {
        displayToolsAsYaml(filteredTools, new Map(), { missing: false });
      }
      
      return;
    }
    
    // Default display - set up status checks if needed
    if (options.status) {
      // Show initial progress message
      console.log("Checking tool status...");
      
      // Initialize Homebrew environment if needed
      const hasBrewTools = Array.from(filteredTools.values()).some(
        tool => tool.config.brew || tool.config.checkBrew
      );
      
      if (hasBrewTools) {
        debug('Initializing Homebrew environment for status checks');
        await initBrewEnvironment();
        await initializeBrewCaches();
      }
      
      // Check all tools in parallel using selected approach
      const startTime = performance.now();
      
      options.statusResults = useQueueApproach
        ? await checkToolsStatusWithQueue(filteredTools, concurrency)
        : await checkToolsStatusInParallel(filteredTools, concurrency);
      
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      debug(`Completed all tool status checks in ${duration} seconds using ${useQueueApproach ? 'queue-based' : 'chunk-based'} approach`);
    }
    
    // Display tools
    await displayTools(filteredTools, displayOptions);
  }, options);
} 
