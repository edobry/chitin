/**
 * Shared Homebrew utilities for the application
 */
import { safeExecaCommand } from './process';
import { debug } from './logger';

/**
 * Homebrew constants
 */
export const BREW = {
  COMMAND: 'brew',
  CASK: 'cask',
  FORMULA: 'formula',
  TAP: 'tap',
  NAME: 'name',
  CHECK_PREFIX: 'checkBrew'
} as const;

/**
 * Command constants to reduce duplication
 */
export const BREW_CMD = {
  LIST_CASK: `${BREW.COMMAND} ls --cask`,
  LIST_FORMULA: `${BREW.COMMAND} ls --formula`,
  LIST_ALL: `${BREW.COMMAND} ls -1`,
  LIST_CASKS_ONLY: `${BREW.COMMAND} list --cask`,
  LIST_FORMULAS_ONLY: `${BREW.COMMAND} list --formula`
} as const;

/**
 * Homebrew environment variables to make commands faster
 */
export const BREW_ENV = {
  HOMEBREW_NO_ANALYTICS: '1',
  HOMEBREW_NO_AUTO_UPDATE: '1', 
  HOMEBREW_NO_INSTALL_CLEANUP: '1',
  HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: '1'
} as const;

// Response cache for expensive operations
const responseCache = new Map<string, any>();

/**
 * Initialize the Homebrew environment variables
 * @param timeoutMs Timeout in milliseconds
 * @returns True if initialization succeeded, false otherwise
 */
export async function initBrewEnvironment(timeoutMs: number = 1000): Promise<boolean> {
  try {
    debug('=== Initializing Homebrew environment ===');
    
    // Directly set the environment variables for Homebrew
    // This is equivalent to what brew shellenv would do
    debug('Setting up Homebrew environment variables directly');
    
    // Standard Homebrew paths for Apple Silicon Macs
    const homebrewPrefix = '/opt/homebrew';
    const paths = [
      `${homebrewPrefix}/bin`,
      `${homebrewPrefix}/sbin`,
      process.env.PATH || ''
    ].join(':');
    
    // Set PATH and other environment variables
    process.env.PATH = paths;
    process.env.HOMEBREW_PREFIX = homebrewPrefix;
    process.env.HOMEBREW_CELLAR = `${homebrewPrefix}/Cellar`;
    process.env.HOMEBREW_REPOSITORY = homebrewPrefix;
    process.env.MANPATH = `${homebrewPrefix}/share/man${process.env.MANPATH ? `:${process.env.MANPATH}` : ''}`;
    process.env.INFOPATH = `${homebrewPrefix}/share/info${process.env.INFOPATH ? `:${process.env.INFOPATH}` : ''}`;
    
    // Set performance optimization environment variables
    Object.entries(BREW_ENV).forEach(([key, value]) => {
      process.env[key] = value.toString();
    });
    
    debug(`PATH is now: ${process.env.PATH}`);
    debug('Homebrew environment initialized successfully');
    
    // Check if it worked
    try {
      const { exitCode } = await safeExecaCommand('brew --version', {
        shell: true,
        reject: false,
        timeout: timeoutMs
      });
      
      if (exitCode !== 0) {
        debug('Homebrew is not available even after environment setup');
        return false;
      }
      
      debug('Homebrew is now available');
      return true;
    } catch (error) {
      debug(`Error checking Homebrew availability: ${error}`);
      return false;
    }
  } catch (error) {
    debug(`Error initializing Homebrew environment: ${error}`);
    return false;
  }
}

// At the top of the file, add/update the cache variables with proper typing
let brewFormulasCache: string[] = [];
let brewCasksCache: string[] = [];
let brewCacheInitialized = false;
let brewCacheTimestamp = 0; // Add timestamp for cache freshness check

/**
 * Initialize Homebrew caches for formulas and casks
 * @param timeoutMs Timeout in milliseconds
 * @returns True if initialization succeeded, false otherwise
 */
