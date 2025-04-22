/**
 * UI utilities for displaying information to the user
 */
import { ToolConfig } from '../types';
import { DISPLAY } from '../constants';
import { ToolStatus, ToolStatusResult, getStatusEmoji, getToolCheckMethod, getToolInstallMethod } from './tools';

/**
 * Format a status enum to a display string
 * @param status Tool status
 * @returns Formatted status string
 */
export function formatStatus(status: ToolStatus): string {
  switch (status) {
    case ToolStatus.INSTALLED:
      return 'Installed';
    case ToolStatus.NOT_INSTALLED:
      return 'Not Installed';
    case ToolStatus.ERROR:
      return 'Error';
    case ToolStatus.UNKNOWN:
    default:
      return 'Unknown';
  }
}

/**
 * Format a config value for display
 * @param value Value to format
 * @returns Formatted string
 */
export function formatConfigValue(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }
  
  return String(value);
}

/**
 * Display tool check method with emoji
 * @param toolId Tool ID
 * @param config Tool configuration
 */
export function displayCheckMethod(toolId: string, config: ToolConfig): void {
  console.log(`  ${DISPLAY.EMOJIS.CHECK} Check: ${getToolCheckMethod(config)}`);
  
  // Show the specific check method details if available
  if (config.checkCommand) {
    console.log(`    Command: ${config.checkCommand}`);
  } else if (config.checkPath) {
    console.log(`    Path: ${config.checkPath}`);
  } else if (config.checkEval) {
    console.log(`    Eval: ${config.checkEval}`);
  } else if (config.brew || config.checkBrew) {
    const brewConfig = config.brew || config.checkBrew;
    console.log(`    Homebrew: ${formatConfigValue(brewConfig)}`);
  } else {
    console.log(`    Default: command -v ${toolId}`);
  }
}

/**
 * Display tool installation method with emoji
 * @param config Tool configuration
 */
export function displayInstallMethod(config: ToolConfig): void {
  const installMethod = getToolInstallMethod(config);
  
  if (installMethod === 'None') {
    return; // Don't display if no install method is available
  }
  
  console.log(`  ${DISPLAY.EMOJIS.INSTALL} Install: ${installMethod}`);
  
  // Show the specific installation method details if available
  if (config.command) {
    console.log(`    Command: ${config.command}`);
  } else if (config.script) {
    console.log(`    Script: ${config.script}`);
  } else if (config.git) {
    console.log(`    Git: ${formatConfigValue(config.git)}`);
  } else if (config.brew) {
    console.log(`    Homebrew: ${formatConfigValue(config.brew)}`);
  }
}

/**
 * Display additional tool information with emoji
 * @param config Tool configuration
 */
export function displayAdditionalInfo(config: ToolConfig): void {
  if (!config) return;
  
  const additionalInfo: string[] = [];
  
  if (config.optional === true) {
    additionalInfo.push('Optional: Yes');
  }
  
  if (config.provides && Array.isArray(config.provides) && config.provides.length > 0) {
    additionalInfo.push(`Provides: ${config.provides.join(', ')}`);
  }
  
  if (config.deps && Array.isArray(config.deps) && config.deps.length > 0) {
    additionalInfo.push(`Depends on: ${config.deps.join(', ')}`);
  }
  
  if (additionalInfo.length > 0) {
    console.log(`  ${DISPLAY.EMOJIS.ADDITIONAL_INFO} Info:`);
    for (const info of additionalInfo) {
      console.log(`    ${info}`);
    }
  }
}

/**
 * Display a tool's status with emoji
 * @param statusResult Tool status result
 */
export function displayToolStatus(statusResult: ToolStatusResult): void {
  const emoji = getStatusEmoji(statusResult);
  const status = formatStatus(statusResult.status);
  
  console.log(`  ${emoji} Status: ${status}`);
  
  if (statusResult.message) {
    console.log(`    ${statusResult.message}`);
  }
  
  if (statusResult.output) {
    // Show only the first line of output to avoid cluttering the display
    const firstLine = statusResult.output.split('\n')[0];
    console.log(`    Output: ${firstLine}${statusResult.output.includes('\n') ? '...' : ''}`);
  }
  
  if (statusResult.checkDuration) {
    console.log(`    Check duration: ${statusResult.checkDuration.toFixed(2)}ms`);
  }
}

/**
 * Show installation hint for a tool that failed a check
 * @param toolId Tool ID
 * @param config Tool configuration
 */
export function showInstallationHint(toolId: string, config: ToolConfig): void {
  if (!config) return;
  
  const installMethod = getToolInstallMethod(config);
  
  if (installMethod === 'None') {
    console.log(`  No installation method provided for ${toolId}`);
    return;
  }
  
  let installCommand = '';
  
  if (config.brew) {
    const isCask = typeof config.brew === 'object' && (config.brew.cask === true || typeof config.brew.cask === 'string');
    const brewName = typeof config.brew === 'string' ? config.brew : 
                    (typeof config.brew === 'object' && config.brew.name ? config.brew.name : toolId);
    
    installCommand = `brew install ${isCask ? '--cask ' : ''}${brewName}`;
  } else if (config.command) {
    installCommand = config.command;
  } else if (config.script) {
    installCommand = `/bin/bash -c "$(curl -fsSL ${config.script})"`;
  } else if (config.git) {
    const gitUrl = typeof config.git === 'object' && config.git.url ? config.git.url : 
                  (typeof config.git === 'string' ? config.git : '');
    
    if (gitUrl) {
      const gitTarget = typeof config.git === 'object' && config.git.target ? config.git.target : `~/.local/share/${toolId}`;
      installCommand = `git clone ${gitUrl} ${gitTarget}`;
    }
  }
  
  if (installCommand) {
    console.log(`  To install ${toolId}, try: ${installCommand}`);
  }
} 
