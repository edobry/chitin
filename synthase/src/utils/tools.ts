/**
 * Shared tool utilities for handling tool configuration and status
 */
import { ToolConfig } from '../types';
import { DISPLAY } from './ui';
import { debug } from './logger';
import { shellPool } from './shell-pool';
import { isBrewPackageInstalled, isToolBrewCask, getToolBrewPackageName, initBrewEnvironment } from './homebrew';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

/**
 * Shell command check constants
 */
export const CHECK_CMD = {
  COMMAND_EXISTS: 'command -v'
} as const;

/**
 * Tool status enum representing installation state
 */
export enum ToolStatus {
  INSTALLED = 'installed',
  NOT_INSTALLED = 'not_installed',
  UNKNOWN = 'unknown',
  ERROR = 'error'
}

/**
 * Result of a tool status check
 */
export interface ToolStatusResult {
  status: ToolStatus;
  message?: string;       // Additional information about the status
  error?: Error;          // Error that occurred during check, if any
  output?: string;        // Output from the check command, if any
  checkDuration?: number; // Time in milliseconds taken to check this tool
}

/**
 * Get the emoji for a tool status
 * @param status Tool status result
 * @returns Emoji representing the status
 */
export function getStatusEmoji(status: ToolStatusResult): string {
  switch (status.status) {
    case ToolStatus.INSTALLED:
      return DISPLAY.EMOJIS.ENABLED;
    case ToolStatus.NOT_INSTALLED:
      return DISPLAY.EMOJIS.DISABLED;
    case ToolStatus.ERROR:
      return DISPLAY.EMOJIS.WARNING;
    case ToolStatus.UNKNOWN:
    default:
      return DISPLAY.EMOJIS.UNKNOWN;
  }
}

/**
 * Get the display name for a tool check method
 * @param config Tool configuration
 * @returns Check method display name
 */
export function getToolCheckMethod(config: ToolConfig): string {
  if (!config) return 'None';
  
  if (config.checkCommand) return 'Command';
  if (config.checkPath) return 'Path';
  if (config.checkEval) return 'Eval';
  if (config.brew) return 'Homebrew';
  if (config.checkBrew) return 'HomeBrew';
  if (config.pipx) return 'pipx';
  if (config.checkPipx) return 'pipx';
  
  return 'Command'; // Default is command -v check
}

/**
 * Get the display name for a tool installation method
 * @param config Tool configuration
 * @returns Installation method display name
 */
export function getToolInstallMethod(config: ToolConfig): string {
  if (!config) return 'None';
  
  if (config.command) return 'Command';
  if (config.script) return 'Script';
  if (config.git) return 'Git';
  if (config.brew) return 'Homebrew';
  if (config.npm) return 'NPM';
  if (config.pip) return 'PIP';
  if (config.pipx) return 'pipx';
  if (config.curl) return 'Curl';
  
  return 'None';
}

/**
 * Get the check command for a tool
 * @param commandName Command name to check
 * @returns Check command
 */
export function getCheckCommand(commandName: string): string {
  // Handle case where CHECK_CMD is an object with a cmd property
  if (typeof CHECK_CMD === 'object' && CHECK_CMD !== null && 'COMMAND_EXISTS' in CHECK_CMD) {
    return `${CHECK_CMD.COMMAND_EXISTS} ${commandName}`;
  }
  
  // Handle case where CHECK_CMD is a string
  if (typeof CHECK_CMD === 'string') {
    return `${CHECK_CMD} ${commandName}`;
  }
  
  // Fallback to command -v if CHECK_CMD is not usable
  return `command -v ${commandName}`;
}

/**
 * Legacy function to check tool status
 * @deprecated Use the newer checkToolStatus function with options object parameter
 */
export async function checkToolStatus(toolId: string, config: ToolConfig, timeoutMs: number = 2000): Promise<ToolStatusResult> {
  // For backwards compatibility, call the newer function
  return checkToolStatusWithOptions(toolId, config, { timeout: timeoutMs });
}

/**
 * Checks if a MacOS app bundle is installed in the Applications directory
 * @param appName App name to check, with or without .app extension
 * @returns Boolean indicating if the app is installed
 */
