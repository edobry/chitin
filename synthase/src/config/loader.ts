import { join } from 'path';
import { findChitinDir, getUserConfigPath } from '../utils/path';
import { loadYamlFile } from '../utils/yaml';
import { UserConfig, FiberConfig, ChainConfig, CoreConfig } from '../types';
import { expandPath, fileExists, ensureDir, writeFile } from '../utils/file';

/**
 * Default file names for configuration files
 */
export const CONFIG_FILES = {
  USER: 'userConfig.yaml',
  MODULE: 'config.yaml',
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
    projectDir: expandPath('~'),
    dotfilesDir: expandPath('~'),
    checkTools: false,
    installToolDeps: false,
    autoInitDisabled: false,
    loadParallel: false,
    fibers: {},
    chains: {},
    tools: {},
    core: {
      projectDir: expandPath('~'),
      dotfilesDir: expandPath('~'),
      checkTools: false,
      installToolDeps: false,
      autoInitDisabled: false,
      loadParallel: false,
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
  if (value && typeof value === 'string' && (field === 'projectDir' || field === 'dotfilesDir')) {
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
export function getFullConfig(userConfig: UserConfig | null): any {
  const defaultConfig = getDefaultConfig();
  
  if (!userConfig) {
    return defaultConfig;
  }
  
  // Start with default config
  const result = {...defaultConfig};
  
  // Copy top-level properties from userConfig
  for (const [key, value] of Object.entries(userConfig)) {
    if (key !== 'core' && key !== 'fibers' && key !== 'chains' && key !== 'tools') {
      // Copy the entire object instead of just references
      result[key] = JSON.parse(JSON.stringify(value));
    }
  }
  
  // Merge core fiber configuration
  result.core = {
    ...defaultConfig.core,
    ...userConfig.core,
  };
  
  // Copy top-level properties from core for backward compatibility
  if (userConfig.core) {
    if (userConfig.core.projectDir) result.projectDir = userConfig.core.projectDir;
    if (userConfig.core.dotfilesDir) result.dotfilesDir = userConfig.core.dotfilesDir;
    if (userConfig.core.checkTools !== undefined) result.checkTools = userConfig.core.checkTools;
    if (userConfig.core.installToolDeps !== undefined) result.installToolDeps = userConfig.core.installToolDeps;
    if (userConfig.core.autoInitDisabled !== undefined) result.autoInitDisabled = userConfig.core.autoInitDisabled;
    if (userConfig.core.loadParallel !== undefined) result.loadParallel = userConfig.core.loadParallel;
  }
  
  // Copy all other fiber configurations
  for (const [fiberName, fiberConfig] of Object.entries(userConfig)) {
    if (fiberName !== 'core') {
      if (fiberName === 'fibers' || fiberName === 'chains' || fiberName === 'tools') {
        result[fiberName] = {...defaultConfig[fiberName], ...fiberConfig};
      } else {
        // Don't add to fibers object to avoid duplication
        // Just keep the fiber configs at the top level
      }
    }
  }
  
  // Remove the empty fibers object if it exists to avoid duplication in output
  if (result.fibers && Object.keys(result.fibers).length === 0) {
    delete result.fibers;
  }
  
  return result;
} 
