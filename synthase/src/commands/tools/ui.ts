/**
 * UI utilities for tools command displays
 */
import { ToolConfig } from '../../types';
import { ToolStatus, ToolStatusResult, getStatusEmoji } from '../../utils/tools';
import { displayCheckMethod, displayInstallMethod, displayAdditionalInfo, displayToolStatus, formatConfigValue } from '../../utils/ui';
import { debug } from '../../utils/logger';
import { DISPLAY } from '../../constants';
import { shellPool } from '../../utils/shell-pool';
import { countToolsByStatus, calculateTotalCheckDuration } from './status';

/**
 * Display information about a single tool
 * @param toolId Tool identifier
 * @param toolData Tool data
 * @param options Display options
 */
export function displaySingleTool(
  toolId: string,
  toolData: { config: ToolConfig, source: string },
  options: { detailed?: boolean, statusResult?: ToolStatusResult }
): void {
  // If we have a status result, display it with the tool name
  if (options.statusResult) {
    const statusEmoji = getStatusEmoji(options.statusResult);
    console.log(`  ${statusEmoji} 🔧 ${toolId}`);
  } else {
    console.log(`  🔧 ${toolId}`);
  }
  
  console.log('');
  
  // Display source
  console.log(`  Source: ${toolData.source}`);
  
  // Display check method
  displayCheckMethod(toolId, toolData.config);
  
  // Display install method
  displayInstallMethod(toolData.config);
  
  // Display additional properties in detailed mode
  if (options.detailed) {
    displayAdditionalInfo(toolData.config);
  }
  
  // Show the status if we have a result
  if (options.statusResult) {
    const status = options.statusResult;
    
    // More concise status display - only show message for errors/unknown status
    if (status.status === ToolStatus.ERROR || status.status === ToolStatus.UNKNOWN) {
      console.log(`  Status: ${formatStatus(status.status)}${status.message ? ` - ${status.message}` : ''}`);
    } else {
      // Just show the status without detailed message for successful/not installed cases
      console.log(`  Status: ${formatStatus(status.status)}`);
    }
    
    // If not installed, show installation hint
    if (status.status === ToolStatus.NOT_INSTALLED) {
      showInstallationHint(toolId, toolData.config);
    }
  }
  
  // No trailing empty line - we'll let the display loop handle spacing between tools
}

/**
 * Format a status enum to a display string
 */
function formatStatus(status: ToolStatus): string {
  switch (status) {
    case ToolStatus.INSTALLED:
      return 'installed';
    case ToolStatus.NOT_INSTALLED:
      return 'not installed';
    case ToolStatus.ERROR:
      return 'error';
    case ToolStatus.UNKNOWN:
    default:
      return 'unknown';
  }
}

/**
 * Show installation hint for a tool that failed a check
 */
