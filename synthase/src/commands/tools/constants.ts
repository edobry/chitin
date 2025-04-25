/**
 * Shared constants for tools command
 */

/**
 * Default concurrency for tool status checking
 */
export const DEFAULT_TOOL_CONCURRENCY = 50;

/**
 * Default timeout for tool status checks in milliseconds
 */
export const DEFAULT_TOOL_TIMEOUT = 800;

/**
 * Default timeout for Homebrew cache initialization in milliseconds
 */
export const DEFAULT_BREW_CACHE_TIMEOUT = 3000;

/**
 * Default cache expiration time in milliseconds (60 minutes)
 */
export const DEFAULT_CACHE_EXPIRATION = 60 * 60 * 1000;

/**
 * Default cache file location
 */
export const TOOL_STATUS_CACHE_FILE = '.synthase-tool-status-cache.json'; 
