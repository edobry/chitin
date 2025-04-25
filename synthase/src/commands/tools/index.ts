/**
 * Tools command for managing and displaying tool configurations
 */
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { UserConfig } from '../../types/config';
import { Module } from '../../types/module';
import { ToolConfig } from '../../types/config';
import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';

// Import shared utilities
import { debug, error, info, setLogLevel, LogLevel } from '../../utils/logger';
import { setupProcessCleanup } from '../../utils/process';
import { shellPool } from '../../utils/shell-pool';
import { ToolStatus, ToolStatusResult } from '../../utils/tools';

// Import domain-specific utilities
import { loadParentConfig, extractAllTools } from './discovery';
import { filterTools, ToolFilterOptions } from './filter';
import { 
  displaySingleTool,
  displayTools,
  displayToolsAsJson,
  displayToolsAsYaml,
  displayToolsLegend,
  ToolDisplayOptions
} from './display';
import {
  checkToolStatuses,
  createConsoleProgressHandler,
  clearProgressLine,
  ToolStatusCheckOptions
} from './status';

// Import shared constants
import {
  DEFAULT_TOOL_CONCURRENCY,
  DEFAULT_TOOL_TIMEOUT
} from './constants';

import { getToolConfig } from '../../utils/tools';
import { checkToolStatus } from '../../utils/tools';

/**
 * Creates a tools command
 * @returns Configured Command object
 */
