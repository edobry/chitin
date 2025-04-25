/**
 * Tool status checking module
 * 
 * This module provides functions for checking tool status without any display logic.
 * It serves as a pure data layer for tool status operations.
 */
import { ToolConfig } from '../../types/config';
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
  DEFAULT_BREW_CACHE_TIMEOUT,
  DEFAULT_CACHE_EXPIRATION
} from './constants';
import { 
  loadToolStatusCache, 
  saveToolStatusCache, 
  getCachedToolStatus, 
  updateToolStatusCache 
} from './cache';

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
  /** Disable caching */
  noCache?: boolean;
  /** Maximum age for cache entries in milliseconds */
  cacheMaxAge?: number;
  /** Skip specific tools (by ID) */
  skipTools?: string[];
  /** Report progress for each individual tool */
  reportIndividualProgress?: boolean;
  /** Timing hooks for performance measurement */
  onPreBrew?: (time: number) => void;
  onCacheRead?: (time: number) => void;
  onCacheWrite?: (time: number) => void;
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
    signal,
    noCache = false,
    cacheMaxAge = DEFAULT_CACHE_EXPIRATION,
    skipTools = [],
    reportIndividualProgress = false,
    onPreBrew,
    onCacheRead,
    onCacheWrite
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
      const brewStartTime = performance.now();
      await initBrewEnvironment();
      await initializeBrewCaches(DEFAULT_BREW_CACHE_TIMEOUT);
      const brewEndTime = performance.now();
      const brewDuration = brewEndTime - brewStartTime;
      
      debug(`Homebrew initialization completed in ${(brewDuration / 1000).toFixed(2)}s`);
      
      if (onPreBrew) {
        onPreBrew(brewDuration);
      }
    }
  }
  
  // Load cache if enabled
  const cacheReadStart = performance.now();
  const cache = !noCache ? loadToolStatusCache() : null;
  const cacheReadDuration = performance.now() - cacheReadStart;
  
  if (onCacheRead) {
    onCacheRead(cacheReadDuration);
  }
  
  debug(`Cache loading completed in ${(cacheReadDuration/1000).toFixed(3)}s`);
  
  // Track the tools to check and results
  const toolsToCheck = new Map<string, ToolConfig>();
  const results = new Map<string, ToolStatusResult>();
  let completedCount = 0;
  const totalCount = tools.size;
  
  // First, apply cache and filter skipped tools
  for (const [toolId, { config }] of tools.entries()) {
    // Skip tools that are explicitly listed to skip
    if (skipTools.includes(toolId)) {
      debug(`Skipping tool ${toolId} as requested`);
      results.set(toolId, {
        status: ToolStatus.UNKNOWN,
        message: 'Tool check skipped by user request'
      });
      
      // Update progress
      completedCount++;
      if (onProgress) {
        onProgress(completedCount, totalCount);
      }
      
      continue;
    }
    
    // Check if we have a valid cached result
    if (cache) {
      const cachedResult = getCachedToolStatus(toolId, config, cache, cacheMaxAge);
      if (cachedResult) {
        results.set(toolId, cachedResult);
        
        // Update progress
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, totalCount);
        }
        
        continue;
      }
    }
    
    // If not skipped or cached, add to the list to check
    toolsToCheck.set(toolId, config);
  }
  
  // Create a progress handler that updates both overall and individual progress
  let progressHandler: ((checked: number, total: number) => void) | undefined = undefined;
  
  if (onProgress) {
    progressHandler = (checked: number, total: number) => {
      onProgress(completedCount + checked, totalCount);
    };
  }
  
  // Check remaining tools
  if (toolsToCheck.size > 0) {
    debug(`Checking status of ${toolsToCheck.size} tools (${completedCount} already resolved)`);
    
    // Perform the batch check
    const batchResults = await batchCheckToolStatus(toolsToCheck, {
      timeout,
      concurrency,
      onProgress: progressHandler,
      signal
    });
    
    // Update the overall results and cache
    const cacheWriteStart = performance.now();
    
    for (const [toolId, result] of batchResults.entries()) {
      results.set(toolId, result);
      
      // Update cache if enabled
      if (cache && !noCache) {
        const config = tools.get(toolId)?.config;
        if (config) {
          updateToolStatusCache(toolId, config, result, cache);
        }
      }
    }
    
    // Save updated cache if enabled
    if (cache && !noCache) {
      await saveToolStatusCache(cache);
    }
    
    const cacheWriteDuration = performance.now() - cacheWriteStart;
    
    if (onCacheWrite) {
      onCacheWrite(cacheWriteDuration);
    }
    
    debug(`Cache update completed in ${(cacheWriteDuration/1000).toFixed(3)}s`);
  } else if (results.size > 0) {
    debug(`All ${results.size} tools resolved from cache or skipped`);
  }
  
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