export async function initializeBrewCaches(timeoutMs: number = 5000): Promise<boolean> {
  // Check if cache is still fresh (use cache for 5 minutes/300000ms)
  const now = Date.now();
  if (brewCacheInitialized && (now - brewCacheTimestamp) < 300000) {
    debug('Using already initialized fresh Homebrew caches');
    return true;
  }
  
  debug('Initializing Homebrew caches (formulas and casks)...');
  
  try {
    // Initialize Homebrew environment first
    const brewInitSuccess = await initBrewEnvironment(timeoutMs * 0.2);
    if (!brewInitSuccess) {
      debug('Failed to initialize Homebrew environment, cache initialization aborted');
      return false;
    }
    
    // Get formulas
    brewFormulasCache = await getInstalledBrewPackages('formula', { timeoutMs: timeoutMs * 0.4 });
    debug(`Cached ${brewFormulasCache.length} installed formulas`);
    
    // Get casks
    brewCasksCache = await getInstalledBrewPackages('cask', { timeoutMs: timeoutMs * 0.4 });
    debug(`Cached ${brewCasksCache.length} installed casks`);
    
    brewCacheInitialized = true;
    brewCacheTimestamp = now; // Update timestamp
    return true;
  } catch (error) {
    debug(`Error initializing Homebrew caches: ${error}`);
    return false;
  }
}

/**
 * Gets the list of installed Homebrew packages (formulas or casks)
 * Uses cached results if called multiple times
 * @param type 'formula' or 'cask'
 * @param options Optional parameters
 * @returns Promise resolving to array of installed package names
 */