function showInstallationHint(toolId: string, config: ToolConfig): void {
  // Implementation would go here if needed
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

// For tracking total check time
let timingSummaryDisplayed = false;

/**
 * Clean up shell processes when the command completes
 */
async function cleanupShells(): Promise<void> {
  debug('Cleaning up shell processes...');
  try {
    // Use the properly imported shellPool to clean up
    await shellPool.shutdown();
    debug('Shell cleanup completed successfully');
  } catch (err) {
    debug(`Error during shell cleanup: ${err}`);
  }
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
  // Register process exit handlers for cleanup
  // This is a more robust approach than trying to cleanup at the end
  process.once('beforeExit', () => {
    debug('Process beforeExit event triggered, cleaning up...');
    cleanupShells();
  });
  
  if (tools.size === 0) {
    console.log('No tools found matching the criteria.');
    return;
  }

  // Separate full tools from references
  const fullTools = new Map();
  const toolReferences = new Map();
  
  // Categorize tools as either full configs or references
  for (const [toolId, toolData] of tools.entries()) {
    const hasFullConfig = 
      Object.keys(toolData.config).some(key => 
        ['checkCommand', 'checkBrew', 'checkPath', 'brew', 'git', 'script', 'command', 'artifact'].includes(key));
    
    if (hasFullConfig) {
      fullTools.set(toolId, toolData);
    } else {
      toolReferences.set(toolId, toolData);
    }
  }
  
  // Display legend
  displayToolsLegend({ status: options.status });
  
  console.log(`\nFound ${tools.size} tools/tool references:\n`);
  
  // If status is requested and we have many tools, show warning
  if (options.status && fullTools.size > 10 && !options.skipStatusWarning) {
    console.log(`\n⚠️ Warning: Checking status for ${fullTools.size} tools may take a while.`);
    console.log('   Consider using filters (--filter-source, --filter-check, --filter-install) or');
    console.log('   specifying a single tool: tools get <toolname> --status\n');
  }
  
  // Group tools by source
  const toolsBySource = new Map<string, Map<string, { config: ToolConfig, source: string }>>();
  
  for (const [toolId, toolData] of fullTools.entries()) {
    const source = toolData.source;
    if (!toolsBySource.has(source)) {
      toolsBySource.set(source, new Map());
    }
    toolsBySource.get(source)!.set(toolId, toolData);
  }
  
  // Get sorted list of sources
  const sourceNames = Array.from(toolsBySource.keys()).sort();
  
  // Display tools grouped by source
  for (const source of sourceNames) {
    const sourceTools = toolsBySource.get(source)!;
    const toolIds = Array.from(sourceTools.keys()).sort();
    
    console.log(`\n=== Source: ${source} (${toolIds.length} tools) ===\n`);
    
    for (const toolId of toolIds) {
      const toolData = sourceTools.get(toolId)!;
      
      // Add a separator before each tool with consistent spacing
      console.log(`\n―――――――――――――――――――――――――――――――――――――――\n`);
      
      // Display the tool
      displaySingleTool(toolId, toolData, {
        detailed: options.detailed,
        statusResult: options.statusResults?.get(toolId)
      });
    }
  }
  
  // Display tool references only if not showing missing tools
  if (toolReferences.size > 0 && !options.missing) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`=== Tool References (${toolReferences.size}) ===\n`);
    
    // Display each reference sorted by name
    const referenceNames = Array.from(toolReferences.keys()).sort();
    
    console.log('References are tools mentioned in toolDeps or similar properties but without full configuration:');
    console.log('');
    
    for (const toolId of referenceNames) {
      const toolData = toolReferences.get(toolId)!;
      console.log(`  🔗 ${toolId} (referenced in ${toolData.source})`);
    }
  }

  // Display summary statistics if status was checked
  if (options.statusResults && options.statusResults.size > 0) {
    console.log(`\n=== Summary ===\n`);
    
    // Count tools by status
    const statusCounts = countToolsByStatus(options.statusResults);
    
    console.log(`Total tools: ${fullTools.size}`);
    console.log(`  ${DISPLAY.EMOJIS.ENABLED} Installed: ${statusCounts.installed}`);
    console.log(`  ${DISPLAY.EMOJIS.DISABLED} Not installed: ${statusCounts.notInstalled}`);
    if (statusCounts.error > 0) {
      console.log(`  ${DISPLAY.EMOJIS.WARNING} Error: ${statusCounts.error}`);
    }
    if (statusCounts.unknown > 0) {
      console.log(`  ${DISPLAY.EMOJIS.UNKNOWN} Unknown: ${statusCounts.unknown}`);
    }
    
    // Count tools by source
    console.log(`\nTools by source:`);
    for (const source of sourceNames) {
      const count = toolsBySource.get(source)!.size;
      console.log(`  ${source}: ${count}`);
    }
    
    // Show total check time only once
    if (!timingSummaryDisplayed) {
      const totalCheckTime = calculateTotalCheckDuration(options.statusResults);
      console.log(`\nTotal status check time: ${(totalCheckTime / 1000).toFixed(2)}s`);
      timingSummaryDisplayed = true;
    }
  }

  // Make sure we clean up before exiting
  await cleanupShells();
}

/**
 * Display tools as JSON format
 * @param tools Tools map
 * @param statusResults Tool status results
 * @param options Display options
 */
export function displayToolsAsJson(
  tools: Map<string, { config: ToolConfig, source: string }>,
  statusResults: Map<string, ToolStatusResult> | undefined,
  options: { missing?: boolean }
): void {
  const result: Record<string, any> = {};
  
  for (const [toolId, { config, source }] of tools.entries()) {
    const statusResult = statusResults?.get(toolId);
    
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
  statusResults: Map<string, ToolStatusResult> | undefined,
  options: { missing?: boolean }
): void {
  // Implementation would go here
}

export function displayToolsLegend(options: { status?: boolean } = {}): void {
  console.log(`Legend: ${DISPLAY.EMOJIS.TOOL} = tool   ${DISPLAY.EMOJIS.CHECK} = check method   ${DISPLAY.EMOJIS.INSTALL}  = install method   ${DISPLAY.EMOJIS.REFERENCE} = reference`);
  if (options.status) {
    console.log(`Status: ${DISPLAY.EMOJIS.ENABLED} = installed   ${DISPLAY.EMOJIS.DISABLED} = not installed   ${DISPLAY.EMOJIS.WARNING} = error   ${DISPLAY.EMOJIS.UNKNOWN} = unknown`);
  }
  console.log('');
} 
