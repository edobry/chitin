/**
 * Shared tool utilities for handling tool configuration and status
 */
import { ToolConfig } from '../types';
import { DISPLAY } from './ui';
import { debug } from './logger';
import { shellPool } from './shell-pool';
import { isBrewPackageInstalled, isBrewCask, getBrewPackageName } from './homebrew';
import * as fs from 'fs';
import * as path from 'path';

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
 * Checks if a tool is installed based on its configuration
 * Uses batched operations where possible for better performance
 * @param toolId Tool identifier
 * @param config Tool configuration
 * @param timeoutMs Maximum time in milliseconds to wait for check to complete
 * @returns Promise resolving to a ToolStatusResult
 */
export async function checkToolStatus(toolId: string, config: ToolConfig, timeoutMs: number = 2000): Promise<ToolStatusResult> {
  // Start timing the check
  const startTime = performance.now();
  
  let controller: AbortController | null = new AbortController();
  const { signal } = controller;
  
  // Create a timeout with proper cleanup
  let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
    debug(`Status check for ${toolId} timed out after ${timeoutMs}ms`);
    if (controller) {
      controller.abort(new Error(`Status check for ${toolId} timed out after ${timeoutMs}ms`));
      controller = null;
    }
    timeoutId = null;
  }, timeoutMs);

  try {
    // Use the abort signal for cancellation
    const result = await _checkToolStatus(toolId, config, timeoutMs, signal);
    
    // Clean up the timeout since we're done
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Clear controller
    controller = null;
    
    // Calculate duration and add to result
    const duration = performance.now() - startTime;
    return {
      ...result,
      checkDuration: duration
    };
  } catch (error) {
    // Clean up the timeout in case of error too
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Clear controller
    controller = null;
    
    const duration = performance.now() - startTime;
    return {
      status: ToolStatus.ERROR,
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
      checkDuration: duration
    };
  }
}

/**
 * Internal function to check tool status
 * @param toolId Tool identifier
 * @param config Tool configuration
 * @param timeoutMs Timeout in milliseconds
 * @param signal Abort signal
 * @returns Tool status result
 */
