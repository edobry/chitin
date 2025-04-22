/**
 * Shared Homebrew utilities for the application
 */
import { safeExecaCommand } from './process';
import { debug } from './logger';
import { BREW_CMD, BREW_ENV } from '../constants';

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

/**
 * Initialize Homebrew caches for formulas and casks
 * @param timeoutMs Timeout in milliseconds
 * @returns True if initialization succeeded, false otherwise
 */
export async function initializeBrewCaches(timeoutMs: number = 5000): Promise<boolean> {
  if (brewCacheInitialized) {
    debug('Using already initialized Homebrew caches');
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

/**
 * Check if a brew config is for a cask
 * @param brewConfig Brew configuration
 * @returns True if it's a cask config
 * @deprecated Use domain-specific implementations like isToolBrewCask in commands/tools/homebrew.ts instead
 */
export function isBrewCask(brewConfig: any): boolean {
  if (!brewConfig) return false;
  
  if (typeof brewConfig === 'string') {
    return false; // Simple string configs are formulas by default
  }
  
  if (typeof brewConfig === 'object') {
    return brewConfig.cask === true || (typeof brewConfig.cask === 'string' && brewConfig.cask !== '');
  }
  
  return false;
}

/**
 * Get the package name from a brew configuration
 * @param brewConfig Brew configuration
 * @param toolId Tool ID to use as fallback
 * @returns Package name
 * @deprecated Use domain-specific implementations like getToolBrewPackageName in commands/tools/homebrew.ts instead
 */
export function getBrewPackageName(brewConfig: any, toolId: string): string {
  if (!brewConfig) return toolId;
  
  if (typeof brewConfig === 'string') {
    return brewConfig; // Simple string config
  }
  
  if (typeof brewConfig === 'object') {
    // If it's a cask config with a name
    if (isBrewCask(brewConfig) && typeof brewConfig.cask === 'string' && brewConfig.cask !== '') {
      return brewConfig.cask;
    }
    
    // Regular name field
    if (typeof brewConfig.name === 'string' && brewConfig.name !== '') {
      return brewConfig.name;
    }
    
    // Formula name
    if (typeof brewConfig.formula === 'string' && brewConfig.formula !== '') {
      return brewConfig.formula;
    }
  }
  
  return toolId; // Fallback to tool ID
} 
