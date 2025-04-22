/**
 * UI utilities for tools command displays
 */
import { ToolConfig } from '../../types';
import { ToolStatus, ToolStatusResult, checkToolStatus } from '../../utils/tools';
import { displayCheckMethod, displayInstallMethod, displayAdditionalInfo, displayToolStatus, formatConfigValue } from '../../utils/ui';
import { debug, info, warn } from '../../utils/logger';
import { initBrewEnvironment, initializeBrewCaches } from '../../utils/homebrew';
import { getBrewDisplayString } from './homebrew';

/**
 * Display information about a single tool
 * @param toolId Tool identifier
 * @param toolData Tool data
 * @param options Display options
 */
export async function displaySingleTool(
  toolId: string,
  toolData: { config: ToolConfig, source: string },
  options: { detailed?: boolean, status?: boolean, statusResult?: ToolStatusResult }
): Promise<void> {
  const { config, source } = toolData;
  
  // Tool header with tool identifier  
  console.log(`${toolId} (Source: ${source})`);
  
  // Display check method
  displayCheckMethod(toolId, config);
  
  // Display installation method if available
  displayInstallMethod(config);
  
  // Display additional info
  displayAdditionalInfo(config);
  
  // Show detailed configuration if requested
  if (options.detailed) {
    console.log(`  Full Configuration: ${formatConfigValue(config)}`);
  }
  
  // Show status information if requested or provided
  if (options.status || options.statusResult) {
    const statusResult = options.statusResult || 
                        await checkToolStatus(toolId, config);
    displayToolStatus(statusResult);
  }
  
  console.log(); // Empty line for spacing
}

/**
 * Display options for tool displays
 */
export interface ToolDisplayOptions {
  detailed?: boolean;
  status?: boolean;
  missing?: boolean;
  statusResults?: Map<string, ToolStatusResult>;
  filterSource?: string;
  filterCheck?: string;
  filterInstall?: string;
  skipStatusWarning?: boolean;
}

/**
 * Display information about multiple tools
 * @param tools Tools map
 * @param options Display options
 */
export async function displayTools(
  tools: Map<string, { config: ToolConfig, source: string }>,
  options: ToolDisplayOptions
): Promise<void> {
  if (tools.size === 0) {
    console.log('No tools found matching the criteria.');
    return;
  }
  
  // Check if we need to show a warning about checking many tools
  if (options.status && !options.skipStatusWarning && tools.size > 10) {
    const filtered = options.filterSource || options.filterCheck || options.filterInstall;
    
    if (!filtered) {
      warn(`You're about to check the status of ${tools.size} tools, which may take some time.`);
      warn('Consider using filters (--filter-source, --filter-check, --filter-install) to narrow down the list.');
      warn('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      // Show a different message if filters are already applied
      info(`Checking status of ${tools.size} tools (filtered)...`);
    }
  }
  
  // If we need to check the status of all tools
  if (options.status && !options.statusResults) {
    const statusResults = new Map<string, ToolStatusResult>();
    let processedCount = 0;
    
    // Initialize Homebrew environment if needed
    if (tools.size > 0) {
      const hasBrewTools = Array.from(tools.values()).some(
        tool => tool.config.brew || tool.config.checkBrew
      );
      
      if (hasBrewTools) {
        debug('Initializing Homebrew environment for status checks');
        await initBrewEnvironment();
        await initializeBrewCaches();
      }
    }
    
    // Check the status of all tools in batches
    const batchSize = 5; // Process 5 tools at once
    const toolEntries = Array.from(tools.entries());
    
    // Process tools in batches for better performance
    for (let i = 0; i < toolEntries.length; i += batchSize) {
      const batch = toolEntries.slice(i, i + batchSize);
      
      // Process each batch in parallel
      await Promise.all(batch.map(async ([toolId, { config }]) => {
        try {
          const result = await checkToolStatus(toolId, config);
          statusResults.set(toolId, result);
          processedCount++;
          
          // Show progress periodically
          if (processedCount % 10 === 0 || processedCount === toolEntries.length) {
            debug(`Checked ${processedCount}/${toolEntries.length} tools`);
          }
        } catch (err) {
          debug(`Error checking status for ${toolId}: ${err}`);
          statusResults.set(toolId, {
            status: ToolStatus.ERROR,
            error: err instanceof Error ? err : new Error(String(err))
          });
        }
      }));
    }
    
    options.statusResults = statusResults;
  }
  
  // If we only want to show missing tools
  if (options.missing && options.statusResults) {
    const missingTools = new Map();
    
    for (const [toolId, { config, source }] of tools.entries()) {
      const statusResult = options.statusResults.get(toolId);
      
      if (statusResult && statusResult.status === ToolStatus.NOT_INSTALLED) {
        missingTools.set(toolId, { config, source });
      }
    }
    
    // Replace the tools map with only missing tools
    tools = missingTools;
    
    if (tools.size === 0) {
      console.log('All tools are installed.');
      return;
    }
  }
  
  // Determine the max length of tool IDs for formatting
  const maxToolIdLength = Math.max(...Array.from(tools.keys()).map(id => id.length));
  
  // Display each tool
  for (const [toolId, toolData] of tools.entries()) {
    await displaySingleTool(toolId, toolData, {
      detailed: options.detailed,
      status: false, // We already have the status results
      statusResult: options.statusResults ? options.statusResults.get(toolId) : undefined
    });
  }
}

/**
 * Display tools as JSON format
 * @param tools Tools map
 * @param statusResults Tool status results
 * @param options Display options
 */
export function displayToolsAsJson(
  tools: Map<string, { config: ToolConfig, source: string }>,
  statusResults: Map<string, ToolStatusResult>,
  options: { missing?: boolean }
): void {
  const result: Record<string, any> = {};
  
  for (const [toolId, { config, source }] of tools.entries()) {
    const statusResult = statusResults.get(toolId);
    
    // Skip non-missing tools if missing flag is set
    if (options.missing && (!statusResult || statusResult.status !== ToolStatus.NOT_INSTALLED)) {
      continue;
    }
    
    result[toolId] = {
      config,
      source,
      status: statusResult || { status: ToolStatus.UNKNOWN }
    };
  }
  
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Display tools as YAML format
 * @param tools Tools map
 * @param statusResults Tool status results
 * @param options Display options
 */
export function displayToolsAsYaml(
  tools: Map<string, { config: ToolConfig, source: string }>,
  statusResults: Map<string, ToolStatusResult>,
  options: { missing?: boolean }
): void {
  const result: Record<string, any> = {};
  
  for (const [toolId, { config, source }] of tools.entries()) {
    const statusResult = statusResults.get(toolId);
    
    // Skip non-missing tools if missing flag is set
    if (options.missing && (!statusResult || statusResult.status !== ToolStatus.NOT_INSTALLED)) {
      continue;
    }
    
    result[toolId] = {
      config,
      source,
      status: statusResult || { status: ToolStatus.UNKNOWN }
    };
  }
  
  // Use js-yaml to convert to YAML
  const yaml = require('js-yaml');
  console.log(yaml.dump(result));
} 
