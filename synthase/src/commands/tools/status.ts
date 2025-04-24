/**
 * Tool status checking module
 * 
 * This module provides functions for checking tool status without any display logic.
 * It serves as a pure data layer for tool status operations.
 */
import { ToolConfig } from '../../types';
import { 
  ToolStatus, 
  ToolStatusResult, 
  checkToolStatus,
  checkToolStatusWithOptions, 
  batchCheckToolStatus 
} from '../../utils/tools';
import { initBrewEnvironment, initializeBrewCaches } from '../../utils/homebrew';
import { debug } from '../../utils/logger';
import {
  DEFAULT_TOOL_CONCURRENCY,
  DEFAULT_TOOL_TIMEOUT,
  DEFAULT_BREW_CACHE_TIMEOUT
} from './constants';

/**
 * Options for checking tool statuses
 */
export interface ToolStatusCheckOptions {
  /** Maximum concurrent checks to run */
  concurrency?: number;
  /** Timeout for individual tool checks in milliseconds */
  timeout?: number;
  /** Optional progress callback */
  onProgress?: (checked: number, total: number) => void;
  /** Skip initializing Homebrew environment */
  skipBrewInit?: boolean;
  /** Abort signal to cancel the operation */
  signal?: AbortSignal;
}

/**
 * Check statuses for a collection of tools
 * 
 * This is a pure data operation that does not produce any console output
 * other than through the optional progress callback.
 * 
 * @param tools Map of tool ID to tool configuration with source information
 * @param options Options for the status check operation
 * @returns Map of tool ID to status result
 */
export async function checkToolStatuses(
  tools: Map<string, { config: ToolConfig; source: string }>,
  options: ToolStatusCheckOptions = {}
): Promise<Map<string, ToolStatusResult>> {
  const {
    concurrency = DEFAULT_TOOL_CONCURRENCY,
    timeout = DEFAULT_TOOL_TIMEOUT,
    onProgress,
    skipBrewInit = false,
    signal
  } = options;
  
  // If no tools to check, return empty results
  if (tools.size === 0) {
    return new Map();
  }
  
  // Check if we need to initialize Homebrew environment
  if (!skipBrewInit) {
    const hasBrewTools = Array.from(tools.values()).some(
      tool => tool.config.brew || tool.config.checkBrew
    );
    
    if (hasBrewTools) {
      debug('Initializing Homebrew environment for status checks');
      await initBrewEnvironment();
      await initializeBrewCaches(DEFAULT_BREW_CACHE_TIMEOUT);
    }
  }
  
  // Convert to the format needed by batchCheckToolStatus
  const toolConfigs = new Map<string, ToolConfig>();
  for (const [toolId, { config }] of tools.entries()) {
    toolConfigs.set(toolId, config);
  }
  
  // Perform the batch check
  const results = await batchCheckToolStatus(toolConfigs, {
    timeout,
    concurrency,
    onProgress,
    signal
  });
  
  return results;
}

/**
 * Get counts of tools by status
 */
export function countToolsByStatus(statusResults: Map<string, ToolStatusResult>): { 
  installed: number; 
  notInstalled: number; 
  error: number; 
  unknown: number; 
  total: number;
} {
  let installed = 0;
  let notInstalled = 0;
  let error = 0;
  let unknown = 0;
  
  for (const status of statusResults.values()) {
    switch (status.status) {
      case ToolStatus.INSTALLED:
        installed++;
        break;
      case ToolStatus.NOT_INSTALLED:
        notInstalled++;
        break;
      case ToolStatus.ERROR:
        error++;
        break;
      case ToolStatus.UNKNOWN:
        unknown++;
        break;
    }
  }
  
  return {
    installed,
    notInstalled,
    error,
    unknown,
    total: statusResults.size
  };
}

/**
 * Calculate the total duration of all tool checks
 */
export function calculateTotalCheckDuration(statusResults: Map<string, ToolStatusResult>): number {
  let totalDuration = 0;
  
  for (const result of statusResults.values()) {
    if (result.checkDuration) {
      totalDuration += result.checkDuration;
    }
  }
  
  return totalDuration;
}

/**
 * Create a default progress handler that updates the console
 * This can be passed to checkToolStatuses for standard progress reporting
 */
export function createConsoleProgressHandler(): (checked: number, total: number) => void {
  return (checked: number, total: number) => {
    process.stdout.write(`\r\x1b[KChecking tools: ${checked}/${total} (${Math.round(checked/total*100)}%)`);
  };
}

/**
 * Clear the progress line in the console
 * Call this after using createConsoleProgressHandler to clear the progress line
 */
export function clearProgressLine(): void {
  process.stdout.write('\r\x1b[K');
} 
