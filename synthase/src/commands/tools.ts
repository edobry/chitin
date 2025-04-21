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

const execAsync = promisify(exec);

// Debug utility to show logs only when DEBUG environment variable is set
const DEBUG = process.env.DEBUG === 'true';
function debug(...args: any[]): void {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
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
  message?: string; // Additional information about the status
  error?: Error;   // Error that occurred during check, if any
  output?: string; // Output from the check command, if any
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
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules');

  // Create get subcommand (default behavior)
  const getCommand = new Command('get')
    .description('Display detailed information about tools')
    .option('-d, --detailed', 'Show detailed information for each tool')
    .option('--status', 'Check if tools are installed and show status')
    .option('-s, --source <source>', 'Filter tools by source module (e.g., "core", "dotfiles", "cloud:aws")')
    .option('--filter-check <method>', 'Filter tools by check method (command, brew, path, eval, optional)')
    .option('--filter-install <method>', 'Filter tools by install method (brew, git, script, artifact, command)')
    .argument('[tool]', 'Optional tool name to display details for')
    .action(async (toolName, options) => {
      const parentOptions = command.opts();
      const mergedOptions = { ...parentOptions, ...options };
      await handleToolsCommand(toolName, mergedOptions);
    });

  // Create list subcommand
  const listCommand = new Command('list')
    .description('List all tool names, one per line')
    .option('-s, --source <source>', 'Filter tools by source module (e.g., "core", "dotfiles", "cloud:aws")')
    .option('--filter-check <method>', 'Filter tools by check method (command, brew, path, eval, optional)')
    .option('--filter-install <method>', 'Filter tools by install method (brew, git, script, artifact, command)')
    .action(async (options) => {
      const parentOptions = command.opts();
      const mergedOptions = { ...parentOptions, ...options };
      await handleListCommand(mergedOptions);
    });

  // Add subcommands
  command.addCommand(getCommand);
  command.addCommand(listCommand);

  // Set default action to run get command
  command.action(async (options) => {
    await handleToolsCommand(undefined, options);
  });

  return command;
}

/**
 * Checks if a tool is installed based on its configuration
 * @param toolId Tool identifier
 * @param config Tool configuration
 * @returns Promise resolving to a ToolStatusResult
 */