async function _checkToolStatus(
  toolId: string, 
  config: ToolConfig, 
  timeoutMs: number = 2000,
  signal?: AbortSignal
): Promise<ToolStatusResult> {
  // If this is an optional tool, mark as UNKNOWN if not otherwise determined
  const isOptional = config.optional === true;
  
  // Start timing the check
  const startTime = Date.now();
  
  const result: ToolStatusResult = {
    status: isOptional ? ToolStatus.UNKNOWN : ToolStatus.NOT_INSTALLED,
    message: isOptional ? 'Optional tool with no check method' : 'Tool not installed'
  };
  
  // Add a function to calculate check duration
  const getCheckDuration = () => Date.now() - startTime;
  
  try {
    // Check for abort signal
    if (signal?.aborted) {
      throw signal.reason || new Error('Operation aborted');
    }
    
    // First handle explicit check commands if provided
    if (config.checkCommand) {
      debug(`Checking ${toolId} with command: ${config.checkCommand}`);
      const startTime = Date.now();
      try {
        // Use shell pool for command execution
        const commandStr = typeof config.checkCommand === 'string' ? config.checkCommand : String(config.checkCommand);
        const result = await shellPool.executeCommand(commandStr, timeoutMs);
        const duration = Date.now() - startTime;
        
        // Status is based on exit code, not stderr content
        if (result.exitCode === 0) {
          return {
            status: ToolStatus.INSTALLED,
            message: 'Tool command check succeeded',
            checkDuration: duration
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: 'Tool command check failed',
            output: result.stderr || result.stdout,
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
          message: `Error checking path: ${err}`,
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
        const result = await shellPool.executeCommand(evalCommand, timeoutMs);
        
        if (result.exitCode === 0) {
          return {
            status: ToolStatus.INSTALLED,
            message: 'Eval check succeeded',
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: 'Eval check failed',
            output: result.stderr || result.stdout,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error executing eval check: ${err}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Check for brew installation
    if (config.brew || config.checkBrew) {
      const brewConfig = config.brew || config.checkBrew;
      const isCask = isBrewCask(brewConfig);
      const packageName = getBrewPackageName(brewConfig, toolId);
      
      debug(`Checking ${toolId} with brew ${isCask ? 'cask' : 'formula'}: ${packageName}`);
      
      try {
        const isInstalled = await isBrewPackageInstalled(packageName, isCask, timeoutMs);
        
        if (isInstalled) {
          return {
            status: ToolStatus.INSTALLED,
            message: `Homebrew ${isCask ? 'cask' : 'formula'} ${packageName} is installed`,
            checkDuration: getCheckDuration()
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `Homebrew ${isCask ? 'cask' : 'formula'} ${packageName} is not installed`,
            checkDuration: getCheckDuration()
          };
        }
      } catch (err) {
        return {
          status: ToolStatus.ERROR,
          message: `Error checking Homebrew package: ${err}`,
          error: err instanceof Error ? err : new Error(String(err)),
          checkDuration: getCheckDuration()
        };
      }
    }
    
    // Default - check if the command exists in PATH using command -v
    debug(`Checking ${toolId} with default command check`);
    try {
      // Use the command name as the tool ID
      const commandToCheck = getCheckCommand(toolId);
      const result = await shellPool.executeCommand(commandToCheck, timeoutMs);
      
      if (result.exitCode === 0) {
        return {
          status: ToolStatus.INSTALLED,
          message: 'Command found in PATH',
          checkDuration: getCheckDuration()
        };
      } else {
        return {
          status: ToolStatus.NOT_INSTALLED,
          message: 'Command not found in PATH',
          checkDuration: getCheckDuration()
        };
      }
    } catch (err) {
      debug(`Error checking command: ${err}`);
      
      // This is a soft error - we'll return NOT_INSTALLED rather than ERROR
      return {
        status: ToolStatus.NOT_INSTALLED,
        message: 'Command not found in PATH',
        checkDuration: getCheckDuration()
      };
    }
  } catch (err) {
    // General catch-all for unexpected errors
    return {
      status: ToolStatus.ERROR,
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err : new Error(String(err)),
      checkDuration: getCheckDuration()
    };
  }
}

/**
 * Check if an application bundle is installed
 * @param appName Application name
 * @returns True if installed
 */
export function isAppBundleInstalled(appName: string): boolean {
  // Check common installation paths for macOS applications
  const commonPaths = [
    '/Applications',
    path.join(process.env.HOME || '', 'Applications'),
    '/System/Applications'
  ];
  
  // Generate variations of the app name
  const appVariations = generateAppNameVariations(appName);
  
  // Check if any variation exists in any path
  for (const basePath of commonPaths) {
    for (const appVariation of appVariations) {
      const fullPath = path.join(basePath, appVariation);
      
      if (fs.existsSync(fullPath)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Generate variations of an app name for installation checking
 * @param appName Application name
 * @returns Array of possible app name variations
 */
export function generateAppNameVariations(appName: string): string[] {
  // Clean up app name
  const cleanName = appName.trim();
  
  // Start with exact name
  const variations: string[] = [];
  
  // Add .app extension if not already present
  if (!cleanName.endsWith('.app')) {
    variations.push(`${cleanName}.app`);
  } else {
    variations.push(cleanName);
  }
  
  // Add capitalized first letter version
  const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  if (!variations.includes(capitalizedName)) {
    if (!capitalizedName.endsWith('.app')) {
      variations.push(`${capitalizedName}.app`);
    } else {
      variations.push(capitalizedName);
    }
  }
  
  // Add all caps version
  const allCapsName = cleanName.toUpperCase();
  if (!variations.includes(allCapsName)) {
    if (!allCapsName.endsWith('.app')) {
      variations.push(`${allCapsName}.app`);
    } else {
      variations.push(allCapsName);
    }
  }
  
  return variations;
} 