export function isAppBundleInstalled(appName: string): boolean {
  // Normalize app name - ensure it ends with .app
  const normalizedAppName = appName.endsWith('.app') ? appName : `${appName}.app`;
  
  // Standard application directories
  const standardAppDirs = [
    '/Applications',
    path.join(process.env.HOME || '', 'Applications')
  ];
  
  // Check each app directory
  for (const appDir of standardAppDirs) {
    const appPath = path.join(appDir, normalizedAppName);
    try {
      if (fs.existsSync(appPath)) {
        return true;
      }
    } catch (err) {
      // Ignore errors and continue checking
    }
  }
  
  return false;
}

/**
 * Generate variations of app names to check in case the user doesn't know the exact name
 * @param appName Base app name
 * @returns Array of app name variations
 */
export function generateAppNameVariations(appName: string): string[] {
  const variations: string[] = [];
  const baseName = appName.replace(/\.app$/, '');
  
  // Add the original name
  variations.push(appName);
  
  // Add with .app extension if not present
  if (!appName.endsWith('.app')) {
    variations.push(`${appName}.app`);
  }
  
  // Add capitalized version
  const capitalizedBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  variations.push(`${capitalizedBaseName}.app`);
  
  // Try common variants for certain tools (customize as needed)
  if (baseName.toLowerCase() === 'visual studio code') {
    variations.push('Visual Studio Code.app');
    variations.push('VSCode.app');
  }
  
  return variations.filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
}

// ================================================================
// Tool Status Functions (merged from tool-status.ts)
// ================================================================

/**
 * Default timeout for tool status checks
 */
export const DEFAULT_TOOL_TIMEOUT = 15000; // 15 seconds

/**
 * Check the status of a tool with standardized timeout and error handling
 * @param toolId Tool identifier
 * @param config Tool configuration
 * @param options Options for the status check
 * @returns Tool status result
 */
export async function checkToolStatusWithOptions(
  toolId: string, 
  config: ToolConfig, 
  options: { 
    timeout?: number,
    signal?: AbortSignal,
    ignoreTimeout?: boolean 
  } = {}
): Promise<ToolStatusResult> {
  // Use default timeout if not specified
  const timeoutMs = options.timeout || DEFAULT_TOOL_TIMEOUT;
  
  // Start timing the check
  const startTime = performance.now();
  
  // Create an AbortController for timeout handling unless signal is provided
  let controller: AbortController | null = options.signal ? null : new AbortController();
  const signal = options.signal || controller?.signal;
  
  // Set up timeout unless ignoreTimeout is true or a signal is provided
  let timeoutId: NodeJS.Timeout | null = null;
  if (!options.ignoreTimeout && !options.signal) {
    timeoutId = setTimeout(() => {
      debug(`Status check for ${toolId} timed out after ${timeoutMs}ms`);
      if (controller) {
        controller.abort(new Error(`Status check for ${toolId} timed out after ${timeoutMs}ms`));
        controller = null;
      }
      timeoutId = null;
    }, timeoutMs);
  }

  try {
    // Perform the actual status check
    const result = await performToolStatusCheck(toolId, config, { 
      timeoutMs, 
      signal 
    });
    
    // Calculate duration and add to result
    const duration = performance.now() - startTime;
    return {
      ...result,
      checkDuration: duration
    };
  } catch (error) {
    // Handle errors cleanly
    const duration = performance.now() - startTime;
    return {
      status: ToolStatus.ERROR,
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
      checkDuration: duration
    };
  } finally {
    // Cleanup resources
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Clear controller reference
    controller = null;
  }
}

/**
 * Internal function to perform the actual tool status check
 */
