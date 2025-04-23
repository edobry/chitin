/**
 * UI utilities for displaying information to the user
 */
import { ToolConfig } from '../types';
import { ToolStatus, ToolStatusResult, getStatusEmoji, getToolCheckMethod, getToolInstallMethod } from './tools';

/**
 * Display constants
 */
export const DISPLAY = {
  EMOJIS: {
    // Entities
    FIBER: '🧬',
    CHAIN: '⛓️',
    TOOL: '🔧',
    REFERENCE: '🔗',
    
    // Status indicators
    ENABLED: '🟢',
    DISABLED: '🔴',
    WARNING: '⚠️',  // Warning/error symbol
    ERROR: '⚠️',    // Error symbol (same as warning)
    UNKNOWN: '⚪',
    DEPENDS_ON: '⬆️',
    
    // Tool properties
    CHECK: '🔍',
    INSTALL: '🏗️',
    ADDITIONAL_INFO: '📋',
  },
} as const;

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
  
  // For boolean values, just return "true" or "false" as a string
  if (typeof value === 'boolean') {
    return value.toString();
  }
  
  // For simple strings, just return them directly
  if (typeof value === 'string') {
    return value;
  }
  
  // For objects, try to format them cleanly
  if (typeof value === 'object') {
    // For empty objects, just return an empty string
    if (Object.keys(value).length === 0) {
      return '';
    }
    
    // For single key objects with a simple value, try to format more cleanly
    if (Object.keys(value).length === 1) {
      const key = Object.keys(value)[0];
      const val = value[key];
      
      // For simple boolean flags like { cask: true }, return just the key
      if (typeof val === 'boolean' && val === true) {
        return key;
      }
    }
    
    // Otherwise fallback to standard JSON formatting
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
  
  // Remove detailed check method display
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
  
  console.log(`  ${DISPLAY.EMOJIS.INSTALL}  Install: ${installMethod}`);
  
  // Remove detailed installation method display
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