export function createToolsCommand(): Command {
  const cmd = new Command('tools')
    .description('Manage and display tool configurations')
    .addCommand(
      new Command('get')
        .description('Get information about configured tools')
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
        .option('--concurrency <number>', `Number of tools to check in parallel`, String(DEFAULT_TOOL_CONCURRENCY))
        .option('--no-cache', 'Disable status check caching')
        .option('--cache-max-age <milliseconds>', 'Maximum age for cached status results in milliseconds')
        .option('--skip-tools <toolIds>', 'Comma-separated list of tool IDs to skip checking')
        .option('--debug', 'Show debug timing information')
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
  
  // Display help when no subcommand is specified
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
  // Use a standard timeout for all tools to prevent hanging
  return DEFAULT_TOOL_TIMEOUT;
}

/**
 * Check tool statuses with progress reporting
 * @param tools Tools to check status for
 * @param options Status checking options
 * @returns Status check results
 */
async function checkToolStatusesWithProgress(
  tools: Map<string, { config: ToolConfig; source: string }>,
  options: {
    concurrency?: number;
    quiet?: boolean;
    debug?: boolean;
  } = {}
): Promise<{ results: Map<string, ToolStatusResult>; duration: number }> {
  const { concurrency = DEFAULT_TOOL_CONCURRENCY, quiet = false, debug: showDebug = false } = options;
  
  if (tools.size === 0) {
    return { results: new Map(), duration: 0 };
  }
  
  if (!quiet) {
    console.log("Checking tool status...");
  }
  
  // Create progress handler that updates the console
  const progressHandler = createConsoleProgressHandler();
  
  // Track timings for debugging
  const timings: Record<string, number> = {
    start: performance.now(),
    brewInit: 0,
    cacheRead: 0,
    checking: 0,
    cacheWrite: 0,
    total: 0
  };
  
  // Adding a pre-check hook to track brew init time
  const timeTrackingOptions = {
    onPreBrew: (time: number) => { timings.brewInit = time; },
    onCacheRead: (time: number) => { timings.cacheRead = time; },
    onCacheWrite: (time: number) => { timings.cacheWrite = time; }
  };
  
  // Check all tools with the status module
  const startTime = performance.now();
  const statusResults = await checkToolStatuses(tools, {
    concurrency, 
    timeout: getToolTimeout(),
    onProgress: quiet ? undefined : progressHandler,
    ...timeTrackingOptions
  });
  const endTime = performance.now();
  const duration = endTime - startTime;
  timings.checking = duration - (timings.brewInit + timings.cacheRead + timings.cacheWrite);
  timings.total = duration;
  
  // Clear the progress line and log completion
  if (!quiet) {
    clearProgressLine();
    debug(`Completed all tool status checks in ${(duration / 1000).toFixed(2)} seconds`);
    
    // Show debug timing information if requested
    if (showDebug) {
      console.error("\nTiming breakdown:");
      console.error(`Homebrew initialization: ${(timings.brewInit / 1000).toFixed(2)}s (${Math.round(timings.brewInit / timings.total * 100)}%)`);
      console.error(`Cache reading: ${(timings.cacheRead / 1000).toFixed(2)}s (${Math.round(timings.cacheRead / timings.total * 100)}%)`);
      console.error(`Tool checking: ${(timings.checking / 1000).toFixed(2)}s (${Math.round(timings.checking / timings.total * 100)}%)`);
      console.error(`Cache writing: ${(timings.cacheWrite / 1000).toFixed(2)}s (${Math.round(timings.cacheWrite / timings.total * 100)}%)`);
      console.error(`Total: ${(timings.total / 1000).toFixed(2)}s (100%)`);
    }
  }
  
  return { results: statusResults, duration };
}

/**
 * Handle the tools command
 * @param toolNames Optional tool name(s) to display
 * @param options Command options
 */
async function handleToolsCommand(toolNames: string[] | undefined, options: any): Promise<void> {
  await withToolSetup(async ({ tools, filteredTools, options }) => {
    // Parse concurrency option
    const concurrency = parseInt(options.concurrency, 10) || 10;
    const debug = options.debug || false;
    
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

      // If status checking was requested, perform it before any output
      let statusResults: Map<string, ToolStatusResult> | undefined;
      let duration: number | undefined;
      if (options.status) {
        const result = await checkToolStatusesWithProgress(toolsToDisplay, {
          concurrency,
          quiet: true, // Stay quiet for JSON output
          debug
        });
        statusResults = result.results;
        duration = result.duration;
      }

      // Handle JSON/YAML output after status check
      if (options.json) {
        displayToolsAsJson(toolsToDisplay, statusResults, { missing: options.missing });
        return;
      }

      if (options.yaml) {
        displayToolsAsYaml(toolsToDisplay, statusResults, { missing: options.missing });
        return;
      }
      
      // Prepare display options for normal output
      const displayOptions: ToolDisplayOptions = {
        detailed: options.detailed,
        status: options.status,
        missing: options.missing,
        filterSource: options.filterSource,
        filterCheck: options.filterCheck,
        filterInstall: options.filterInstall,
        skipStatusWarning: true, // Skip warning since we're explicitly requesting these tools
        statusResults,
        wallClockDuration: duration
      };
      
      // Display the tools with any status results
      await displayTools(toolsToDisplay, displayOptions);
      
      return;
    }
    
    // Check if any tools were found
    if (filteredTools.size === 0) {
      console.log('No tools found matching the criteria.');
      return;
    }

    // If status checking was requested, perform it before any output
    let statusResults: Map<string, ToolStatusResult> | undefined;
    let duration: number | undefined;
    if (options.status) {
      const result = await checkToolStatusesWithProgress(filteredTools, { 
        concurrency,
        quiet: options.json || options.yaml, // Stay quiet for JSON/YAML output
        debug
      });
      statusResults = result.results;
      duration = result.duration;
    }

    // Handle JSON/YAML output after status check
    if (options.json) {
      displayToolsAsJson(filteredTools, statusResults, { missing: options.missing });
      return;
    }

    if (options.yaml) {
      displayToolsAsYaml(filteredTools, statusResults, { missing: options.missing });
      return;
    }
    
    // Prepare display options for normal output
    const displayOptions: ToolDisplayOptions = {
      detailed: options.detailed,
      status: options.status,
      missing: options.missing,
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall,
      skipStatusWarning: options.yes,
      statusResults,
      wallClockDuration: duration
    };
    
    // Display tools with the collected display options
    await displayTools(filteredTools, displayOptions);
  }, options);
} 