export async function checkToolStatus(toolId: string, config: ToolConfig): Promise<ToolStatusResult> {
  try {
    // If the tool is optional, still run the check but don't fail on error
    const isOptional = !!config.optional;
    
    // Get the appropriate check command based on tool config
    let checkCommand = '';
    let useShell = true;

    if (config.checkCommand) {
      // Use explicit check command if provided
      checkCommand = config.checkCommand;
    } else if (config.checkBrew) {
      // Check using Homebrew
      checkCommand = `brew list ${config.checkBrew || toolId} &>/dev/null`;
    } else if (config.checkPath) {
      // Check if a path exists
      checkCommand = `test -e "${config.checkPath}"`;
    } else if (config.checkEval) {
      // Use custom eval script
      checkCommand = config.checkEval;
    } else {
      // Default: Use 'command -v' to check if the command exists
      checkCommand = `command -v ${toolId} &>/dev/null`;
    }

    debug(`Checking tool '${toolId}' with command: ${checkCommand}`);

    // Execute the check command
    const result = await execAsync(checkCommand, { shell: useShell });
    
    return {
      status: ToolStatus.INSTALLED,
      message: `Tool '${toolId}' is installed`,
      output: result.stdout.trim()
    };
  } catch (error) {
    // Handle the error based on whether the tool is optional
    if (config.optional) {
      return {
        status: ToolStatus.NOT_INSTALLED,
        message: `Optional tool '${toolId}' is not installed`,
        error: error as Error
      };
    }
    
    return {
      status: ToolStatus.NOT_INSTALLED,
      message: `Tool '${toolId}' is not installed`,
      error: error as Error
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
      return '🟢'; // Green circle for installed
    case ToolStatus.NOT_INSTALLED:
      return '🔴'; // Red circle for not installed
    case ToolStatus.ERROR:
      return '⚠️'; // Warning for error
    case ToolStatus.UNKNOWN:
    default:
      return '⚪'; // White circle for unknown
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
  options: { source?: string, filterCheck?: string, filterInstall?: string }
): Map<string, { config: ToolConfig, source: string }> {
  if (!options.source && !options.filterCheck && !options.filterInstall) {
    return tools; // No filters applied
  }

  const filteredTools = new Map();

  for (const [toolId, toolData] of tools.entries()) {
    let includeItem = true;

    // Filter by source
    if (options.source && !toolData.source.includes(options.source)) {
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
  } else if (config.checkBrew) {
    return 'brew';
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
    return 'brew';
  } else if (config.git) {
    return 'git';
  } else if (config.script) {
    return 'script';
  } else if (config.artifact) {
    return 'artifact';
  } else if (config.command) {
    return 'command';
  }
  
  return 'none';
}

/**
 * Handle the tools list subcommand
 * @param options Command options
 */
async function handleListCommand(options: any): Promise<void> {
  try {
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
      source: options.source,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });
    
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
      source: options.source,
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
          await displaySingleTool(toolName, tool, { ...options, status });
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
    await displayTools(tools, options);
  } catch (error) {
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
  options: { detailed?: boolean, status?: boolean, status?: ToolStatusResult }
): Promise<void> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('');
  
  // If we have a status result, display it with the tool name
  if (options.status) {
    const statusEmoji = getStatusEmoji(options.status);
    console.log(`  ${statusEmoji} 🔧 ${toolId}`);
  } else {
    console.log(`  🔧 ${toolId}`);
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
  if (options.status === true && !options.status) {
    console.log(`  Status: Checking...`);
    try {
      const status = await checkToolStatus(toolId, toolData.config);
      const statusEmoji = getStatusEmoji(status);
      console.log(`  Status: ${statusEmoji} ${status.status} ${status.message ? '- ' + status.message : ''}`);
    } catch (error) {
      console.log(`  Status: ⚠️ Error checking status`);
    }
  } else if (typeof options.status === 'object') {
    // Show the status if we have a result
    const status = options.status;
    console.log(`  Status: ${status.status} ${status.message ? '- ' + status.message : ''}`);
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

/**
 * Displays the tools in a formatted way
 * @param tools Map of tools to display
 * @param options Display options
 */
async function displayTools(
  tools: Map<string, { config: ToolConfig, source: string }>,
  options: { detailed?: boolean, status?: boolean }
): Promise<void> {
  console.log('Legend: 🔧 = tool   🔍 = check method   🚀 = install method   🔗 = reference');
  if (options.status) {
    console.log('Status: 🟢 = installed   🔴 = not installed   ⚠️ = error   ⚪ = unknown');
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
  
  // Display full tool configurations first
  if (fullTools.size > 0) {
    // Display each tool sorted by name
    const toolNames = Array.from(fullTools.keys()).sort();
    
    // If status checking is enabled, check all tools first to avoid interspersed console output
    const toolStatuses = new Map<string, ToolStatusResult>();
    
    if (options.status) {
      console.log('Checking tool status...');
      
      // Check all tools in parallel
      const statusPromises = toolNames.map(async (toolId) => {
        const toolData = fullTools.get(toolId)!;
        try {
          const status = await checkToolStatus(toolId, toolData.config);
          toolStatuses.set(toolId, status);
        } catch (error) {
          toolStatuses.set(toolId, {
            status: ToolStatus.ERROR,
            message: `Error checking status: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      });
      
      await Promise.all(statusPromises);
      console.log('Status check complete.\n');
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
      } else {
        console.log(`  🔧 ${toolId}`);
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
        console.log(`  Status: ${status.status}${status.message ? ` - ${status.message}` : ''}`);
      }
    }
    
    // Add a final separator after the last tool
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
  
  // Display tool references
  if (toolReferences.size > 0) {
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
  console.log(`\nTotal: ${tools.size} tools configured (${fullTools.size} full configs, ${toolReferences.size} references)`);
  
  if (tools.size === 0) {
    console.log('\n⚠️ No tools were found in the configuration.');
    console.log("If you're sure tools are defined in your configuration, this might be due to:");
    console.log("1. Tools are defined differently in your Chitin setup");
    console.log("2. The location of tools in the config structure is unexpected");
    console.log("3. Try running with --debug to see more information about the configuration");
  }
}

/**
 * Displays the check method for a tool
 * @param toolId Tool ID
 * @param config Tool configuration
 */
function displayCheckMethod(toolId: string, config: ToolConfig): void {
  let checkType = 'Command (default)';
  
  if (config.checkCommand) {
    checkType = 'Command';
  } else if (config.checkBrew) {
    checkType = 'Homebrew';
  } else if (config.checkPath) {
    checkType = 'Path';
  } else if (config.checkEval) {
    checkType = 'Eval';
  } else if (config.optional) {
    checkType = 'Optional (no check)';
  }
  
  console.log(`  🔍 Check: ${checkType}`);
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
  
  console.log(`  🚀 Install: ${installType}`);
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
