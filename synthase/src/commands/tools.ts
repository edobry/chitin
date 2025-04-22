import { Command } from 'commander';
import { serializeToYaml } from '../utils';
import { loadAndValidateConfig } from './utils';
import { UserConfig, ToolConfig, FiberConfig, ChainConfig, Module } from '../types';
import { discoverModulesFromConfig } from '../modules/discovery';
import { loadYamlFile } from '../utils/yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';
import { execa, execaCommand } from 'execa';
import type { Options as ExecaOptions } from 'execa';
import { DISPLAY, BREW_CMD, CHECK_CMD, BREW_ENV, BREW } from '../constants';

const execAsync = promisify(exec);

// Define log levels
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

// Default to environment variable, or ERROR level if not set
let currentLogLevel: LogLevel = process.env.DEBUG === 'true' 
  ? LogLevel.DEBUG 
  : (process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL, 10) : LogLevel.ERROR);

// Function to set log level
export function setLogLevel(level: LogLevel | string): void {
  if (typeof level === 'string') {
    switch (level.toLowerCase()) {
      case 'none': currentLogLevel = LogLevel.NONE; break;
      case 'error': currentLogLevel = LogLevel.ERROR; break;
      case 'warn': currentLogLevel = LogLevel.WARN; break;
      case 'info': currentLogLevel = LogLevel.INFO; break;
      case 'debug': currentLogLevel = LogLevel.DEBUG; break;
      case 'trace': currentLogLevel = LogLevel.TRACE; break;
      default:
        const numLevel = parseInt(level, 10);
        if (!isNaN(numLevel) && numLevel >= 0 && numLevel <= 5) {
          currentLogLevel = numLevel;
        }
    }
  } else {
    currentLogLevel = level;
  }
  
  // Log the setting change at any level except NONE
  if (currentLogLevel > LogLevel.NONE) {
    console.log(`[LOG] Log level set to ${LogLevel[currentLogLevel]} (${currentLogLevel})`);
  }
}

// Enhanced logging function
export function log(level: LogLevel, ...args: any[]): void {
  if (level <= currentLogLevel) {
    const prefix = `[${LogLevel[level]}]`;
    console.log(prefix, ...args);
  }
}

// Debug utility now uses the log function with DEBUG level
function debug(...args: any[]): void {
  log(LogLevel.DEBUG, ...args);
}

// Global registry for tracking child processes
const processRegistry = {
  processes: new Set<ReturnType<typeof execa>>(),
  register(process: ReturnType<typeof execa>) {
    this.processes.add(process);
    // Remove from registry once completed
    process.finally(() => {
      this.processes.delete(process);
    });
    return process;
  },
  killAll() {
    debug(`Killing ${this.processes.size} remaining child processes`);
    for (const process of this.processes) {
      try {
        process.kill();
      } catch (error) {
        debug(`Error killing process: ${error}`);
      }
    }
    this.processes.clear();
  }
};

// Safe wrappers for execa functions that register processes
function safeExeca(file: string, args?: readonly string[], options?: ExecaOptions): ReturnType<typeof execa> {
  const process = execa(file, args, options);
  return processRegistry.register(process);
}

function safeExecaCommand(command: string, options?: ExecaOptions): ReturnType<typeof execaCommand> {
  const process = execaCommand(command, options);
  return processRegistry.register(process);
}

// At the top of the file, add/update the cache variables with proper typing
let brewFormulasCache: string[] = [];
let brewCasksCache: string[] = [];
let brewCacheInitialized = false;

