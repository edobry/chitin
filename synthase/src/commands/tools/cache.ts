/**
 * Tool status caching utilities
 */
import * as fs from 'fs';
import * as path from 'path';
import { debug } from '../../utils/logger';
import { ToolStatusResult } from '../../utils/tools';
import { DEFAULT_CACHE_EXPIRATION, TOOL_STATUS_CACHE_FILE } from './constants';

/**
 * Interface for the cache entry for a tool
 */
interface ToolStatusCacheEntry {
  timestamp: number;
  result: ToolStatusResult;
  toolConfigHash: string; // Hash of the tool config to detect changes
}

/**
 * Interface for the overall cache structure
 */
interface ToolStatusCache {
  version: number;
  entries: Record<string, ToolStatusCacheEntry>;
}

/**
 * Create a simple hash of the tool config object for comparing changes
 * @param config Tool configuration object
 * @returns A string hash representation
 */
function hashToolConfig(config: any): string {
  if (!config) return '';
  // Simple JSON stringify with sorted keys for consistency
  return JSON.stringify(config, Object.keys(config).sort());
}

/**
 * Load the tool status cache from disk
 * @returns The cache object or null if not found or invalid
 */
export function loadToolStatusCache(): ToolStatusCache | null {
  try {
    const cacheFile = path.join(process.cwd(), TOOL_STATUS_CACHE_FILE);
    
    if (!fs.existsSync(cacheFile)) {
      debug('No tool status cache file found');
      return null;
    }
    
    const cacheData = fs.readFileSync(cacheFile, 'utf8');
    const cache = JSON.parse(cacheData) as ToolStatusCache;
    
    // Validate cache structure
    if (!cache || !cache.version || !cache.entries) {
      debug('Invalid cache structure, ignoring');
      return null;
    }
    
    debug(`Loaded tool status cache with ${Object.keys(cache.entries).length} entries`);
    return cache;
  } catch (error) {
    debug(`Error loading tool status cache: ${error}`);
    return null;
  }
}

/**
 * Save the tool status cache to disk
 * @param cache The cache object to save
 */
export function saveToolStatusCache(cache: ToolStatusCache): void {
  try {
    const cacheFile = path.join(process.cwd(), TOOL_STATUS_CACHE_FILE);
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
    debug(`Saved tool status cache with ${Object.keys(cache.entries).length} entries`);
  } catch (error) {
    debug(`Error saving tool status cache: ${error}`);
  }
}

/**
 * Get a cached tool status if it's valid and not expired
 * @param toolId The tool ID to check
 * @param toolConfig The current tool configuration
 * @param cache The loaded cache object
 * @param maxAge Maximum age of cache entry in milliseconds
 * @returns The cached status or null if not found or expired
 */
export function getCachedToolStatus(
  toolId: string,
  toolConfig: any,
  cache: ToolStatusCache,
  maxAge: number = DEFAULT_CACHE_EXPIRATION
): ToolStatusResult | null {
  if (!cache || !cache.entries || !cache.entries[toolId]) {
    return null;
  }
  
  const entry = cache.entries[toolId];
  const now = Date.now();
  
  // Check if the entry is expired
  if (now - entry.timestamp > maxAge) {
    debug(`Cache entry for ${toolId} is expired`);
    return null;
  }
  
  // Check if the tool config has changed
  const currentHash = hashToolConfig(toolConfig);
  if (currentHash !== entry.toolConfigHash) {
    debug(`Tool config for ${toolId} has changed, cache invalid`);
    return null;
  }
  
  debug(`Using cached status for ${toolId}`);
  return entry.result;
}

/**
 * Update the cache with a new tool status result
 * @param toolId The tool ID
 * @param toolConfig The tool configuration
 * @param result The status result
 * @param cache The cache object to update
 * @returns The updated cache
 */
export function updateToolStatusCache(
  toolId: string,
  toolConfig: any,
  result: ToolStatusResult,
  cache: ToolStatusCache
): ToolStatusCache {
  // Create a new cache if one doesn't exist
  if (!cache) {
    cache = {
      version: 1,
      entries: {}
    };
  }
  
  // Update the entry
  cache.entries[toolId] = {
    timestamp: Date.now(),
    result,
    toolConfigHash: hashToolConfig(toolConfig)
  };
  
  return cache;
} 