export async function getInstalledBrewPackages(type: 'formula' | 'cask', options: { timeoutMs?: number } = {}): Promise<string[]> {
  const { timeoutMs = 5000 } = options;
  
  const cacheKey = `installed_brew_${type}`;
  if (responseCache.has(cacheKey)) {
    debug(`Using cached ${type} list`);
    return responseCache.get(cacheKey);
  }
  
  debug(`Fetching installed brew ${type}s...`);
  
  const startTime = performance.now();
  
  try {
    // Initialize Homebrew environment
    await initBrewEnvironment(timeoutMs * 0.2);
    
    // Now run the actual brew command with the proper environment
    const cmd = type === 'formula' ? BREW_CMD.LIST_FORMULAS_ONLY : BREW_CMD.LIST_CASKS_ONLY;
    debug(`Executing: ${cmd}`);
    
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || ''}`
    };
    
    const { stdout = '', stderr = '', exitCode } = await safeExecaCommand(cmd, {
      shell: true,
      reject: false,
      timeout: timeoutMs * 0.8, // Use 80% of the timeout for the command
      env,
    });
    
    const endTime = performance.now();
    debug(`Got ${type} list in ${(endTime - startTime).toFixed(2)}ms, exit code: ${exitCode}`);
    
    if (exitCode !== 0) {
      debug(`Error getting installed brew ${type}s: ${stderr}`);
      return [];
    }
    
    const packageList = typeof stdout === 'string' 
      ? stdout.trim().split('\n').map((line: string) => line.trim()).filter((line: string) => line !== '')
      : [];
    
    debug(`Found ${packageList.length} installed ${type}s`);
    
    // Cache the results
    responseCache.set(cacheKey, packageList);
    
    return packageList;
  } catch (error) {
    debug(`Error getting installed brew ${type}s: ${error}`);
    return [];
  }
}

/**
 * Checks if a Homebrew package (formula or cask) is installed
 * Uses caches if available
 * @param packageName The name of the package to check
 * @param isCask Whether the package is a cask or formula
 * @param timeoutMs Maximum time in milliseconds to wait for brew operations
 * @returns True if the package is installed, false otherwise
 */
export async function isBrewPackageInstalled(packageName: string, isCask: boolean = false, timeoutMs: number = 5000): Promise<boolean> {
  try {
    debug(`Checking if ${isCask ? 'cask' : 'formula'} ${packageName} is installed...`);
    
    // Try to use the cache first
    if (brewCacheInitialized) {
      const packageList = isCask ? brewCasksCache : brewFormulasCache;
      const isInstalled = packageList.includes(packageName);
      debug(`${packageName} is ${isInstalled ? '' : 'not '}installed (cache check)`);
      return isInstalled;
    }
    
    // Get the list of installed packages
    const packages = await getInstalledBrewPackages(isCask ? 'cask' : 'formula', { timeoutMs });
    
    // Check if the package is in the list
    const isInstalled = packages.includes(packageName);
    debug(`${packageName} is ${isInstalled ? '' : 'not '}installed`);
    
    return isInstalled;
  } catch (error) {
    debug(`Error checking if ${packageName} is installed: ${error}`);
    return false;
  }
}

// ================================================================
// Tool-specific Homebrew Utilities (moved from commands/tools/homebrew.ts)
// ================================================================
import { ToolConfig } from '../types';

/**
 * Represents a normalized Homebrew package configuration
 */
export interface NormalizedBrewConfig {
  packageName: string;
  isCask: boolean;
  hasTap: boolean;
  tapName?: string;
  tapUrl?: string;
  displayName: string;
}

/**
 * Normalizes brew package configuration for consistent access
 * @param brewConfig The raw brew configuration from tool config
 * @param toolId The ID of the tool (used as fallback)
 * @returns Normalized brew configuration with consistent access patterns
 */
export function normalizeBrewConfig(brewConfig: any, toolId: string): NormalizedBrewConfig {
  const result: NormalizedBrewConfig = {
    packageName: '',
    isCask: false,
    hasTap: false,
    displayName: ''
  };
  
  // Handle different types of brew configurations
  if (typeof brewConfig === 'string') {
    // Simple string package name
    result.packageName = brewConfig;
    result.displayName = brewConfig;
  } else if (typeof brewConfig === 'boolean' && brewConfig === true) {
    // Boolean true - use toolId as the package name
    result.packageName = toolId;
    result.displayName = toolId;
  } else if (typeof brewConfig === 'object' && brewConfig !== null) {
    // Object configuration with various properties
    
    // Handle name property
    if (brewConfig.name) {
      result.packageName = brewConfig.name;
      result.displayName = brewConfig.name;
    } else {
      // Fallback to toolId
      result.packageName = toolId;
      result.displayName = toolId;
    }
    
    // Handle cask property
    if (brewConfig.cask === true) {
      result.isCask = true;
    } else if (typeof brewConfig.cask === 'string') {
      result.isCask = true;
      result.packageName = brewConfig.cask;
      result.displayName = brewConfig.cask;
    }
    
    // Handle tap property
    if (brewConfig.tap) {
      result.hasTap = true;
      result.tapName = brewConfig.tap;
      
      if (brewConfig.tapUrl) {
        result.tapUrl = brewConfig.tapUrl;
      }
    }
  }
  
  return result;
}

/**
 * Gets the display string for a brew configuration (for logs and UI)
 */
export function getBrewDisplayString(brewConfig: any, toolId: string): string {
  const normalized = normalizeBrewConfig(brewConfig, toolId);
  
  let display = normalized.displayName;
  
  if (normalized.isCask) {
    display += ' (cask)';
  }
  
  if (normalized.hasTap && normalized.tapName) {
    display += ` (from tap: ${normalized.tapName})`;
  }
  
  return display;
}

/**
 * Determines the package name to use for checking if a brew package is installed
 * Domain-specific version that ensures consistent tool naming
 */
export function getToolBrewPackageName(brewConfig: any, toolId: string): string {
  return normalizeBrewConfig(brewConfig, toolId).packageName;
}

/**
 * Determines if a brew config specifies a cask
 * Domain-specific version for tool configurations
 */
export function isToolBrewCask(brewConfig: any): boolean {
  if (typeof brewConfig === 'object' && brewConfig !== null) {
    return brewConfig.cask === true || typeof brewConfig.cask === 'string';
  }
  return false;
} 