// Add this function to initialize brew caches in a single operation
async function initializeBrewCaches(timeoutMs: number = 5000): Promise<boolean> {
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

// Add a new function to check if a brew package is installed using the caches
function isBrewPackageInstalledFromCache(packageName: string, isCask: boolean): boolean {
  if (!brewCacheInitialized) {
    debug('Warning: Brew cache not initialized when trying to check package');
    return false;
  }
  
  const packageList = isCask ? brewCasksCache : brewFormulasCache;
  return packageList.includes(packageName);
}

/**
 * Initialize the Homebrew environment
 * @param timeoutMs Timeout for the initialization
 * @returns True if initialization succeeded, false otherwise
 */
export async function initBrewEnvironment(timeoutMs: number = 1000): Promise<boolean> {
  try {
    debug('=== Initializing Homebrew environment (FIXED VERSION) ===');
    // First get the shellenv output
    debug('Running brew shellenv command...');
    const { stdout, exitCode, stderr } = await safeExecaCommand('/opt/homebrew/bin/brew shellenv', {
      shell: true,
      reject: false,
      timeout: timeoutMs
    });
    
    if (exitCode !== 0) {
      debug(`Homebrew environment initialization failed: ${stderr || 'unknown error'}`);
      return false;
    }
    
    // Add the environment variables from brew shellenv to the current process
    if (stdout && typeof stdout === 'string') {
      debug('Parsing and applying environment variables from brew shellenv output');
      const envVars = stdout.split('\n')
        .filter((line: string) => line.startsWith('export '))
        .map((line: string) => line.replace('export ', '').split('='))
        .filter((parts: string[]) => parts.length === 2);
      
      debug(`Found ${envVars.length} environment variables to set`);
      for (const [key, value] of envVars) {
        // Remove quotes if present
        const cleanValue = value.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        process.env[key] = cleanValue;
        debug(`Set ${key}=${cleanValue}`);
      }
      
      debug('Homebrew environment initialized successfully');
    } else {
      debug('No output from brew shellenv command');
    }
    
    return true;
  } catch (error) {
    debug(`Error initializing Homebrew environment: ${error}`);
    return false;
  }
}

// At the start of the file, add this helper function after the debug function
function getCheckCommand(commandName: string): string {
  // Handle case where CHECK_CMD is an object with a cmd property
  if (typeof CHECK_CMD === 'object' && CHECK_CMD !== null && 'cmd' in CHECK_CMD) {
    return `${CHECK_CMD.cmd} ${commandName}`;
  }
  
  // Handle case where CHECK_CMD is a string
  if (typeof CHECK_CMD === 'string') {
    return `${CHECK_CMD} ${commandName}`;
  }
  
  // Fallback to command -v if CHECK_CMD is not usable
  return `command -v ${commandName}`;
}

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

// Environment variables to make brew commands faster
// Using the constant imported from constants.ts

// Response cache for expensive operations
const responseCache = new Map<string, any>();

/**
 * Gets the list of installed Homebrew packages (formulas or casks)
 * Uses cached results if called multiple times
 * @param type 'formula' or 'cask'
 * @param options Optional parameters
 * @returns Promise resolving to array of installed package names
 */
async function getInstalledBrewPackages(type: 'formula' | 'cask', options: { timeoutMs?: number } = {}): Promise<string[]> {
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
    const cmd = type === 'formula' ? 'brew list --formula' : 'brew list --cask';
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
 * @param packageName The name of the package to check
 * @param toolId Optional tool ID for better debug logging
 * @param timeoutMs Maximum time in milliseconds to wait for brew operations
 * @returns True if the package is installed, false otherwise
 */
async function isBrewPackageInstalled(packageName: string, isCask: boolean = false, timeoutMs: number = 5000): Promise<boolean> {
  try {
    debug(`Checking if ${isCask ? 'cask' : 'formula'} ${packageName} is installed...`);
    
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
 * Creates a tools command
 * @returns Configured Command object
 */
export function createToolsCommand(): Command {
  const command = new Command('tools')
    .description('Manage and display configured tools')
    .option('-j, --json', 'Output as JSON instead of YAML')
    .option('-y, --yaml', 'Output as YAML')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-P, --parent-config <path>', 'Path to parent project config.yaml (where global tools are defined)')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .option('-l, --log-level <level>', 'Set logging level (none, error, warn, info, debug, trace, or 0-5)', 'error');

  // Create get subcommand (default behavior)
  const getCommand = new Command('get')
    .description('Display detailed information about tools')
    .option('-d, --detailed', 'Show detailed information for each tool')
    .option('--status', 'Check if tools are installed and show status')
    .option('--missing', 'Only show tools that are not installed (requires --status)')
    .option('--filter-source <source>', 'Filter tools by source module (e.g., "core", "dotfiles", "cloud:aws")')
    .option('--filter-check <method>', 'Filter tools by check method (command, brew, path, eval, optional)')
    .option('--filter-install <method>', 'Filter tools by install method (brew, git, script, artifact, command)')
    .argument('[tool]', 'Optional tool name to display details for')
    .action(async (toolName, options) => {
      const parentOptions = command.opts();
      const mergedOptions = { ...parentOptions, ...options };
      
      // Set log level before executing handler
      if (mergedOptions.logLevel) {
        setLogLevel(mergedOptions.logLevel);
      }
      
      await handleToolsCommand(toolName, mergedOptions);
    });

  // Create list subcommand
  const listCommand = new Command('list')
    .description('List all tool names, one per line')
    .option('--status', 'Check if tools are installed and show status')
    .option('--missing', 'Only show tools that are not installed (requires --status)')
    .option('--filter-source <source>', 'Filter tools by source module (e.g., "core", "dotfiles", "cloud:aws")')
    .option('--filter-check <method>', 'Filter tools by check method (command, brew, path, eval, optional)')
    .option('--filter-install <method>', 'Filter tools by install method (brew, git, script, artifact, command)')
    .action(async (options) => {
      const parentOptions = command.opts();
      const mergedOptions = { ...parentOptions, ...options };
      
      // Set log level before executing handler
      if (mergedOptions.logLevel) {
        setLogLevel(mergedOptions.logLevel);
      }
      
      await handleListCommand(mergedOptions);
    });

  // Add subcommands
  command.addCommand(getCommand);
  command.addCommand(listCommand);

  // Set default action to show help
  command.action(() => {
    command.help();
  });

  return command;
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

// The actual status checking logic moved to a separate function
async function _checkToolStatus(
  toolId: string, 
  config: ToolConfig, 
  timeoutMs: number = 2000,
  signal?: AbortSignal
): Promise<ToolStatusResult> {
  // If this is an optional tool, mark as UNKNOWN if not otherwise determined
  const isOptional = config.optional === true;
  
  // Start with default unknown status
  let result: ToolStatusResult = {
    status: ToolStatus.UNKNOWN,
  };

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
        // Use shell pool for command execution instead of safeExecaCommand
        const result = await shellPool.executeCommand(config.checkCommand, timeoutMs);
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
      } catch (error: any) {
        const duration = Date.now() - startTime;
        return {
          status: ToolStatus.ERROR,
          message: `Error checking tool: ${error.message}`,
          error: error as Error,
          checkDuration: duration
        };
      }
    }
    
    // Check using path if specified
    if (config.checkPath) {
      const checkPath = config.checkPath;
      debug(`Checking tool ${toolId} using path: ${checkPath}`);
      
      try {
        // First try the exact path as specified
        let exists = fs.existsSync(checkPath);
        
        // If not found and we have a git target, try to resolve against that
        if (!exists && config.git && config.git.target) {
          const gitTarget = config.git.target;
          
          // Try a few common patterns for git installations
          const possiblePaths = [
            path.join(gitTarget, checkPath),
            path.join(gitTarget, '..', checkPath),
            path.join(gitTarget, '..', '..', checkPath),
            path.join(path.dirname(gitTarget), checkPath),
            // Handle the special case where localshare is used
            path.join(process.env.HOME || '~', '.local/share', checkPath),
            // For target paths like localshare/zinit/zinit.git
            ...(gitTarget.includes('localshare') 
              ? [path.join(process.env.HOME || '~', '.local/share', gitTarget.split('localshare/')[1], checkPath)] 
              : [])
          ];
          
          debug(`Path not found at ${checkPath}, trying git target paths:`);
          for (const tryPath of possiblePaths) {
            debug(`- Trying ${tryPath}`);
            if (fs.existsSync(tryPath)) {
              debug(`Found at ${tryPath}`);
              exists = true;
              break;
            }
          }
        }
        
        if (exists) {
          result.status = ToolStatus.INSTALLED;
          result.message = `Path exists: "${checkPath}"`;
          return result;
        } else {
          result.status = ToolStatus.NOT_INSTALLED;
          result.message = `Path not found: "${checkPath}"`;
          return result;
        }
      } catch (error) {
        result.status = ToolStatus.ERROR;
        result.message = `Error checking path: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // Check if checkEval is specified
    if (config.checkEval) {
      debug(`Checking tool ${toolId} using eval: ${config.checkEval}`);
      
      try {
        // Execute the eval command using shell pool
        const result = await shellPool.executeCommand(config.checkEval, timeoutMs);
        
        if (result.exitCode === 0) {
          return {
            status: ToolStatus.INSTALLED,
            message: `Eval check successful`
          };
        } else {
          return {
            status: ToolStatus.NOT_INSTALLED,
            message: `Eval check failed with exit code ${result.exitCode}`
          };
        }
      } catch (error) {
        result.status = ToolStatus.ERROR;
        result.message = `Error executing eval check: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // Check for Homebrew package
    const shouldCheckBrew = config[BREW.CHECK_PREFIX] || (config.brew && !config.artifact && !config.pipx);
    if (shouldCheckBrew) {
      debug(`Checking tool ${toolId} as Homebrew package`);
      
      // Determine if this is a cask
      const isCask = config[BREW.CHECK_PREFIX]
        ? isBrewCask(config[BREW.CHECK_PREFIX])
        : isBrewCask(config.brew || {});
      
      // Get the package name
      const brewName = config[BREW.CHECK_PREFIX]
        ? getBrewPackageName(config[BREW.CHECK_PREFIX], toolId)
        : getBrewPackageName(config.brew || {}, toolId);
      
      debug(`Checking if Homebrew ${isCask ? 'cask' : 'formula'} "${brewName}" is installed using cache...`);
      
      try {
        // Make sure Homebrew caches are initialized
        if (!brewCacheInitialized) {
          const cacheInitialized = await initializeBrewCaches(timeoutMs * 0.5);
          if (!cacheInitialized) {
            throw new Error("Failed to initialize Homebrew caches");
          }
        }
        
        // Check against cached lists instead of running brew command
        const isInstalled = isBrewPackageInstalledFromCache(brewName, isCask);
        
        if (isInstalled) {
          result.status = ToolStatus.INSTALLED;
          result.message = `Found as Homebrew ${isCask ? BREW.CASK : BREW.FORMULA} "${brewName}"`;
          return result;
        } else {
          result.status = ToolStatus.NOT_INSTALLED;
          result.message = `Homebrew ${isCask ? BREW.CASK : BREW.FORMULA} "${brewName}" not found`;
          return result;
        }
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason || new Error('Operation aborted');
        }
        
        result.status = ToolStatus.ERROR;
        result.message = `Error checking Homebrew package: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // If we get here and the user hasn't specified any check method, default to checking for CLI command
    if (!config.checkCommand && !config.checkPath && !config.checkEval && !shouldCheckBrew) {
      // If there's a defined command, use that as the tool ID
      const command = config.command || toolId;
      debug(`Defaulting to checking "${command}" as command in PATH`);
      
      try {
        // Use the shell pool to execute the which command
        const { exitCode, stdout, stderr } = await shellPool.executeCommand(`which "${command}"`, timeoutMs);
        
        debug(`Exit code: ${exitCode}, Stdout: ${stdout}, Stderr: ${stderr}`);
        
        if (exitCode === 0) {
          result.status = ToolStatus.INSTALLED;
          result.message = `Command '${command}' found in PATH: ${stdout}`;
          return result;
        } else {
          result.status = ToolStatus.NOT_INSTALLED;
          result.message = `Command '${command}' not found in PATH`;
          return result;
        }
      } catch (error) {
        result.status = ToolStatus.ERROR;
        result.message = `Error checking command in PATH: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // If we get here and haven't returned yet, default to UNKNOWN for optional tools
    if (isOptional) {
      result.status = ToolStatus.UNKNOWN;
      result.message = 'Tool is optional and no check method succeeded';
      return result;
    }
    
    // If we get here, we couldn't determine the status
    result.message = 'Could not determine tool status - no valid check method';
    return result;
    
  } catch (error) {
    // Catch-all for any unexpected errors
    return {
      status: ToolStatus.ERROR,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Gets the status indicator emoji based on tool status
 * @param status Tool status result
 * @returns Emoji indicator for the status
 */
export function getStatusEmoji(status: ToolStatusResult): string {
  switch (status.status) {
    case ToolStatus.INSTALLED:
      return DISPLAY.EMOJIS.ENABLED; // Green circle for installed
    case ToolStatus.NOT_INSTALLED:
      return DISPLAY.EMOJIS.DISABLED; // Red circle for not installed
    case ToolStatus.ERROR:
      return DISPLAY.EMOJIS.WARNING; // Warning for error
    case ToolStatus.UNKNOWN:
    default:
      return DISPLAY.EMOJIS.UNKNOWN; // White circle for unknown
  }
}

/**
 * Filters tools based on source, check method, and install method
 * @param tools Map of tool IDs to their configurations and source
 * @param options Filter options
 * @returns Filtered map of tools
 */
function filterTools(
  tools: Map<string, { config: ToolConfig, source: string }>,
  options: { filterSource?: string, filterCheck?: string, filterInstall?: string }
): Map<string, { config: ToolConfig, source: string }> {
  if (!options.filterSource && !options.filterCheck && !options.filterInstall) {
    return tools; // No filters applied
  }

  const filteredTools = new Map();

  for (const [toolId, toolData] of tools.entries()) {
    let includeItem = true;

    // Filter by source
    if (options.filterSource && !toolData.source.includes(options.filterSource)) {
      includeItem = false;
    }

    // Filter by check method
    if (options.filterCheck && includeItem) {
      const checkType = getToolCheckMethod(toolData.config);
      const normalizedCheckMethod = options.filterCheck.toLowerCase();

      // Match simplified check method type
      if (normalizedCheckMethod !== checkType.toLowerCase()) {
        includeItem = false;
      }
    }

    // Filter by install method
    if (options.filterInstall && includeItem) {
      const installType = getToolInstallMethod(toolData.config);
      const normalizedInstallMethod = options.filterInstall.toLowerCase();

      // Match simplified install method type
      if (normalizedInstallMethod !== installType.toLowerCase()) {
        includeItem = false;
      }
    }

    if (includeItem) {
      filteredTools.set(toolId, toolData);
    }
  }

  return filteredTools;
}

/**
 * Gets the check method for a tool
 * @param config Tool configuration
 * @returns The check method type as a string
 */
function getToolCheckMethod(config: ToolConfig): string {
  if (config.checkCommand) {
    return 'command';
  } else if (config[BREW.CHECK_PREFIX]) {
    return BREW.COMMAND;
  } else if (config.checkPath) {
    return 'path';
  } else if (config.checkEval) {
    return 'eval';
  } else if (config.optional) {
    return 'optional';
  }
  
  return 'command'; // Default
}

/**
 * Gets the install method for a tool
 * @param config Tool configuration
 * @returns The install method type as a string
 */
function getToolInstallMethod(config: ToolConfig): string {
  if (config.brew) {
    return BREW.COMMAND;
  } else if (config.git) {
    return 'git';
  } else if (config.script) {
    return 'script';
  } else if (config.command) {
    return 'command';
  } else if (config.artifact) {
    return 'artifact';
  }
  
  return 'unknown';
}

/**
 * Handle the tools list subcommand
 * @param options Command options
 */
async function handleListCommand(options: any): Promise<void> {
  try {
    // Validate options
    if (options.missing && !options.status) {
      console.error('Error: --missing option requires --status');
      process.exit(1);
    }

    // Load configuration just like in the main command
    const { config, validation } = await loadAndValidateConfig({
      userConfigPath: options.path,
      exitOnError: false
    });
    
    if (!validation.valid) {
      console.error('Configuration validation warnings:');
      validation.errors.forEach(error => console.error(`- ${error}`));
    }

    // Try to load parent config if provided or attempt auto-detection
    let parentConfig: any = {};
    let parentConfigPath = '';
    
    if (options.parentConfig) {
      try {
        parentConfigPath = options.parentConfig;
        parentConfig = loadParentConfig(parentConfigPath);
        debug(`Loaded parent config from ${parentConfigPath}`);
      } catch (error) {
        console.error(`Error loading parent config: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // Try to auto-detect parent config
      try {
        // Assuming Synthase is in a subdirectory of the Chitin project
        const possiblePaths = [
          path.resolve(process.cwd(), '..', 'config.yaml'),
          path.resolve(process.cwd(), '..', '..', 'config.yaml'),
          path.resolve(process.cwd(), 'config.yaml'),
        ];
        
        for (const configPath of possiblePaths) {
          try {
            if (fs.existsSync(configPath)) {
              parentConfigPath = configPath;
              parentConfig = loadParentConfig(configPath);
              debug(`Auto-detected parent config at ${configPath}`);
              break;
            }
          } catch (e) {
            // Skip this path
          }
        }
      } catch (error) {
        debug('Could not auto-detect parent config file');
      }
    }

    // Merge parent config with current config
    const mergedConfig = { ...config };
    
    // Merge tools from parent config
    if (parentConfig && parentConfig.tools) {
      mergedConfig.tools = { 
        ...(mergedConfig.tools || {}), 
        ...parentConfig.tools 
      };
      
      debug(`Merged ${Object.keys(parentConfig.tools).length} tools from parent config`);
    }
    
    // Merge toolDeps from parent config
    if (parentConfig && Array.isArray(parentConfig.toolDeps)) {
      mergedConfig.toolDeps = [
        ...(Array.isArray(mergedConfig.toolDeps) ? mergedConfig.toolDeps : []),
        ...parentConfig.toolDeps
      ];
      
      debug(`Merged ${parentConfig.toolDeps.length} toolDeps from parent config`);
    }

    // Discover modules from configuration
    debug('Discovering modules from configuration...');
    const moduleResult = await discoverModulesFromConfig(
      mergedConfig,
      options.baseDirs || []
    );

    if (moduleResult.errors.length > 0) {
      debug('Module discovery errors:');
      for (const error of moduleResult.errors) {
        debug(`- ${error}`);
      }
    }

    debug('Extracting tools from configuration and discovered modules...');
    // Extract all tools from the configuration and discovered modules
    let tools = extractAllTools(
      mergedConfig, 
      moduleResult.modules,
      parentConfigPath ? path.basename(path.dirname(parentConfigPath)) : ''
    );
    
    // Apply filters
    tools = filterTools(tools, {
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });

    // If --status and --missing are specified, filter out installed tools
    if (options.status && options.missing) {
      debug('Checking tool status to filter missing tools...');
      
      // Create a new map to store filtered tools
      const missingTools = new Map();
      let checkedCount = 0;
      
      // Show progress indicator
      if (tools.size > 10) {
        process.stdout.write(`Checking tool status (0/${tools.size})...\r`);
      }
      
      // Check each tool and only keep the ones that are not installed
      for (const [toolId, toolData] of tools.entries()) {
        try {
          const status = await checkToolStatus(toolId, toolData.config);
          if (status.status === ToolStatus.NOT_INSTALLED) {
            missingTools.set(toolId, toolData);
          }
          
          // Update progress
          checkedCount++;
          if (tools.size > 10 && checkedCount % 5 === 0) {
            process.stdout.write(`Checking tool status (${checkedCount}/${tools.size})...\r`);
          }
        } catch (error) {
          debug(`Error checking tool ${toolId}: ${error}`);
          // For list view, we'll skip tools with errors when filtering
        }
      }
      
      // Clear progress indicator
      if (tools.size > 10) {
        process.stdout.write(' '.repeat(50) + '\r');
      }
      
      // Show summary
      const missingCount = missingTools.size;
      const totalCount = tools.size;
      console.error(`Found ${missingCount} missing tools out of ${totalCount} total tools.`);
      
      // Replace the tools map with the filtered one
      tools = missingTools;
    }
    
    // Handle JSON or YAML output
    if (options.json || options.yaml) {
      const toolIds = Array.from(tools.keys()).sort();
      if (options.json) {
        console.log(JSON.stringify(toolIds));
      } else {
        console.log(serializeToYaml({ tools: toolIds }));
      }
      return;
    }

    // Output one tool name per line to stdout
    const toolNames = Array.from(tools.keys()).sort();
    for (const toolName of toolNames) {
      console.log(toolName);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Handle the main tools command (get subcommand)
 * @param toolName Optional tool name to filter by
 * @param options Command options
 */
async function handleToolsCommand(toolName: string | undefined, options: any): Promise<void> {
  try {
    // Reset Homebrew caches at the start of each command
    brewFormulasCache = [];
    brewCasksCache = [];
    brewCacheInitialized = false;
    
    // Validate options
    if (options.missing && !options.status) {
      console.error('Error: --missing option requires --status');
      process.exit(1);
    }

    debug('Loading configuration...');
    // Load and validate configuration
    const { config, validation } = await loadAndValidateConfig({
      userConfigPath: options.path,
      exitOnError: false
    });
    
    if (!validation.valid) {
      console.error('Configuration validation warnings:');
      validation.errors.forEach(error => console.error(`- ${error}`));
    }

    // Try to load parent config if provided or attempt auto-detection
    let parentConfig: any = {};
    let parentConfigPath = '';
    
    if (options.parentConfig) {
      try {
        parentConfigPath = options.parentConfig;
        parentConfig = loadParentConfig(parentConfigPath);
        debug(`Loaded parent config from ${parentConfigPath}`);
      } catch (error) {
        console.error(`Error loading parent config: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // Try to auto-detect parent config
      try {
        // Assuming Synthase is in a subdirectory of the Chitin project
        const possiblePaths = [
          path.resolve(process.cwd(), '..', 'config.yaml'),
          path.resolve(process.cwd(), '..', '..', 'config.yaml'),
          path.resolve(process.cwd(), 'config.yaml'),
        ];
        
        for (const configPath of possiblePaths) {
          try {
            if (fs.existsSync(configPath)) {
              parentConfigPath = configPath;
              parentConfig = loadParentConfig(configPath);
              debug(`Auto-detected parent config at ${configPath}`);
              break;
            }
          } catch (e) {
            // Skip this path
          }
        }
      } catch (error) {
        debug('Could not auto-detect parent config file');
      }
    }

    // Merge parent config with current config
    const mergedConfig = { ...config };
    
    // Merge tools from parent config
    if (parentConfig && parentConfig.tools) {
      mergedConfig.tools = { 
        ...(mergedConfig.tools || {}), 
        ...parentConfig.tools 
      };
      
      debug(`Merged ${Object.keys(parentConfig.tools).length} tools from parent config`);
    }
    
    // Merge toolDeps from parent config
    if (parentConfig && Array.isArray(parentConfig.toolDeps)) {
      mergedConfig.toolDeps = [
        ...(Array.isArray(mergedConfig.toolDeps) ? mergedConfig.toolDeps : []),
        ...parentConfig.toolDeps
      ];
      
      debug(`Merged ${parentConfig.toolDeps.length} toolDeps from parent config`);
    }

    // Discover modules from configuration (similar to fibers command)
    debug('Discovering modules from configuration...');
    const moduleResult = await discoverModulesFromConfig(
      mergedConfig,
      options.baseDirs || []
    );

    if (moduleResult.errors.length > 0) {
      debug('Module discovery errors:');
      for (const error of moduleResult.errors) {
        debug(`- ${error}`);
      }
    }

    debug('Extracting tools from configuration and discovered modules...');
    // Extract all tools from the configuration and discovered modules
    let tools = extractAllTools(
      mergedConfig, 
      moduleResult.modules,
      parentConfigPath ? path.basename(path.dirname(parentConfigPath)) : ''
    );
    
    // Apply filters
    tools = filterTools(tools, {
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });
    
    // Handle JSON or YAML output
    if (options.json) {
      if (toolName) {
        const tool = tools.get(toolName);
        if (tool) {
          console.log(JSON.stringify({ [toolName]: tool.config }, null, 2));
        } else {
          console.error(`Tool '${toolName}' not found`);
          process.exit(1);
        }
      } else {
        console.log(JSON.stringify(Object.fromEntries(
          Array.from(tools.entries()).map(([id, data]) => [id, data.config])
        ), null, 2));
      }
      return;
    } else if (options.yaml) {
      if (toolName) {
        const tool = tools.get(toolName);
        if (tool) {
          console.log(serializeToYaml({ [toolName]: tool.config }));
        } else {
          console.error(`Tool '${toolName}' not found`);
          process.exit(1);
        }
      } else {
        const toolsObj = Object.fromEntries(
          Array.from(tools.entries()).map(([id, data]) => [id, data.config])
        );
        console.log(serializeToYaml({ tools: toolsObj }));
      }
      return;
    }

    // If a specific tool name was provided, only display that one
    if (toolName) {
      const tool = tools.get(toolName);
      if (tool) {
        if (options.status) {
          const status = await checkToolStatus(toolName, tool.config);
          await displaySingleTool(toolName, tool, { ...options, statusResult: status });
        } else {
          await displaySingleTool(toolName, tool, options);
        }
      } else {
        console.error(`Tool '${toolName}' not found`);
        process.exit(1);
      }
      return;
    }

    // Display all tools
    await displayTools(tools, { 
      detailed: options.detailed, 
      status: options.status, 
      missing: options.missing,
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });
    
    // Ensure all processes are terminated
    processRegistry.killAll();
    debug('All command operations completed and processes terminated');
  } catch (error) {
    // Clean up even on error
    processRegistry.killAll();
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Loads a parent config.yaml file
 * @param filePath Path to the config.yaml file
 * @returns Parsed YAML content
 */
function loadParentConfig(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * Extracts all tools from the configuration and discovered modules
 * @param config User configuration
 * @param modules Discovered modules
 * @param rootModuleName Name of the root module (where config.yaml is located)
 * @returns Map of tool IDs to their configurations and source
 */
function extractAllTools(
  config: UserConfig, 
  modules: Module[] = [],
  rootModuleName: string = ''
): Map<string, { config: ToolConfig, source: string }> {
  const tools = new Map<string, { config: ToolConfig, source: string }>();
  
  debug('Extracting tools from configuration...');
  
  // Debug the config keys
  debug('Top-level configuration keys:');
  for (const key of Object.keys(config)) {
    debug(`- ${key} (${typeof config[key]})`);
  }
  
  // Look for dedicated tools section in Chitin-style (at top level)
  // This is how tools are defined in the main Chitin config.yaml
  if (config.tools && typeof config.tools === 'object') {
    debug('Found top-level tools section, processing tools...');
    
    const moduleName = rootModuleName || 'chitin';
    
    for (const [toolId, toolConfig] of Object.entries(config.tools)) {
      if (typeof toolConfig === 'object' && toolConfig !== null) {
        debug(`Adding tool: ${toolId}`);
        tools.set(toolId, { 
          config: toolConfig as ToolConfig, 
          source: moduleName 
        });
      }
    }
  }
  
  // Look for toolDeps array at the top level (used in Chitin)
  if (Array.isArray(config.toolDeps)) {
    debug('Found top-level toolDeps array with:', config.toolDeps);
    const moduleName = rootModuleName || 'chitin';
    
    for (const toolId of config.toolDeps) {
      if (!tools.has(toolId)) {
        debug(`Adding tool reference from toolDeps: ${toolId}`);
        tools.set(toolId, { 
          config: { optional: false } as ToolConfig, 
          source: `${moduleName}:toolDeps` 
        });
      }
    }
  }
  
  // Process each fiber module to extract its tools
  const fiberModules = modules.filter(m => m.type === 'fiber');
  debug(`Found ${fiberModules.length} fiber modules in discovery results`);
  
  // DEBUG - Print out all fiber module configs to see what's available
  debug('Fiber module configs:');
  for (const fiberModule of fiberModules) {
    debug(`Fiber ${fiberModule.id} config:`, JSON.stringify(fiberModule.config, null, 2));
  }
  
  for (const fiberModule of fiberModules) {
    const fiberId = fiberModule.id;
    debug(`Processing fiber module: ${fiberId}`);
    
    // Use the module's config directly, not from the merged config
    const fiberConfig = fiberModule.config || {};
    
    // Look for tools in fiber-level config
    if (fiberConfig.tools && typeof fiberConfig.tools === 'object') {
      debug(`Found tools section in fiber: ${fiberId}`);
      
      for (const [toolId, toolConfig] of Object.entries(fiberConfig.tools)) {
        debug(`Adding tool from fiber ${fiberId}: ${toolId}`);
        tools.set(toolId, { 
          config: toolConfig as ToolConfig, 
          source: fiberId 
        });
      }
    }
    
    // Look for toolDeps in this fiber (used in Chitin)
    if (Array.isArray(fiberConfig.toolDeps)) {
      debug(`Found toolDeps in fiber ${fiberId}:`, fiberConfig.toolDeps);
      
      for (const toolId of fiberConfig.toolDeps) {
        if (!tools.has(toolId)) {
          debug(`Adding tool reference from ${fiberId}.toolDeps: ${toolId}`);
          tools.set(toolId, { 
            config: { optional: false } as ToolConfig, 
            source: `${fiberId}:toolDeps` 
          });
        }
      }
    }
  }
  
  // Process each chain module to extract its tools
  const chainModules = modules.filter(m => m.type === 'chain');
  debug(`Found ${chainModules.length} chain modules in discovery results`);
  
  for (const chainModule of chainModules) {
    const chainId = chainModule.id;
    const parentFiberId = chainModule.parentFiberId || 'standalone';
    debug(`Processing chain module: ${chainId} (parent: ${parentFiberId})`);
    
    // Get chain configuration from the module or the merged config
    let chainConfig: any = {};
    
    // First check if there's config in the module
    if (chainModule.config && typeof chainModule.config === 'object') {
      chainConfig = chainModule.config;
    }
    
    // Then try to get it from the merged config
    if (config[parentFiberId]?.moduleConfig?.[chainId]) {
      chainConfig = { ...chainConfig, ...config[parentFiberId].moduleConfig[chainId] };
    }
    
    // In Chitin, a simple 'tool' property can specify a tool requirement
    if (typeof chainConfig === 'object' && chainConfig !== null && 'tool' in chainConfig) {
      const toolId = chainConfig.tool;
      if (typeof toolId === 'string') {
        debug(`Found single tool reference in ${parentFiberId}.${chainId}: ${toolId}`);
        
        if (!tools.has(toolId)) {
          debug(`Adding tool reference from ${parentFiberId}.${chainId}.tool: ${toolId}`);
          // Avoid redundant fiberId:fiberId format when chain name is the same as the fiber
          const source = parentFiberId === chainId ? parentFiberId : `${parentFiberId}:${chainId}`;
          tools.set(toolId, { 
            config: { optional: false } as ToolConfig, 
            source: source
          });
        }
      }
    }
    
    // Check for the tools object in the chain
    if (chainConfig.tools && typeof chainConfig.tools === 'object') {
      debug(`Found tools in chain ${parentFiberId}.${chainId}`);
      
      for (const [toolId, toolConfig] of Object.entries(chainConfig.tools)) {
        debug(`Adding tool from chain ${parentFiberId}.${chainId}: ${toolId}`);
        // Avoid redundant fiberId:fiberId format when chain name is the same as the fiber
        const source = parentFiberId === chainId ? parentFiberId : `${parentFiberId}:${chainId}`;
        tools.set(toolId, { 
          config: toolConfig as ToolConfig, 
          source: source
        });
      }
    }
    
    // Check for toolDeps array in the chain (used in Chitin)
    if (Array.isArray(chainConfig.toolDeps)) {
      debug(`Found toolDeps in chain ${parentFiberId}.${chainId}:`, chainConfig.toolDeps);
      
      for (const toolId of chainConfig.toolDeps) {
        if (!tools.has(toolId)) {
          debug(`Adding tool reference from ${parentFiberId}.${chainId}.toolDeps: ${toolId}`);
          // Avoid redundant fiberId:fiberId format when chain name is the same as the fiber
          const source = parentFiberId === chainId ? `${parentFiberId}:toolDeps` : `${parentFiberId}:${chainId}:toolDeps`;
          tools.set(toolId, { 
            config: { optional: false } as ToolConfig, 
            source: source
          });
        }
      }
    }
  }
  
  // Extract tools from moduleConfig in fibers 
  // (for any configs not captured by the module discovery)
  for (const [fiberId, fiberConfig] of Object.entries(config)) {
    if (fiberId === 'tools' || fiberId === 'toolDeps' || typeof fiberConfig !== 'object' || fiberConfig === null) {
      continue;
    }
    
    const fiber = fiberConfig as FiberConfig;
    
    // Extract tools from chains in the fiber
    if (fiber.moduleConfig && typeof fiber.moduleConfig === 'object') {
      for (const [chainId, moduleConfig] of Object.entries(fiber.moduleConfig)) {
        const chain = moduleConfig as ChainConfig;
        
        // In Chitin, a simple 'tool' property can specify a tool requirement
        if (typeof chain === 'object' && chain !== null && 'tool' in chain) {
          const toolId = (chain as any).tool;
          if (typeof toolId === 'string') {
            debug(`Found single tool reference in ${fiberId}.${chainId}: ${toolId}`);
            
            if (!tools.has(toolId)) {
              debug(`Adding tool reference from ${fiberId}.${chainId}.tool: ${toolId}`);
              // Avoid redundant fiberId:fiberId format when chain name is the same as the fiber
              const source = fiberId === chainId ? fiberId : `${fiberId}:${chainId}`;
              tools.set(toolId, { 
                config: { optional: false } as ToolConfig, 
                source: source 
              });
            }
          }
        }
      }
    }
  }
  
  debug(`Total tools found: ${tools.size}`);
  
  return tools;
}

/**
 * Displays a single tool in a formatted way
 * @param toolId The ID of the tool to display
 * @param toolData The tool data (config and source)
 * @param options Display options
 */
async function displaySingleTool(
  toolId: string,
  toolData: { config: ToolConfig, source: string },
  options: { detailed?: boolean, status?: boolean, statusResult?: ToolStatusResult }
): Promise<void> {
  console.log(''); // Keep just an empty line for spacing
  
  // If we have a status result, display it with the tool name
  if (options.statusResult) {
    const statusEmoji = getStatusEmoji(options.statusResult);
    console.log(`  ${statusEmoji} 🔧 ${toolId}`);
  } else {
    console.log(`  ${DISPLAY.EMOJIS.TOOL} ${toolId}`);
  }
  
  console.log('');
  
  // Display source
  console.log(`  Source: ${toolData.source}`);
  
  // Display check method
  displayCheckMethod(toolId, toolData.config);
  
  // Display install method
  displayInstallMethod(toolData.config);
  
  // Display additional properties in detailed mode
  if (options.detailed) {
    displayAdditionalInfo(toolData.config);
  }
  
  // If status checking was requested but we don't have a result yet, check now
  if (options.status === true && !options.statusResult) {
    console.log(`  Status: Checking...`);
    try {
      const status = await checkToolStatus(toolId, toolData.config);
      const statusEmoji = getStatusEmoji(status);
      console.log(`  Status: ${formatStatus(status.status)}${status.message ? ' - ' + status.message : ''}`);
      
      // If not installed, show installation hint
      if (status.status === ToolStatus.NOT_INSTALLED) {
        showInstallationHint(toolId, toolData.config);
      }
    } catch (error) {
      console.log(`  Status: ${DISPLAY.EMOJIS.WARNING} Error checking status`);
    }
  } else if (options.statusResult) {
    // Show the status if we have a result
    const status = options.statusResult;
    
    // More concise status display - only show message for errors/unknown status
    // or if we're in debug mode
    if (status.status === ToolStatus.ERROR || status.status === ToolStatus.UNKNOWN || isDebugMode()) {
      console.log(`  Status: ${formatStatus(status.status)}${status.message ? ` - ${status.message}` : ''}`);
    } else {
      // Just show the status without detailed message for successful/not installed cases
      console.log(`  Status: ${formatStatus(status.status)}`);
    }
    
    // If not installed, show installation hint
    if (status.status === ToolStatus.NOT_INSTALLED) {
      showInstallationHint(toolId, toolData.config);
    }
  }
  
  console.log(''); // Keep just an empty line for spacing
}

/**
 * Displays the tools in a formatted way
 * @param tools Map of tools to display
 * @param options Display options
 */
async function displayTools(
  tools: Map<string, { config: ToolConfig, source: string }>,
  options: { detailed?: boolean, status?: boolean, missing?: boolean, filterSource?: string, filterCheck?: string, filterInstall?: string }
): Promise<void> {
  console.log('Legend: 🔧 = tool   🔍 = check method   🏗️ = install method   🔗 = reference');
  if (options.status) {
    console.log(`Status: ${DISPLAY.EMOJIS.ENABLED} = installed   ${DISPLAY.EMOJIS.DISABLED} = not installed   ${DISPLAY.EMOJIS.WARNING} = error   ${DISPLAY.EMOJIS.UNKNOWN} = unknown`);
    
    if (options.missing) {
      console.log('Showing only missing/not installed tools');
    }
  }
  console.log('');
  
  if (tools.size === 0) {
    console.log('No tools configured.');
    return;
  }

  // Separate full tools from references
  const fullTools = new Map();
  const toolReferences = new Map();
  
  // Categorize tools as either full configs or references
  for (const [toolId, toolData] of tools.entries()) {
    const hasFullConfig = 
      Object.keys(toolData.config).some(key => 
        ['checkCommand', 'checkBrew', 'checkPath', 'brew', 'git', 'script', 'command', 'artifact'].includes(key));
    
    if (hasFullConfig) {
      fullTools.set(toolId, toolData);
    } else {
      toolReferences.set(toolId, toolData);
    }
  }
  
  console.log(`Found ${tools.size} tools/tool references:\n`);
  
  // Track the total time spent on status checks (declared at the outermost scope)
  let totalCheckTime = 0;
  
  // Display full tool configurations first
  if (fullTools.size > 0) {
    // Display each tool sorted by name
    const toolNames = Array.from(fullTools.keys()).sort();
    
    // If status checking is enabled, check all tools first to avoid interspersed console output
    const toolStatuses = new Map<string, ToolStatusResult>();
    
    if (options.status) {
      // Warn if checking a large number of tools
      if (toolNames.length > 10) {
        const activeFilters = [];
        if (options.filterSource) activeFilters.push(`source=${options.filterSource}`);
        if (options.filterCheck) activeFilters.push(`check=${options.filterCheck}`);
        if (options.filterInstall) activeFilters.push(`install=${options.filterInstall}`);
        
        console.log(`\n${DISPLAY.EMOJIS.WARNING} Warning: Checking status for ${toolNames.length} tools may take a while.`);
        
        if (activeFilters.length > 0) {
          console.log(`   You're already filtering by: ${activeFilters.join(', ')}`);
          console.log('   Consider adding more specific filters or');
        } else {
          console.log('   Consider using filters (--filter-source, --filter-check, --filter-install) or');
        }
        console.log('   specifying a single tool: tools get <toolname> --status\n');
      }
      
      console.log('Checking tool status...');
      
      // Initialize the Homebrew caches once before checking all tools
      if (options.status) {
        debug('Pre-initializing Homebrew caches for faster tool status checks...');
        await initializeBrewCaches(10000); // Allow 10 seconds for initial cache population
      }
      
      const overallStartTime = performance.now();
      
      // Create an AbortController for the whole operation
      const overallController = new AbortController();
      const { signal } = overallController;
      
      // Instead of batches, use a queue with concurrency control
      debug('Using queue-based processing with concurrency control instead of batches');
      
      // Group tools by check method for better logging
      const toolsByMethod = new Map<string, string[]>();
      for (const toolId of toolNames) {
        const toolData = fullTools.get(toolId)!;
        const checkMethod = getToolCheckMethod(toolData.config);
        if (!toolsByMethod.has(checkMethod)) {
          toolsByMethod.set(checkMethod, []);
        }
        toolsByMethod.get(checkMethod)!.push(toolId);
      }
      
      // Log the distribution
      for (const [method, tools] of toolsByMethod.entries()) {
        debug(`Check method "${method}": ${tools.length} tools`);
      }
      
      let completedCount = 0;
      let failedCount = 0;
      const OVERALL_TIMEOUT = 120000; // 120 seconds maximum for the whole operation
      
      // Set up overall timeout - we'll use AbortController instead of Promise.race
      const overallTimeoutId = setTimeout(() => {
        debug(`Overall status check timed out after ${OVERALL_TIMEOUT}ms`);
        overallController.abort(new Error(`Overall status check timed out after ${OVERALL_TIMEOUT}ms`));
      }, OVERALL_TIMEOUT);
      
      // Set concurrency limit based on check method
      const MAX_CONCURRENT = 50; // Allow up to 50 tools to be checked at once
      let activeChecks = 0;
      const queue = [...toolNames]; // Make a copy of all tool names to process
      
      debug(`Processing ${queue.length} tools with max concurrency of ${MAX_CONCURRENT}`);
      
      try {
        // Process all tools with concurrency control
        await new Promise<void>((resolve) => {
          // Function to process the next tool in the queue
          const processNext = async () => {
            if (signal.aborted) {
              debug('Operation was aborted, stopping processing');
              resolve();
              return;
            }
            
            // If queue is empty and no active checks, we're done
            if (queue.length === 0 && activeChecks === 0) {
              debug('All tools processed, resolving promise');
              resolve();
              return;
            }
            
            // If we've reached concurrency limit or queue is empty, wait for active checks to complete
            if (activeChecks >= MAX_CONCURRENT || queue.length === 0) {
              return;
            }
            
            // Process the next tool
            const toolId = queue.shift()!;
            activeChecks++;
            
            // Show progress
            process.stdout.write(`Progress: ${completedCount}/${toolNames.length} tools checked (${failedCount} failed, ${activeChecks} active)\r`);
            
            const toolData = fullTools.get(toolId)!;
            const checkMethod = getToolCheckMethod(toolData.config);
            const toolStartTime = performance.now();
            
            debug(`Starting check for ${toolId} (check method: ${checkMethod}, active checks: ${activeChecks})...`);
            
            try {
              // Check this tool with a specific timeout based on its type
              // Homebrew checks are usually faster now with caching
              const methodTimeout = checkMethod === 'Homebrew' ? 5000 : 10000;
              const status = await checkToolStatus(toolId, toolData.config, methodTimeout);
              
              const toolEndTime = performance.now();
              const duration = toolEndTime - toolStartTime;
              debug(`Completed check for ${toolId} in ${duration.toFixed(2)}ms, status: ${status.status}`);
              
              toolStatuses.set(toolId, status);
              
              if (status.checkDuration) {
                totalCheckTime += status.checkDuration;
              }
              completedCount++;
            } catch (error) {
              if (signal.aborted) {
                activeChecks--;
                processNext(); // Try to process next item
                return;
              }
              
              const toolEndTime = performance.now();
              const duration = toolEndTime - toolStartTime;
              debug(`Error checking ${toolId} after ${duration.toFixed(2)}ms: ${error}`);
              
              toolStatuses.set(toolId, {
                status: ToolStatus.ERROR,
                message: `Error checking status: ${error instanceof Error ? error.message : String(error)}`,
                error: error instanceof Error ? error : new Error(String(error))
              });
              completedCount++;
              failedCount++;
            } finally {
              activeChecks--;
              processNext(); // Process next item when this one completes
              
              // Also try to start additional items if we haven't reached concurrency limit
              if (activeChecks < MAX_CONCURRENT && queue.length > 0) {
                processNext();
              }
            }
          };
          
          // Start initial batch of concurrent checks
          for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
            processNext();
          }
        });
      } catch (error) {
        debug(`Status check operation was interrupted: ${error}`);
        console.log(`\nStatus check operation was interrupted after ${completedCount}/${toolNames.length} tools checked. Continuing with partial results.`);
      } finally {
        // Clean up all resources
        clearTimeout(overallTimeoutId);
        
        // Kill all remaining processes
        processRegistry.killAll();
        
        // Clear the progress line
        process.stdout.write(' '.repeat(70) + '\r');
      }
      
      // When --missing is specified, filter out installed tools
      if (options.missing) {
        const missingTools: string[] = [];
        for (const [toolId, status] of toolStatuses.entries()) {
          if (status.status === ToolStatus.NOT_INSTALLED) {
            missingTools.push(toolId);
          }
        }
        
        if (missingTools.length === 0) {
          console.log('All tools are installed! 🎉');
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return;
        }
        
        console.log(`Found ${missingTools.length} missing tools out of ${toolNames.length} total tools.\n`);
        
        // Filter the toolNames to only include missing tools
        toolNames.length = 0;
        toolNames.push(...missingTools.sort());
      }
    }
    
    for (const toolId of toolNames) {
      const toolData = fullTools.get(toolId)!;
      
      // Add a separator before each tool
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('');
      
      // If we have a status result, display it with the tool name
      if (options.status && toolStatuses.has(toolId)) {
        const status = toolStatuses.get(toolId)!;
        const statusEmoji = getStatusEmoji(status);
        console.log(`  ${statusEmoji} 🔧 ${toolId}`);
        
        // Show timing information in debug mode
        if (status.checkDuration && isDebugMode()) {
          console.log(`  Check Time: ${status.checkDuration.toFixed(2)}ms`);
        }
      } else {
        console.log(`  ${DISPLAY.EMOJIS.TOOL} ${toolId}`);
      }
      
      console.log('');
      
      // Display source
      console.log(`  Source: ${toolData.source}`);
      
      // Display check method
      displayCheckMethod(toolId, toolData.config);
      
      // Display install method
      displayInstallMethod(toolData.config);
      
      // Display additional properties in detailed mode
      if (options.detailed) {
        displayAdditionalInfo(toolData.config);
      }
      
      // Display status if we have it
      if (options.status && toolStatuses.has(toolId)) {
        const status = toolStatuses.get(toolId)!;
        
        // More concise status display - only show message for errors/unknown status
        // or if we're in debug mode
        if (status.status === ToolStatus.ERROR || status.status === ToolStatus.UNKNOWN || isDebugMode()) {
          console.log(`  Status: ${formatStatus(status.status)}${status.message ? ` - ${status.message}` : ''}`);
        } else {
          // Just show the status without detailed message for successful/not installed cases
          console.log(`  Status: ${formatStatus(status.status)}`);
        }
      }
      
      console.log('');
    }
    
    // After displaying all tools, show a summary of check times if status was checked
    if (options.status && totalCheckTime > 0) {
      const averageTime = totalCheckTime / toolNames.length;
      console.log(`\nStatus check timing summary:`);
      console.log(`- Total check time: ${totalCheckTime.toFixed(2)}ms`);
      console.log(`- Average check time: ${averageTime.toFixed(2)}ms per tool`);
    }
  }
  
  // Display tool references only if not showing missing tools
  if (toolReferences.size > 0 && !options.missing) {
    console.log(`\n=== Tool References (${toolReferences.size}) ===\n`);
    
    // Display each reference sorted by name
    const referenceNames = Array.from(toolReferences.keys()).sort();
    
    console.log('References are tools mentioned in toolDeps or similar properties but without full configuration:');
    console.log('');
    
    for (const toolId of referenceNames) {
      const toolData = toolReferences.get(toolId)!;
      console.log(`  🔗 ${toolId} (referenced in ${toolData.source})`);
    }
  }
  
  // Display summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (options.missing) {
    // When displaying only missing tools, we don't need to show a summary
    // as it was already shown after the status check
  } else {
    console.log(`\nTotal: ${tools.size} tools configured (${fullTools.size} full configs, ${toolReferences.size} references)`);
  }
  
  // Add status check timing summary for normal output (not just debug)
  if (options.status && fullTools.size > 0 && totalCheckTime > 0) {
    const avgTime = totalCheckTime / fullTools.size;
    console.log(`Status check timing: ${totalCheckTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms average per tool`);
  }
  
  if (tools.size === 0) {
    console.log('\n⚠️ No tools were found in the configuration.');
    console.log("If you're sure tools are defined in your configuration, this might be due to:");
    console.log("1. Tools are defined differently in your Chitin setup");
    console.log("2. The location of tools in the config structure is unexpected");
    console.log("3. Try running with --debug to see more information about the configuration");
  }
  
  // Ensure any pending operations are completed before returning
  if (isDebugMode()) {
    debug('Tool display complete');
  }
  
  // Final cleanup to prevent any hanging processes
  processRegistry.killAll();
  
  // Critical signal that we've completely finished all processing
  debug('PROCESSING_COMPLETE - All tool operations finished');
}

/**
 * Displays the check method for a tool
 * @param toolId The tool ID
 * @param config Tool configuration
 */
function displayCheckMethod(toolId: string, config: ToolConfig): void {
  let checkType = 'Command (default)';
  
  // Use the same logic as in _checkToolStatus to determine check method
  const shouldCheckBrew = config[BREW.CHECK_PREFIX] || (config.brew && !config.artifact && !config.pipx);
  
  if (config.checkCommand) {
    checkType = 'Command';
  } else if (shouldCheckBrew) {
    checkType = 'Homebrew';
  } else if (config.checkPath) {
    checkType = 'Path';
  } else if (config.checkEval) {
    checkType = 'Eval';
  } else if (config.optional) {
    checkType = 'Optional (no check)';
  }
  
  console.log(`  ${DISPLAY.EMOJIS.CHECK} Check: ${checkType}`);
}

/**
 * Displays the install method for a tool
 * @param config Tool configuration
 */
function displayInstallMethod(config: ToolConfig): void {
  let installType = 'None specified';
  
  if (config.brew) {
    installType = 'Homebrew';
  } else if (config.git) {
    installType = 'Git';
  } else if (config.script) {
    installType = 'Script';
  } else if (config.artifact) {
    installType = 'Artifact';
  } else if (config.command) {
    installType = 'Command';
  }
  
  console.log(`  ${DISPLAY.EMOJIS.INSTALL} Install: ${installType}`);
}

/**
 * Displays additional information for a tool
 * @param config Tool configuration
 */
function displayAdditionalInfo(config: ToolConfig): void {
  console.log('  📋 Additional info:');
  
  if (config.version) {
    console.log(`    Version: ${config.version}`);
  }
  
  if (config.versionCommand) {
    console.log(`    Version command: ${config.versionCommand}`);
  }
  
  if (config.postInstall) {
    console.log(`    Post-install: ${config.postInstall}`);
  }
  
  if (config.optional) {
    console.log('    Optional: yes');
  }
}

/**
 * Format status in a user-friendly way
 * @param status The status enum value
 * @returns Formatted status string
 */
function formatStatus(status: ToolStatus): string {
  switch (status) {
    case ToolStatus.INSTALLED:
      return 'installed';
    case ToolStatus.NOT_INSTALLED:
      return 'not installed';
    case ToolStatus.ERROR:
      return 'error';
    case ToolStatus.UNKNOWN:
    default:
      return 'unknown';
  }
}

/**
 * Displays installation hints for a tool
 * @param toolId The tool ID
 * @param config The tool configuration
 */
function showInstallationHint(toolId: string, config: ToolConfig): void {
  // This is a placeholder. You can implement actual installation hints here if needed.
  return;
}

/**
 * Format a configuration value for display
 * @param value Configuration value to format
 * @returns Formatted string representation
 */
function formatConfigValue(value: any): string {
  if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  } else {
    return JSON.stringify(value);
  }
}

/**
 * Check if a macOS application bundle exists
 * @param appName The application name
 * @returns True if the application bundle is found, false otherwise
 */
function isAppBundleInstalled(appName: string): boolean {
  // Generate possible app names with different capitalizations and formats
  const possibleNames = generateAppNameVariations(appName);
  
  // Standard locations for macOS applications
  const appLocations = [
    '/Applications',
    `${process.env.HOME}/Applications`
  ];
  
  for (const location of appLocations) {
    for (const name of possibleNames) {
      const appPath = `${location}/${name}.app`;
      debug(`Checking for app bundle at ${appPath}`);
      
      if (fs.existsSync(appPath)) {
        debug(`Found application bundle at ${appPath}`);
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Generate variations of an app name to handle different naming conventions
 * @param appName Base app name
 * @returns Array of possible name variations
 */
function generateAppNameVariations(appName: string): string[] {
  // Special cases for apps with known different bundle names
  const specialCases: Record<string, string[]> = {
    'camo-studio': ['Camo Studio', 'CamoStudio'],
    'visual-studio-code': ['Visual Studio Code', 'VSCode'],
    'google-chrome': ['Google Chrome'],
    'macs-fan-control': ['Macs Fan Control'],
    'iterm2': ['iTerm'],
    'notion-calendar': ['Notion Calendar']
  };
  
  if (specialCases[appName]) {
    return specialCases[appName];
  }
  
  // Generate standard variations
  const variations = [
    appName,
    // Convert kebab-case to space-separated with title case
    appName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    // Convert kebab-case to CamelCase
    appName.replace(/-./g, x => x[1].toUpperCase())
  ];
  
  return variations;
}

/**
 * Determines if a brew configuration indicates a cask
 * @param brewConfig The brew configuration
 * @returns True if the configuration is for a cask, false otherwise
 */
function isBrewCask(brewConfig: any): boolean {
  if (typeof brewConfig === 'boolean') {
    return false;
  } else if (typeof brewConfig === 'string') {
    return false; // String configs are assumed to be formulas
  } else if (brewConfig && typeof brewConfig === 'object') {
    return Boolean(brewConfig[BREW.CASK]);
  }
  return false;
}

/**
 * Gets the package name from a brew configuration
 * @param brewConfig The brew configuration
 * @param toolId The tool ID to use as fallback name
 * @returns The package name
 */
function getBrewPackageName(brewConfig: any, toolId: string): string {
  if (typeof brewConfig === 'boolean') {
    return toolId; // Use tool ID as package name if brew is just true
  } else if (typeof brewConfig === 'string') {
    return brewConfig; // Use the string as the package name
  } else if (brewConfig && typeof brewConfig === 'object') {
    // If the config has a name field, use that
    if (brewConfig[BREW.NAME]) {
      return brewConfig[BREW.NAME];
    }
    // Otherwise, use the tool ID
    return toolId;
  }
  
  // Default case
  return toolId;
} 

// Add this utility function to check if we're in debug mode, to replace DEBUG references
function isDebugMode(): boolean {
  return currentLogLevel >= LogLevel.DEBUG;
}

/**
 * ShellPool: Manages a pool of reusable shell processes to reduce spawn overhead
 */
class ShellPool {
  private shells: Array<{process: ReturnType<typeof execa>, active: boolean}> = [];
  private poolSize: number;
  private initialized = false;

  constructor(poolSize = 5) {
    this.poolSize = poolSize;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Create initial pool of shells
    for (let i = 0; i < this.poolSize; i++) {
      await this.createShell();
    }
    this.initialized = true;
    if (isDebugMode()) {
      debug(`Shell pool initialized with ${this.poolSize} shells`);
    }
  }

  private async createShell(): Promise<void> {
    try {
      // Start a persistent shell process
      const shell = execa('bash', ['-i'], { 
        shell: true, 
        stdio: ['pipe', 'pipe', 'pipe'],
        cleanup: true
      });
      
      // Initialize the shell environment if we can
      if (shell.stdin) {
        await shell.stdin.write(`eval "$(/opt/homebrew/bin/brew shellenv)"\n`);
      }
      
      this.shells.push({process: shell, active: false});
    } catch (error) {
      debug(`Error creating shell: ${error}`);
      // Just continue - we'll create more shells on demand if needed
    }
  }

  async getShell(): Promise<{process: ReturnType<typeof execa>, index: number}> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Find an available shell
    const index = this.shells.findIndex(s => !s.active);
    
    if (index >= 0) {
      this.shells[index].active = true;
      return {process: this.shells[index].process, index};
    }
    
    // If all shells are in use and we're below max, create a new one
    if (this.shells.length < this.poolSize * 2) {
      await this.createShell();
      const newIndex = this.shells.length - 1;
      this.shells[newIndex].active = true;
      return {process: this.shells[newIndex].process, index: newIndex};
    }
    
    // Wait for a shell to become available
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const index = this.shells.findIndex(s => !s.active);
        if (index >= 0) {
          clearInterval(checkInterval);
          this.shells[index].active = true;
          resolve({process: this.shells[index].process, index});
        }
      }, 50);
    });
  }

  releaseShell(index: number): void {
    if (index >= 0 && index < this.shells.length) {
      this.shells[index].active = false;
    }
  }

  async executeCommand(command: string, timeoutMs: number = 5000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const {process: shell, index} = await this.getShell();
    
    return new Promise(async (resolve, reject) => {
      if (!shell.stdout || !shell.stderr || !shell.stdin) {
        this.releaseShell(index);
        reject(new Error('Shell process does not have valid stdio streams'));
        return;
      }
      
      const commandId = Math.random().toString(36).substring(7);
      const startMarker = `START_CMD_${commandId}`;
      const endMarker = `END_CMD_${commandId}`;
      
      // Prepare output collectors
      let stdout = '';
      let stderr = '';
      let commandComplete = false;
      
      // Set up output handlers
      const stdoutHandler = (data: Buffer) => {
        const text = data.toString();
        if (text.includes(startMarker)) {
          // Start collecting output
          stdout = '';
        } else if (text.includes(endMarker)) {
          // Extract the exit code
          const match = text.match(/EXIT_CODE_(\d+)/);
          const exitCode = match ? parseInt(match[1], 10) : 1;
          
          // Command is complete
          commandComplete = true;
          this.releaseShell(index);
          
          // Clean up listeners
          shell.stdout?.removeListener('data', stdoutHandler);
          shell.stderr?.removeListener('data', stderrHandler);
          
          resolve({ stdout, stderr, exitCode });
        } else if (!commandComplete) {
          stdout += text;
        }
      };
      
      const stderrHandler = (data: Buffer) => {
        stderr += data.toString();
      };
      
      // Set up output listeners
      shell.stdout.on('data', stdoutHandler);
      shell.stderr.on('data', stderrHandler);
      
      // Set a timeout
      const timeout = setTimeout(() => {
        if (!commandComplete) {
          shell.stdout?.removeListener('data', stdoutHandler);
          shell.stderr?.removeListener('data', stderrHandler);
          this.releaseShell(index);
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        }
      }, timeoutMs);
      
      // Execute the command with markers to identify output
      const fullCommand = `
        echo "${startMarker}"
        { ${command}; } 2>&1
        echo "EXIT_CODE_$?"
        echo "${endMarker}"
      `;
      
      try {
        await shell.stdin.write(fullCommand + '\n');
      } catch (err) {
        clearTimeout(timeout);
        shell.stdout?.removeListener('data', stdoutHandler);
        shell.stderr?.removeListener('data', stderrHandler);
        this.releaseShell(index);
        reject(err);
      }
    });
  }
  
  async shutdown(): Promise<void> {
    // Terminate all shells
    for (const {process} of this.shells) {
      try {
        process.kill();
      } catch (e) {
        // Ignore errors when killing shells
      }
    }
    this.shells = [];
    this.initialized = false;
  }
}

// Create a global shell pool
const shellPool = new ShellPool(10);

// Update the existing _checkToolStatus function to use the shell pool for command checks
async function _checkToolStatus(
  toolId: string, 
  config: ToolConfig, 
  timeoutMs: number = 2000,
  signal?: AbortSignal
): Promise<ToolStatusResult> {
  // If this is an optional tool, mark as UNKNOWN if not otherwise determined
  const isOptional = config.optional === true;
  
  // Start with default unknown status
  let result: ToolStatusResult = {
    status: ToolStatus.UNKNOWN,
  };

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
        // Use shell pool for command execution instead of safeExecaCommand
        const result = await shellPool.executeCommand(config.checkCommand, timeoutMs);
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
      } catch (error: any) {
        const duration = Date.now() - startTime;
        return {
          status: ToolStatus.ERROR,
          message: `Error checking tool: ${error.message}`,
          error: error as Error,
          checkDuration: duration
        };
      }
    }
    
    // Check using path if specified
    if (config.checkPath) {
      const checkPath = config.checkPath;
      debug(`Checking tool ${toolId} using path: ${checkPath}`);
      
      try {
        // First try the exact path as specified
        let exists = fs.existsSync(checkPath);
        
        // If not found and we have a git target, try to resolve against that
        if (!exists && config.git && config.git.target) {
          const gitTarget = config.git.target;
          
          // Try a few common patterns for git installations
          const possiblePaths = [
            path.join(gitTarget, checkPath),
            path.join(gitTarget, '..', checkPath),
            path.join(gitTarget, '..', '..', checkPath),
            path.join(path.dirname(gitTarget), checkPath),
            // Handle the special case where localshare is used
            path.join(process.env.HOME || '~', '.local/share', checkPath),
            // For target paths like localshare/zinit/zinit.git
            ...(gitTarget.includes('localshare') 
              ? [path.join(process.env.HOME || '~', '.local/share', gitTarget.split('localshare/')[1], checkPath)] 
              : [])
          ];
          
          debug(`Path not found at ${checkPath}, trying git target paths:`);
          for (const tryPath of possiblePaths) {
            debug(`- Trying ${tryPath}`);
            if (fs.existsSync(tryPath)) {
              debug(`Found at ${tryPath}`);
              exists = true;
              break;
            }
          }
        }
        
        if (exists) {
          result.status = ToolStatus.INSTALLED;
          result.message = `Path exists: "${checkPath}"`;
          return result;
        } else {
          result.status = ToolStatus.NOT_INSTALLED;
          result.message = `Path not found: "${checkPath}"`;
          return result;
        }
      } catch (error) {
        result.status = ToolStatus.ERROR;
        result.message = `Error checking path: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // Check if checkEval is specified
    if (config.checkEval) {
      debug(`Checking tool ${toolId} using eval: ${config.checkEval}`);
      
      try {
        // Execute the eval command
        const { exitCode } = await safeExecaCommand(config.checkEval, {
          shell: true,
          reject: false,
          cancelSignal: signal
        });
        
        if (exitCode === 0) {
          result.status = ToolStatus.INSTALLED;
          result.message = `Eval check successful`;
          return result;
        } else {
          result.status = ToolStatus.NOT_INSTALLED;
          result.message = `Eval check failed with exit code ${exitCode}`;
          return result;
        }
      } catch (error) {
        result.status = ToolStatus.ERROR;
        result.message = `Error executing eval check: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // Check for Homebrew package
    const shouldCheckBrew = config[BREW.CHECK_PREFIX] || (config.brew && !config.artifact && !config.pipx);
    if (shouldCheckBrew) {
      debug(`Checking tool ${toolId} as Homebrew package`);
      
      // Determine if this is a cask
      const isCask = config[BREW.CHECK_PREFIX]
        ? isBrewCask(config[BREW.CHECK_PREFIX])
        : isBrewCask(config.brew || {});
      
      // Get the package name
      const brewName = config[BREW.CHECK_PREFIX]
        ? getBrewPackageName(config[BREW.CHECK_PREFIX], toolId)
        : getBrewPackageName(config.brew || {}, toolId);
      
      debug(`Checking if Homebrew ${isCask ? 'cask' : 'formula'} "${brewName}" is installed using cache...`);
      
      try {
        // Make sure Homebrew caches are initialized
        if (!brewCacheInitialized) {
          const cacheInitialized = await initializeBrewCaches(timeoutMs * 0.5);
          if (!cacheInitialized) {
            throw new Error("Failed to initialize Homebrew caches");
          }
        }
        
        // Check against cached lists instead of running brew command
        const isInstalled = isBrewPackageInstalledFromCache(brewName, isCask);
        
        if (isInstalled) {
          result.status = ToolStatus.INSTALLED;
          result.message = `Found as Homebrew ${isCask ? BREW.CASK : BREW.FORMULA} "${brewName}"`;
          return result;
        } else {
          result.status = ToolStatus.NOT_INSTALLED;
          result.message = `Homebrew ${isCask ? BREW.CASK : BREW.FORMULA} "${brewName}" not found`;
          return result;
        }
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason || new Error('Operation aborted');
        }
        
        // If there's an error with the cache method, fall back to direct check
        debug(`Error using cache, falling back to direct Homebrew check for ${brewName}: ${error}`);
        
        try {
          // Initialize Homebrew environment
          await initBrewEnvironment(timeoutMs * 0.2);
          
          // Set proper environment
          const env = {
            ...process.env,
            PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || ''}`
          };
          
          // Direct check using 'brew list' as fallback
          const cmd = `brew list ${isCask ? '--cask' : '--formula'} | grep -q "^${brewName}$"`;
          debug(`Executing fallback: ${cmd}`);
          
          const { exitCode } = await safeExecaCommand(cmd, {
            shell: true,
            reject: false,
            env,
            timeout: timeoutMs * 0.5,
            cancelSignal: signal
          });
          
          if (exitCode === 0) {
            result.status = ToolStatus.INSTALLED;
            result.message = `Found as Homebrew ${isCask ? BREW.CASK : BREW.FORMULA} "${brewName}" (direct check)`;
            return result;
          } else {
            result.status = ToolStatus.NOT_INSTALLED;
            result.message = `Homebrew ${isCask ? BREW.CASK : BREW.FORMULA} "${brewName}" not found (direct check)`;
            return result;
          }
        } catch (fallbackError) {
          result.status = ToolStatus.ERROR;
          result.message = `Error checking Homebrew: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
          result.error = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
          return result;
        }
      }
    }
    
    // Check if artifact exists
    if (config.artifact) {
      debug(`Checking tool ${toolId} as artifact`);
      
      try {
        // Implementation would depend on how artifacts are managed
        // This is a placeholder
        result.status = ToolStatus.UNKNOWN;
        result.message = `Artifact check not fully implemented`;
        return result;
      } catch (error) {
        result.status = ToolStatus.ERROR;
        result.message = `Error checking artifact: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error instanceof Error ? error : new Error(String(error));
        return result;
      }
    }
    
    // Default: Check if the command exists in PATH, matching Chitin's behavior
    debug(`Checking if tool '${toolId}' exists in PATH (default behavior)`);
    try {
      // Set up environment with Homebrew paths
      const env = {
        ...process.env,
        PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || ''}`
      };
      
      const checkCmd = getCheckCommand(toolId);
      debug(`Executing '${checkCmd}'`);
      
      const { exitCode, stdout, stderr } = await safeExecaCommand(checkCmd, {
        shell: true,
        reject: false,
        env,
        cancelSignal: signal
      });
      
      debug(`Exit code: ${exitCode}, Stdout: ${stdout}, Stderr: ${stderr}`);
      
      if (exitCode === 0) {
        result.status = ToolStatus.INSTALLED;
        result.message = `Command '${toolId}' found in PATH: ${stdout}`;
        return result;
      } else {
        result.status = ToolStatus.NOT_INSTALLED;
        result.message = `Command '${toolId}' not found in PATH`;
        return result;
      }
    } catch (error) {
      result.status = ToolStatus.ERROR;
      result.message = `Error checking command in PATH: ${error instanceof Error ? error.message : String(error)}`;
      result.error = error instanceof Error ? error : new Error(String(error));
      return result;
    }
  } catch (error) {
    // Catch-all for any unexpected errors
    return {
      status: ToolStatus.ERROR,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Modify the existing handleGetStatusCommand function to initialize and shutdown the shell pool
// This replaces the handleCheckToolsStatus function that was causing a duplicate error
async function handleGetStatusCommand(options: any): Promise<void> {
  const config = await loadAndValidateConfig();
  const modules = await discoverModulesFromConfig(config);
  const tools = extractAllTools(config, modules);
  
  // Apply filters if specified
  const filteredTools = filterTools(tools, {
    filterSource: options.source,
    filterCheck: options.check,
    filterInstall: options.install
  });
  
  // Initialize the shell pool before checking tools
  await shellPool.initialize();
  
  try {
    let statusResults = new Map<string, ToolStatusResult>();
    
    // Implement the rest of the status checking logic using the shell pool
    // ... existing code ...
    
    // Display the tools with their status
    await displayTools(filteredTools, { 
      status: true,
      detailed: options.detailed,
      missing: options.missing,
      filterSource: options.source,
      filterCheck: options.check,
      filterInstall: options.install
    });
  } finally {
    // Always shut down the shell pool when done
    await shellPool.shutdown();
  }
}
