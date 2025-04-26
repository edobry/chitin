import { join } from 'path';
import { findChitinDir, getUserConfigPath } from '../utils/path';
import { loadYamlFile } from '../utils/yaml';
import { UserConfig, ChainConfig, CoreConfig, ToolConfig } from '../types/config';
import { FiberConfig } from '../types/fiber';
import { expandPath, fileExists, ensureDir, writeFile } from '../utils/file';
import { FILE_NAMES, CONFIG_FIELDS, PATH_PREFIXES } from './types';
import { FIBER_NAMES } from '../fiber/types';

/**
 * Default file names for configuration files
 */
export const CONFIG_FILES = {
  USER: FILE_NAMES.USER_CONFIG,
  MODULE: FILE_NAMES.MODULE_CONFIG,
};

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  chitinDir?: string;
  userConfigPath?: string;
}

/**
 * Type guard to check if a value is a valid configuration object
 */
function isValidConfigObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads a specific field from the user configuration
 * @param config The user configuration object
 * @param fiberName The fiber name to read from
 * @param args Additional path segments
 * @returns The value at the specified path or undefined if not found
 */
export function readConfigPath(
  config: Record<string, unknown> | null | undefined, 
  fiberName: string, 
  ...args: string[]
): unknown {
  if (!config || !isValidConfigObject(config) || !config[fiberName]) {
    return undefined;
  }
  
  let current = config[fiberName];
  
  for (const arg of args) {
    if (!isValidConfigObject(current) || current[arg] === undefined || current[arg] === null) {
      return undefined;
    }
    current = current[arg];
  }
  
  return current;
}

/**
 * Loads the user configuration
 * @param options Configuration loader options
 * @returns User configuration or null if not found
 */
export async function loadUserConfig(
  options?: ConfigLoaderOptions
): Promise<UserConfig> {
  const chitinDir = options?.chitinDir || findChitinDir();
  
  if (!chitinDir) {
    throw new Error('Could not determine Chitin directory');
  }
  
  // Use XDG config path by default, or custom path if provided
  const userConfigPath = options?.userConfigPath || getUserConfigPath();
  
  // Check if user config exists
  if (!await fileExists(userConfigPath)) {
    console.warn(`User configuration not found at ${userConfigPath}`);
    
    // Create directory if it doesn't exist
    const configDir = userConfigPath.substring(0, userConfigPath.lastIndexOf('/'));
    await ensureDir(configDir);
    
    // Copy template config if available in Chitin directory
    const templatePath = join(chitinDir, CONFIG_FILES.USER);
    if (await fileExists(templatePath)) {
      const templateContent = await Bun.file(templatePath).text();
      await writeFile(userConfigPath, templateContent);
      console.info(`Initialized user config at ${userConfigPath}`);
      
      // Load the newly created config
      const newConfig = await loadYamlFile<UserConfig>(userConfigPath);
      return newConfig || getDefaultConfig();
    } else {
      console.warn(`Template config not found at ${templatePath}`);
      return getDefaultConfig();
    }
  }
  
  // Load user config
  const userConfig = await loadYamlFile<UserConfig>(userConfigPath);
  
  if (!userConfig) {
    console.warn(`Failed to load user configuration from ${userConfigPath}`);
    return getDefaultConfig();
  }
  
  // Instead of modifying the paths in place, we'll only expand them when needed
  // but keep the original values in the config object
  // This preserves the original representation for display purposes
  
  // Save expanded paths for internal use
  if (userConfig.core && userConfig.core.projectDir) {
    expandPath(userConfig.core.projectDir);
  }
  
  if (userConfig.core && userConfig.core.dotfilesDir) {
    expandPath(userConfig.core.dotfilesDir);
  }
  
  return userConfig;
}

/**
 * Loads a module configuration
 * @param modulePath Path to the module directory
 * @returns Module configuration or null if not found
 */
export async function loadModuleConfig<T extends FiberConfig | ChainConfig>(
  modulePath: string
): Promise<T | null> {
  try {
    // If the path is a directory, look for config.yaml in it
    let configPath = modulePath;
    if (!configPath.endsWith('config.yaml')) {
      configPath = join(modulePath, CONFIG_FILES.MODULE);
    }
    
    // Check if module config exists
    if (!await fileExists(configPath)) {
      return null;
    }
    
    // Load module config
    const result = await loadYamlFile<T>(configPath);
    return result;
  } catch (error) {
    console.error(`Error loading module config from ${modulePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Gets the default configuration
 * @returns Default configuration object
 */
export function getDefaultConfig(): UserConfig {
  const coreConfig: CoreConfig = {
    projectDir: expandPath('~'),
    dotfilesDir: expandPath('~'),
    checkTools: false,
    installToolDeps: false,
    autoInitDisabled: false,
    loadParallel: false,
  };

  const config: UserConfig = {
    core: coreConfig,
    [CONFIG_FIELDS.FIBERS]: {} as Record<string, FiberConfig>,
    [CONFIG_FIELDS.CHAINS]: {} as Record<string, ChainConfig>,
    [CONFIG_FIELDS.TOOLS]: {} as Record<string, ToolConfig>,
  };

  return config;
}

/**
 * Gets the value of a core configuration field
 * @param config The user configuration
 * @param field The field name within the core configuration
 * @returns The field value or undefined if not found
 */
export function getCoreConfigValue(config: UserConfig, field: keyof CoreConfig): unknown {
  if (!config?.core) {
    return undefined;
  }
  
  const value = config.core[field];
  
  // Expand paths on-demand for fields we know are paths
  if (value && typeof value === 'string' && (field === CONFIG_FIELDS.PROJECT_DIR || field === CONFIG_FIELDS.DOTFILES_DIR)) {
    return expandPath(value);
  }
  
  return value;
}

/**
 * Gets the expanded project directory from config
 * @param config User configuration
 * @returns Expanded project directory path or undefined
 */
export function getProjectDir(config: UserConfig): string | undefined {
  if (!config?.core?.projectDir) {
    return undefined;
  }
  
  return expandPath(config.core.projectDir);
}

/**
 * Gets the expanded dotfiles directory from config
 * @param config User configuration
 * @returns Expanded dotfiles directory path or undefined
 */
export function getDotfilesDir(config: UserConfig): string | undefined {
  if (!config?.core?.dotfilesDir) {
    return undefined;
  }
  
  return expandPath(config.core.dotfilesDir);
}

/**
 * Gets full configuration including defaults
 * @param userConfig User configuration
 * @returns Complete configuration
 */
export function getFullConfig(userConfig: UserConfig | null): UserConfig {
  const defaultConfig = getDefaultConfig();
  
  if (!userConfig) {
    return defaultConfig;
  }
  
  // Start with default config
  const result: UserConfig = {
    ...defaultConfig,
    core: {
      ...defaultConfig.core,
      ...userConfig.core,
    },
    fibers: userConfig.fibers ? { ...defaultConfig.fibers, ...userConfig.fibers } : { ...defaultConfig.fibers },
    chains: userConfig.chains ? { ...defaultConfig.chains, ...userConfig.chains } : { ...defaultConfig.chains },
    tools: userConfig.tools ? { ...defaultConfig.tools, ...userConfig.tools } : { ...defaultConfig.tools },
  };
  
  // Copy any other top-level properties from userConfig
  for (const [key, value] of Object.entries(userConfig)) {
    if (key !== 'core' && key !== 'fibers' && key !== 'chains' && key !== 'tools') {
      result[key] = JSON.parse(JSON.stringify(value));
    }
  }

  return result;
} 
