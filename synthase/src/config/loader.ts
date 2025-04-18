import { join } from 'path';
import { findChitinDir, getUserConfigPath } from '../utils/path';
import { loadYamlFile } from '../utils/yaml';
import { UserConfig, FiberConfig, ChainConfig, CoreConfig } from '../types';
import { expandPath, fileExists, ensureDir, writeFile } from '../utils/file';
import { FILE_NAMES, FIBER_NAMES, CONFIG_FIELDS } from '../constants';

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
 * Reads a specific field from the user configuration
 * @param config The user configuration object
 * @param fiberName The fiber name to read from
 * @param args Additional path segments
 * @returns The value at the specified path or undefined if not found
 */
export function readConfigPath(
  config: Record<string, any>, 
  fiberName: string, 
  ...args: string[]
): any {
  if (!config || !config[fiberName]) {
    return undefined;
  }
  
  let current = config[fiberName];
  
  for (const arg of args) {
    if (!current || typeof current !== 'object' || current[arg] === undefined) {
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
): Promise<UserConfig | null> {
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
    } else {
      console.warn(`Template config not found at ${templatePath}`);
    }
    
    return null;
  }
  
  // Load user config
  const userConfig = await loadYamlFile<UserConfig>(userConfigPath);
  
  if (!userConfig) {
    console.warn(`Failed to load user configuration from ${userConfigPath}`);
    return null;
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
  const configPath = join(modulePath, CONFIG_FILES.MODULE);
  
  // Check if module config exists
  if (!await fileExists(configPath)) {
    return null;
  }
  
  // Load module config
  return await loadYamlFile<T>(configPath);
}

/**
 * Gets the default configuration
 * @returns Default configuration object
 */
export function getDefaultConfig(): any {
  return {
    [CONFIG_FIELDS.PROJECT_DIR]: expandPath('~'),
    [CONFIG_FIELDS.DOTFILES_DIR]: expandPath('~'),
    [CONFIG_FIELDS.CHECK_TOOLS]: false,
    [CONFIG_FIELDS.INSTALL_TOOL_DEPS]: false,
    [CONFIG_FIELDS.AUTO_INIT_DISABLED]: false,
    [CONFIG_FIELDS.LOAD_PARALLEL]: false,
    [CONFIG_FIELDS.FIBERS]: {},
    [CONFIG_FIELDS.CHAINS]: {},
    [CONFIG_FIELDS.TOOLS]: {},
    [FIBER_NAMES.CORE]: {
      [CONFIG_FIELDS.PROJECT_DIR]: expandPath('~'),
      [CONFIG_FIELDS.DOTFILES_DIR]: expandPath('~'),
      [CONFIG_FIELDS.CHECK_TOOLS]: false,
      [CONFIG_FIELDS.INSTALL_TOOL_DEPS]: false,
      [CONFIG_FIELDS.AUTO_INIT_DISABLED]: false,
      [CONFIG_FIELDS.LOAD_PARALLEL]: false,
    }
  };
}

/**
 * Gets the value of a core configuration field
 * @param config The user configuration
 * @param field The field name within the core configuration
 * @returns The field value or undefined if not found
 */
export function getCoreConfigValue(config: UserConfig, field: string): any {
  if (!config || !config.core) {
    return undefined;
  }
  
  const value = config.core[field as keyof CoreConfig];
  
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
  if (!config?.core?.[CONFIG_FIELDS.PROJECT_DIR]) {
    return undefined;
  }
  
  const projectDir = config.core[CONFIG_FIELDS.PROJECT_DIR];
  return typeof projectDir === 'string' ? expandPath(projectDir) : undefined;
}

/**
 * Gets the expanded dotfiles directory from config
 * @param config User configuration
 * @returns Expanded dotfiles directory path or undefined
 */
export function getDotfilesDir(config: UserConfig): string | undefined {
  if (!config?.core?.[CONFIG_FIELDS.DOTFILES_DIR]) {
    return undefined;
  }
  
  const dotfilesDir = config.core[CONFIG_FIELDS.DOTFILES_DIR];
  return typeof dotfilesDir === 'string' ? expandPath(dotfilesDir) : undefined;
}

/**
 * Gets full configuration including defaults
 * @param userConfig User configuration
 * @returns Complete configuration
 */
export function getFullConfig(userConfig: UserConfig | null): any {
  const defaultConfig = getDefaultConfig();
  
  if (!userConfig) {
    return defaultConfig;
  }
  
  // Start with default config
  const result = {...defaultConfig};
  
  // Copy top-level properties from userConfig
  for (const [key, value] of Object.entries(userConfig)) {
    if (key !== FIBER_NAMES.CORE && key !== CONFIG_FIELDS.FIBERS && key !== CONFIG_FIELDS.CHAINS && key !== CONFIG_FIELDS.TOOLS) {
      // Copy the entire object instead of just references
      result[key] = JSON.parse(JSON.stringify(value));
    }
  }
  
  // Merge core fiber configuration
  result[FIBER_NAMES.CORE] = {
    ...defaultConfig[FIBER_NAMES.CORE],
    ...userConfig.core,
  };
  
  // Copy top-level properties from core for backward compatibility
  if (userConfig.core) {
    if (userConfig.core[CONFIG_FIELDS.PROJECT_DIR]) result[CONFIG_FIELDS.PROJECT_DIR] = userConfig.core[CONFIG_FIELDS.PROJECT_DIR];
    if (userConfig.core[CONFIG_FIELDS.DOTFILES_DIR]) result[CONFIG_FIELDS.DOTFILES_DIR] = userConfig.core[CONFIG_FIELDS.DOTFILES_DIR];
    if (userConfig.core[CONFIG_FIELDS.CHECK_TOOLS] !== undefined) result[CONFIG_FIELDS.CHECK_TOOLS] = userConfig.core[CONFIG_FIELDS.CHECK_TOOLS];
    if (userConfig.core[CONFIG_FIELDS.INSTALL_TOOL_DEPS] !== undefined) result[CONFIG_FIELDS.INSTALL_TOOL_DEPS] = userConfig.core[CONFIG_FIELDS.INSTALL_TOOL_DEPS];
    if (userConfig.core[CONFIG_FIELDS.AUTO_INIT_DISABLED] !== undefined) result[CONFIG_FIELDS.AUTO_INIT_DISABLED] = userConfig.core[CONFIG_FIELDS.AUTO_INIT_DISABLED];
    if (userConfig.core[CONFIG_FIELDS.LOAD_PARALLEL] !== undefined) result[CONFIG_FIELDS.LOAD_PARALLEL] = userConfig.core[CONFIG_FIELDS.LOAD_PARALLEL];
  }
  
  // Copy all other fiber configurations
  for (const [fiberName, fiberConfig] of Object.entries(userConfig)) {
    if (fiberName !== FIBER_NAMES.CORE) {
      if (fiberName === CONFIG_FIELDS.FIBERS || fiberName === CONFIG_FIELDS.CHAINS || fiberName === CONFIG_FIELDS.TOOLS) {
        result[fiberName] = {...defaultConfig[fiberName], ...fiberConfig};
      } else {
        // Don't add to fibers object to avoid duplication
        // Just keep the fiber configs at the top level
      }
    }
  }
  
  // Remove the empty fibers object if it exists to avoid duplication in output
  if (result[CONFIG_FIELDS.FIBERS] && Object.keys(result[CONFIG_FIELDS.FIBERS]).length === 0) {
    delete result[CONFIG_FIELDS.FIBERS];
  }
  
  return result;
} 
