/**
 * Tools command for managing and displaying tool configurations
 */
import { Command } from 'commander';
import { loadAndValidateConfig } from '../utils';
import { UserConfig, Module } from '../../types';
import { discoverModulesFromConfig } from '../../modules/discovery';

// Import shared utilities
import { debug, error, info, setLogLevel, LogLevel } from '../../utils/logger';
import { setupProcessCleanup } from '../../utils/process';
import { shellPool } from '../../utils/shell-pool';
import { initBrewEnvironment, initializeBrewCaches } from '../../utils/homebrew';
import { ToolStatus, ToolStatusResult, checkToolStatus } from '../../utils/tools';

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
import {
  normalizeBrewConfig,
  getBrewDisplayString,
  getToolBrewPackageName,
  isToolBrewCask
} from './homebrew';

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
  
  // Make 'get' the default subcommand when none is specified
  cmd.action((options) => {
    handleToolsCommand([], options);
  });
  
  // Set up process cleanup
  setupProcessCleanup();
  
  return cmd;
}

/**
 * Handle the list command
 * @param options Command options
 */
async function handleListCommand(options: any): Promise<void> {
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
    
    // Output tool names one per line for scripting use
    for (const toolId of filteredTools.keys()) {
      console.log(toolId);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Get timeout for tool status checks
 * @returns Timeout in milliseconds
 */
function getToolTimeout(): number {
  // Use a longer default timeout for all tools to prevent timeouts
  return 15000; // 15 seconds timeout for all tools
}

/**
 * Handle the tools command
 * @param toolNames Optional tool name(s) to display
 * @param options Command options
 */
async function handleToolsCommand(toolNames: string[] | undefined, options: any): Promise<void> {
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
        const statusResults = new Map<string, ToolStatusResult>();
        
        // Check status for all requested tools
        for (const [toolId, toolData] of toolsToDisplay.entries()) {
          debug(`Checking status of ${toolId}`);
          // Use appropriate timeout for the tool
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
    
    // Apply filters to all tools
    const filteredTools = filterTools(tools, {
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });
    
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
        const statusResults = new Map<string, ToolStatusResult>();
        
        // Initialize Homebrew environment if needed
        const hasBrewTools = Array.from(filteredTools.values()).some(
          tool => tool.config.brew || tool.config.checkBrew
        );
        
        if (hasBrewTools) {
          debug('Initializing Homebrew environment for status checks');
          await initBrewEnvironment();
          await initializeBrewCaches();
        }
        
        // Check each tool with appropriate timeout
        for (const [toolId, { config }] of filteredTools.entries()) {
          const timeout = getToolTimeout();
          statusResults.set(toolId, await checkToolStatus(toolId, config, timeout));
        }
        
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
        const statusResults = new Map<string, ToolStatusResult>();
        
        // Initialize Homebrew environment if needed
        const hasBrewTools = Array.from(filteredTools.values()).some(
          tool => tool.config.brew || tool.config.checkBrew
        );
        
        if (hasBrewTools) {
          debug('Initializing Homebrew environment for status checks');
          await initBrewEnvironment();
          await initializeBrewCaches();
        }
        
        // Check each tool with appropriate timeout
        for (const [toolId, { config }] of filteredTools.entries()) {
          const timeout = getToolTimeout();
          statusResults.set(toolId, await checkToolStatus(toolId, config, timeout));
        }
        
        displayToolsAsYaml(filteredTools, statusResults, { missing: options.missing });
      } else {
        displayToolsAsYaml(filteredTools, new Map(), { missing: false });
      }
      
      return;
    }
    
    // Default display - set up status checks if needed
    if (options.status) {
      options.statusResults = new Map<string, ToolStatusResult>();
      
      // Initialize Homebrew environment if needed
      const hasBrewTools = Array.from(filteredTools.values()).some(
        tool => tool.config.brew || tool.config.checkBrew
      );
      
      if (hasBrewTools) {
        debug('Initializing Homebrew environment for status checks');
        await initBrewEnvironment();
        await initializeBrewCaches();
      }
      
      // Check each tool with appropriate timeout
      for (const [toolId, { config }] of filteredTools.entries()) {
        const timeout = getToolTimeout();
        options.statusResults.set(toolId, await checkToolStatus(toolId, config, timeout));
      }
    }
    
    // Display tools
    await displayTools(filteredTools, displayOptions);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    // Make sure to clean up the shell pool
    try {
      await shellPool.shutdown();
    } catch (err) {
      debug(`Error shutting down shell pool: ${err}`);
    }
  }
} 