async function performToolStatusCheck(
  toolId: string, 
  config: ToolConfig, 
  options: {
    timeoutMs: number,
    signal?: AbortSignal
  }
): Promise<ToolStatusResult> {
  const { timeoutMs, signal } = options;
  
  // Helper to get check duration
  const getCheckDuration = () => performance.now() - performance.now();
  
  // If this is an optional tool, default status to UNKNOWN
  const isOptional = config.optional === true;
  const defaultStatus = isOptional ? ToolStatus.UNKNOWN : ToolStatus.NOT_INSTALLED;
  const defaultMessage = isOptional ? 'Optional tool with no check method' : 'Tool not installed';
  
  // Check for abort signal
  if (signal?.aborted) {
    throw signal.reason || new Error('Operation aborted');
  }
  
  // Initialize result
  const result: ToolStatusResult = {
    status: defaultStatus,
    message: defaultMessage
  };
  
  try {
    // First handle explicit check commands if provided
    if (config.checkCommand) {
      debug(`Checking ${toolId} with command: ${config.checkCommand}`);
      const commandStartTime = Date.now();
      
      try {
        // Convert checkCommand to string if it's a boolean
        const commandStr = typeof config.checkCommand === 'string' 
          ? config.checkCommand 
          : String(config.checkCommand);
        
        // Execute command via shell pool
        const cmdResult = await shellPool.executeCommand(commandStr, timeoutMs);
        const duration = Date.now() - commandStartTime;
        
        // Status is based on exit code, not stderr content
        if (cmdResult.exitCode === 0) {
          return {
            status: ToolStatus.INSTALLED,
            message: 'Tool command check succeeded',
            checkDuration: duration
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: 'Tool command check failed',
            output: cmdResult.stderr || cmdResult.stdout,
            checkDuration: duration
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error executing check command: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Then check for checkPath
    if (config.checkPath) {
      debug(`Checking ${toolId} with path: ${config.checkPath}`);
      try {
        const pathToCheck = config.checkPath;
        
        if (fs.existsSync(pathToCheck)) {
          return {
            status: ToolStatus.INSTALLED,
            message: `Path exists: ${pathToCheck}`,
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `Path does not exist: ${pathToCheck}`,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error checking path: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Check for checkEval (evaluated command)
    if (config.checkEval) {
      debug(`Checking ${toolId} with eval: ${config.checkEval}`);
      try {
        const evalCommand = config.checkEval;
        const evalResult = await shellPool.executeCommand(evalCommand, timeoutMs);
        
        if (evalResult.exitCode === 0) {
          return {
            status: ToolStatus.INSTALLED,
            message: 'Eval check succeeded',
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: 'Eval check failed',
            output: evalResult.stderr || evalResult.stdout,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error executing eval check: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Check for Homebrew
    if (config.brew || config.checkBrew) {
      const brewConfig = config.brew || config.checkBrew;
      const isCask = isToolBrewCask(brewConfig);
      const packageName = getToolBrewPackageName(brewConfig, toolId);
      
      debug(`Checking ${toolId} with brew ${isCask ? 'cask' : 'formula'}: ${packageName}`);
      
      try {
        // Ensure brew environment is initialized
        await initBrewEnvironment();
        
        // Check if the package is installed
        const isInstalled = await isBrewPackageInstalled(packageName, isCask);
        
        if (isInstalled) {
          return {
            status: ToolStatus.INSTALLED,
            message: `Homebrew ${isCask ? 'cask' : 'formula'} '${packageName}' is installed`,
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `Homebrew ${isCask ? 'cask' : 'formula'} '${packageName}' is not installed`,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error checking Homebrew installation: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Check for command name match using standard command exists check
    if (config.tool) {
      const commandToCheck = typeof config.tool === 'string' ? config.tool : toolId;
      debug(`Checking ${toolId} with generic command exists check: ${commandToCheck}`);
      
      try {
        const checkCmd = getCheckCommand(commandToCheck);
        const cmdResult = await shellPool.executeCommand(checkCmd, timeoutMs);
        
        if (cmdResult.exitCode === 0) {
          return {
            status: ToolStatus.INSTALLED,
            message: `Command '${commandToCheck}' exists in PATH`,
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `Command '${commandToCheck}' not found in PATH`,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error checking command '${commandToCheck}': ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Check for app bundle existence if this is a macOS app
    if (config.app) {
      const appName = typeof config.app === 'string' ? config.app : toolId;
      debug(`Checking ${toolId} with app bundle check: ${appName}`);
      
      try {
        // Try different variations of the app name
        const appVariations = generateAppNameVariations(appName);
        let isInstalled = false;
        
        for (const appVariation of appVariations) {
          if (isAppBundleInstalled(appVariation)) {
            isInstalled = true;
            break;
          }
        }
        
        if (isInstalled) {
          return {
            status: ToolStatus.INSTALLED,
            message: `App '${appName}' is installed`,
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `App '${appName}' is not installed`,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error checking app bundle '${appName}': ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // If we have a command property but no specific check, use that as a fallback
    if (config.command && typeof config.command === 'string') {
      const parts = config.command.split(' ');
      if (parts.length > 0) {
        const commandToCheck = parts[0];
        debug(`Checking ${toolId} with fallback command check: ${commandToCheck}`);
        
        try {
          const checkCmd = getCheckCommand(commandToCheck);
          const cmdResult = await shellPool.executeCommand(checkCmd, timeoutMs);
          
          if (cmdResult.exitCode === 0) {
            return {
              status: ToolStatus.INSTALLED,
              message: `Command '${commandToCheck}' exists in PATH (fallback check)`,
              checkDuration: getCheckDuration()
            };
          } else {
            return {
              status: ToolStatus.NOT_INSTALLED,
              message: `Command '${commandToCheck}' not found in PATH (fallback check)`,
              checkDuration: getCheckDuration()
            };
          }
        } catch (err) {
          // For fallback checks, don't report errors as failures
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `Command '${commandToCheck}' check failed: ${err instanceof Error ? err.message : String(err)}`,
            checkDuration: getCheckDuration()
          };
        }
      }
    }
    
    // Return the default status if no check method matched
    return result;
  } catch (error) {
    debug(`Unexpected error in tool status check for ${toolId}: ${error}`);
    return {
      status: ToolStatus.ERROR,
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
      checkDuration: getCheckDuration()
    };
  }
}

/**
 * Check tool status for multiple tools in parallel
 * @param tools Map of tool ID to configuration objects
 * @param options Options for batch operations
 * @returns Map of tool ID to status results
 */
export async function batchCheckToolStatus(
  tools: Map<string, ToolConfig>,
  options: {
    timeout?: number;
    concurrency?: number;
    onProgress?: (checked: number, total: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<Map<string, ToolStatusResult>> {
  const { 
    timeout = DEFAULT_TOOL_TIMEOUT,
    concurrency = 5,
    onProgress,
    signal
  } = options;
  
  // Initialize the results map
  const results = new Map<string, ToolStatusResult>();
  
  // If no tools to check, return empty results
  if (tools.size === 0) {
    return results;
  }
  
  // Queue of tools to check
  const queue = Array.from(tools.entries());
  
  // Track active jobs and completion
  let activeJobs = 0;
  let completedJobs = 0;
  let isAborted = false;
  
  // Function to process the next tool in the queue
  const processNext = async (): Promise<void> => {
    // Stop if signal is aborted
    if (signal?.aborted || isAborted) {
      isAborted = true;
      return;
    }
    
    // If queue is empty, we're done with this branch
    if (queue.length === 0) {
      return;
    }
    
    // Take the next tool from the queue
    const [toolId, config] = queue.shift()!;
    activeJobs++;
    
    try {
      // Check the tool status
      const result = await checkToolStatusWithOptions(toolId, config, {
        timeout,
        signal
      });
      
      // Add to results
      results.set(toolId, result);
      
      // Update progress
      completedJobs++;
      if (onProgress) {
        onProgress(completedJobs, tools.size);
      }
    } catch (error) {
      // Handle errors by setting an error status
      results.set(toolId, {
        status: ToolStatus.ERROR,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // Update progress for failed checks too
      completedJobs++;
      if (onProgress) {
        onProgress(completedJobs, tools.size);
      }
    } finally {
      // Decrement active job count
      activeJobs--;
      
      // Start next job if there are more in the queue
      if (queue.length > 0) {
        // Process next item in the queue
        processNext();
      }
    }
  };
  
  // Start up to concurrency jobs
  const startingJobs = Math.min(concurrency, queue.length);
  const startPromises = [];
  
  for (let i = 0; i < startingJobs; i++) {
    startPromises.push(processNext());
  }
  
  // Wait until all jobs complete or signal is aborted
  while (activeJobs > 0 || queue.length > 0) {
    if (signal?.aborted || isAborted) {
      isAborted = true;
      break;
    }
    
    // If we have room for more jobs, start them
    if (activeJobs < concurrency && queue.length > 0) {
      processNext();
    }
    
    // Brief pause to allow other jobs to proceed
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Return collected results
  return results;
} 
