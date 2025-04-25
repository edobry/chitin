/**
 * Display utilities for tools command
 */
import { ToolConfig } from '../../types/config';
import { ToolStatus, ToolStatusResult, getToolCheckMethod, getToolInstallMethod } from '../../utils/tools';
import { EMOJI } from '../../utils/display';
import { debug } from '../../utils/logger';
import { shellPool } from '../../utils/shell-pool';
import { countToolsByStatus } from './status';

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
  wallClockDuration?: number;
}

/**
 * Get the status emoji and text for a tool
 */
function getToolStatus(status: ToolStatusResult): { emoji: string; text: string } {
  switch (status.status) {
    case ToolStatus.INSTALLED:
      return { emoji: EMOJI.INSTALLED, text: 'installed' };
    case ToolStatus.NOT_INSTALLED:
      return { emoji: EMOJI.NOT_INSTALLED, text: 'not installed' };
    case ToolStatus.ERROR:
      return { emoji: EMOJI.ERROR, text: `error${status.message ? ` - ${status.message}` : ''}` };
    default:
      return { emoji: EMOJI.UNKNOWN, text: 'unknown' };
  }
}

/**
 * Display information about a single tool
 */
export function displaySingleTool(
  toolId: string,
  tool: { config: ToolConfig; source: string },
  options: { detailed?: boolean } = {},
  statusResult?: ToolStatusResult
): void {
  const { config, source } = tool;
  const { detailed } = options;

  // Add separator before each tool
  console.log('\n―――――――――――――――――――――――――――――――――――――――\n');

  // Display tool header with status if available
  let statusEmoji = '';
  let statusText = '';
  if (statusResult) {
    const { emoji, text } = getToolStatus(statusResult);
    statusEmoji = emoji + ' ';
    statusText = `\n  Status: ${text}`;
  }

  console.log(`  ${statusEmoji}${EMOJI.TOOL} ${toolId}\n`);
  console.log(`  Source: ${source}`);

  // Check methods section
  const checkMethod = getToolCheckMethod(config);
  if (checkMethod !== 'None') {
    console.log(`  ${EMOJI.CHECK} Check: ${checkMethod}`);
    if (detailed) {
      if (config.checkCommand) console.log(`    Command: ${config.checkCommand}`);
      if (config.checkPath) console.log(`    Path: ${config.checkPath}`);
      if (config.checkEval) console.log(`    Expression: ${config.checkEval}`);
    }
  }

  // Install methods section
  const installMethod = getToolInstallMethod(config);
  if (installMethod !== 'None') {
    console.log(`  ${EMOJI.INSTALL} Install: ${installMethod}`);
    if (detailed) {
      if (config.brew && typeof config.brew === 'object') {
        if (config.brew.name) console.log(`    Package: ${config.brew.name}`);
        if (config.brew.cask) console.log('    Type: Cask');
        if (config.brew.tap) console.log(`    Tap: ${config.brew.tap}`);
        if (config.brew.tapUrl) console.log(`    Tap URL: ${config.brew.tapUrl}`);
      }
      if (config.git && typeof config.git === 'object' && 'url' in config.git && 'target' in config.git) {
        console.log(`    URL: ${config.git.url}`);
        console.log(`    Target: ${config.git.target}`);
      }
      if (config.script) console.log(`    URL: ${config.script}`);
      if (config.artifact) {
        console.log(`    URL: ${config.artifact.url}`);
        console.log(`    Target: ${config.artifact.target}`);
        if (config.artifact.appendFilename) console.log('    Append Filename: true');
      }
      if (config.command) console.log(`    Command: ${config.command}`);
    }
  }

  // Version information
  if (detailed && (config.version || config.versionCommand)) {
    let versionInfo = '';
    if (config.version) versionInfo += `\n    Version: ${config.version}`;
    if (config.versionCommand) versionInfo += `\n    Command: ${config.versionCommand}`;
    if (versionInfo) console.log(`  ${EMOJI.VERSION} Version:${versionInfo}`);
  }

  // Additional configuration
  if (detailed) {
    if (config.optional) {
      console.log(`  ${EMOJI.OPTIONAL} Optional: true`);
    }
    if (config.postInstall) {
      console.log(`  ${EMOJI.POST_INSTALL} Post Install: ${config.postInstall}`);
    }
  }

  // Dependencies
  if (detailed && config.deps && Array.isArray(config.deps) && config.deps.length > 0) {
    console.log(`  ${EMOJI.DEPENDENCIES} Dependencies:`);
    for (const dep of config.deps) {
      console.log(`    - ${dep}`);
    }
  }

  // Provided tools
  if (detailed && config.provides && Array.isArray(config.provides) && config.provides.length > 0) {
    console.log(`  ${EMOJI.PROVIDES} Provides:`);
    for (const providedTool of config.provides) {
      console.log(`    - ${providedTool}`);
    }
  }

  // Status text (if available)
  if (statusText) {
    console.log(statusText);
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
  // We no longer need to register process exit handlers for cleanup
  // since it's handled in withToolSetup
  
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
  console.log(`Legend: ${EMOJI.TOOL} = tool   ${EMOJI.CHECK} = check method   ${EMOJI.INSTALL} = install method   ${EMOJI.REFERENCE} = reference`);
  if (options.status) {
    console.log(`Status: ${EMOJI.INSTALLED} = installed   ${EMOJI.NOT_INSTALLED} = not installed   ${EMOJI.ERROR} = error   ${EMOJI.UNKNOWN} = unknown`);
  }
  console.log('');
  
  // Only show the count and source grouping for multiple tools
  if (tools.size > 1) {
    console.log(`\nFound ${tools.size} tools/tool references:\n`);
    
    // If status is requested and we have many tools, show warning
    if (options.status && fullTools.size > 10 && !options.skipStatusWarning) {
      console.log(`\n⚠️ Warning: Checking status for ${fullTools.size} tools may take a while.`);
      console.log('   Consider using filters (--filter-source, --filter-check, --filter-install) or');
      console.log('   specifying a single tool: tools get <toolname> --status\n');
    }
    
    // Group tools by source
    const toolsBySource = new Map<string, Map<string, { config: ToolConfig, source: string }>>();
    const sourceNames = new Set<string>();
    
    for (const [toolId, toolData] of tools.entries()) {
      const source = toolData.source;
      sourceNames.add(source);
      
      if (!toolsBySource.has(source)) {
        toolsBySource.set(source, new Map());
      }
      toolsBySource.get(source)!.set(toolId, toolData);
    }
    
    // Display tools grouped by source
    for (const source of sourceNames) {
      const sourceTools = toolsBySource.get(source)!;
      console.log(`\n=== Source: ${source} (${sourceTools.size} tools) ===\n`);
      
      for (const [toolId, toolData] of sourceTools.entries()) {
        displaySingleTool(toolId, toolData, options, options.statusResults?.get(toolId));
      }
    }
  } else {
    // For single tool, just display it directly
    const toolEntry = tools.entries().next();
    if (!toolEntry.done) {
      const [toolId, toolData] = toolEntry.value;
      displaySingleTool(toolId, toolData, options, options.statusResults?.get(toolId));
    }
  }
  
  // Only show summary for multiple tools
  if (tools.size > 1 && options.statusResults && options.statusResults.size > 0) {
    console.log(`\n=== Summary ===\n`);
    
    // Count tools by status
    const statusCounts = countToolsByStatus(options.statusResults);
    
    console.log(`Total tools: ${fullTools.size}`);
    console.log(`  ${EMOJI.INSTALLED} Installed: ${statusCounts.installed}`);
    console.log(`  ${EMOJI.NOT_INSTALLED} Not installed: ${statusCounts.notInstalled}`);
    if (statusCounts.error > 0) {
      console.log(`  ${EMOJI.ERROR} Error: ${statusCounts.error}`);
    }
    if (statusCounts.unknown > 0) {
      console.log(`  ${EMOJI.UNKNOWN} Unknown: ${statusCounts.unknown}`);
    }
    
    // Count tools by source
    console.log(`\nTools by source:`);
    const sourceNames = new Set(Array.from(tools.values()).map(t => t.source));
    for (const source of sourceNames) {
      const count = Array.from(tools.values()).filter(t => t.source === source).length;
      console.log(`  ${source}: ${count}`);
    }
    
    // Show total check time
    if (options.wallClockDuration) {
      console.log(`\nExecution time: ${(options.wallClockDuration / 1000).toFixed(2)}s`);
    }
  }

  // We no longer need to clean up shells here since it's handled in withToolSetup
}

/**
 * Display tools legend
 */
export function displayToolsLegend(options: { status?: boolean } = {}): void {
  // Only display legend for normal output, not for JSON/YAML
  if (process.stdout.isTTY) {
    console.log(`Legend: ${EMOJI.TOOL} = tool   ${EMOJI.CHECK} = check method   ${EMOJI.INSTALL} = install method   ${EMOJI.REFERENCE} = reference`);
    if (options.status) {
      console.log(`Status: ${EMOJI.INSTALLED} = installed   ${EMOJI.NOT_INSTALLED} = not installed   ${EMOJI.ERROR} = error   ${EMOJI.UNKNOWN} = unknown`);
    }
    console.log('');
  }
}

/**
 * Display tools as JSON format
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
  
  // Output only the JSON data, no legend or other text
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Display tools as YAML format
 */
export function displayToolsAsYaml(
  tools: Map<string, { config: ToolConfig, source: string }>,
  statusResults: Map<string, ToolStatusResult> | undefined,
  options: { missing?: boolean }
): void {
  // Implementation would go here
}

// cleanupShells function is no longer needed, it's handled in withToolSetup 
