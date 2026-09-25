/**
 * Command handlers for tools commands
 */
import { performance } from 'node:perf_hooks';
import { createInterface } from 'node:readline';
import { ToolConfig } from '../../types/config';
import { ToolStatusResult, ToolStatus } from '../../utils/tools';
import { ToolDisplayOptions } from './display';
import { debug } from '../../utils/logger';
import { 
  displayTools, 
  displayToolsAsJson, 
  displayToolsAsYaml
} from './display';
import {
  checkToolStatuses,
  createConsoleProgressHandler,
  clearProgressLine
} from './status';
import {
  DEFAULT_TOOL_CONCURRENCY,
  DEFAULT_TOOL_TIMEOUT
} from './constants';
import { withToolSetup, ToolSetupContext } from './helpers';

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
export async function checkToolStatusesWithProgress(
  tools: Map<string, { config: ToolConfig; source: string }>,
  options: {
    concurrency?: number;
    quiet?: boolean;
    debug?: boolean;
    timeout?: number;
  } = {}
): Promise<{ results: Map<string, ToolStatusResult>; duration: number }> {
  const { concurrency = DEFAULT_TOOL_CONCURRENCY, quiet = false, debug: showDebug = false, timeout } = options;
  
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
    timeout: timeout || getToolTimeout(),
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
export async function handleToolsCommand(toolNames: string[] | undefined, options: any): Promise<void> {
  await withToolSetup(async ({ tools, filteredTools }: ToolSetupContext) => {
    // Parse concurrency option
    const concurrency = parseInt(options.concurrency, 10) || 10;
    const debug = options.debug || false;
    const timeout = options.timeout ? parseInt(options.timeout, 10) : undefined;
    
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
          debug,
          timeout
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
    } else {
      if (filteredTools.size === 0) {
        console.log('No tools found matching the criteria.');
        return;
      }

      // --missing needs status information, so it implies --status
      if (options.missing && !options.status) {
        options.status = true;
      }

      let statusResults: Map<string, ToolStatusResult> | undefined;
      let duration: number | undefined;
      let toolsToShow = filteredTools;

      if (options.status) {
        // Confirm if checking many tools without -y option
        if (filteredTools.size > 10 && !options.yes && !options.json && !options.yaml) {
          console.log(`⚠️ Checking status for ${filteredTools.size} tools may take a while.`);
          console.log(`Use -y or --yes to skip this confirmation next time.`);
          
          const readline = createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          try {
            const answer = await new Promise<string>((resolve) => {
              readline.question('Continue? [Y/n] ', resolve);
            });
            
            if (answer && answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
              console.log('Operation canceled.');
              return;
            }
          } finally {
            // Always close the readline interface
            readline.close();
          }
        }
        
        // Check statuses for all filtered tools
        const result = await checkToolStatusesWithProgress(filteredTools, {
          concurrency,
          quiet: options.json || options.yaml, // Stay quiet for JSON output
          debug,
          timeout
        });
        statusResults = result.results;
        duration = result.duration;
        
        // If only missing tools are requested, filter the results
        if (options.missing) {
          const missingTools = new Map();
          
          for (const [toolId, status] of statusResults.entries()) {
            if (status && status.status === ToolStatus.NOT_INSTALLED) {
              missingTools.set(toolId, filteredTools.get(toolId));
            }
          }
          
          if (options.json) {
            displayToolsAsJson(missingTools, statusResults, { missing: true });
            return;
          }
          
          if (options.yaml) {
            displayToolsAsYaml(missingTools, statusResults, { missing: true });
            return;
          }
          
          if (missingTools.size === 0) {
            console.log('All tools are installed!');
            return;
          }
          
          // Only the missing tools are shown from here on
          toolsToShow = missingTools;
        }
      }
      
      if (options.json) {
        displayToolsAsJson(toolsToShow, statusResults, { missing: options.missing });
        return;
      }
      
      if (options.yaml) {
        displayToolsAsYaml(toolsToShow, statusResults, { missing: options.missing });
        return;
      }
      
      // Display the tools with any status results
      const displayOptions: ToolDisplayOptions = {
        detailed: options.detailed,
        status: options.status,
        missing: options.missing,
        filterSource: options.filterSource,
        filterCheck: options.filterCheck,
        filterInstall: options.filterInstall,
        skipStatusWarning: true, // the confirmation prompt above is the one warning; the display-layer warning would repeat it
        statusResults,
        wallClockDuration: duration
      };
      
      await displayTools(toolsToShow, displayOptions);
    }
  }, options);
}

/**
 * Handle the list command
 * @param options Command options
 */
export async function handleListCommand(options: any): Promise<void> {
  await withToolSetup(async ({ filteredTools }: ToolSetupContext) => {
    // Output tool names one per line for scripting use
    for (const toolId of filteredTools.keys()) {
      console.log(toolId);
    }
  }, options);
} 
