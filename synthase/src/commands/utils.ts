import { findChitinDir } from '../utils/path';
import { loadUserConfig, getFullConfig, validateUserConfig, getCoreConfigValue } from '../config';
import { UserConfig, ConfigValidationResult, Module } from '../types';
import { discoverModulesFromConfig } from '../modules/discovery';
import { debug, setLogLevel, LogLevel } from '../utils/logger';
import { shellPool } from '../utils/shell-pool';

/**
 * Removes empty objects from a configuration object
 * @param config Configuration object
 * @returns Cleaned configuration object
 */
export function cleanConfigForEnv(config: Record<string, any>): Record<string, any> {
  const cleaned = {...config};
  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key];
    if (value && typeof value === 'object' && Object.keys(value).length === 0) {
      delete cleaned[key];
    }
  }
  return cleaned;
}

/**
 * Interface for configuration loading options
 */
export interface ConfigLoadOptions {
  userConfigPath?: string;
  exitOnError?: boolean;
}

/**
 * Result object from loading and validating configuration
 */
export interface ConfigResult {
  config: UserConfig;
  validation: ConfigValidationResult;
}

/**
 * Loads and validates user configuration with error handling
 * @param options Options for configuration loading
 * @returns Configuration result with validation information
 */
export async function loadAndValidateConfig(options: ConfigLoadOptions = {}): Promise<ConfigResult> {
  try {
    const userConfig = await loadUserConfig({
      userConfigPath: options.userConfigPath,
    });
    
    if (!userConfig) {
      throw new Error('No user configuration found');
    }
    
    const fullConfig = getFullConfig(userConfig);
    
    // Validate the configuration
    const validation = validateUserConfig(fullConfig);
    
    if (!validation.valid && options.exitOnError) {
      console.error('Configuration validation failed:');
      validation.errors.forEach(error => console.error(`- ${error}`));
      process.exit(1);
    }
    
    return { config: fullConfig, validation };
  } catch (error) {
    if (options.exitOnError) {
      console.error('Error loading configuration:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Creates environment variables from a configuration object
 * @param config Configuration object
 * @param options Additional options (tools flag)
 * @returns Environment variables as key-value pairs
 */
export function createEnvironmentVariables(
  config: UserConfig,
  options: { tools?: boolean } = {}
): Record<string, string> {
  return {
    CHITIN_CONFIG: JSON.stringify(cleanConfigForEnv(config)),
    CHI_DIR: findChitinDir() || process.cwd(),
    CHI_PROJECT_DIR: getCoreConfigValue(config, 'projectDir'),
    CHI_DOTFILES_DIR: getCoreConfigValue(config, 'dotfilesDir'),
    CHI_CHECK_TOOLS: (options.tools !== false && getCoreConfigValue(config, 'checkTools')) ? 'true' : 'false',
    CHI_AUTOINIT_DISABLED: getCoreConfigValue(config, 'autoInitDisabled') ? 'true' : 'false',
  };
}

/**
 * Context object returned by withConfig
 */
export interface ConfigContext {
  config: UserConfig;
  validation: ConfigValidationResult;
  modules: Module[];
  moduleErrors: string[];
  options: any;
}

/**
 * Higher-order function to handle common config loading, module discovery, and cleanup
 * @param callback Function to execute with the loaded configuration
 * @param options Command options including any config paths
 * @returns Promise resolving to the callback's return value
 */
export async function withConfig<T>(
  callback: (context: ConfigContext) => Promise<T>,
  options: any = {}
): Promise<T> {
  // Initialize shell pool if needed
  const useShell = options.useShell !== false;
  if (useShell) {
    await shellPool.initialize();
  }
  
  try {
    // Set log level from environment
    if (process.env.DEBUG === 'true') {
      setLogLevel(LogLevel.DEBUG);
    }
    
    // Load and validate configuration
    const { config, validation } = await loadAndValidateConfig({
      userConfigPath: options.path || options.config,
      exitOnError: options.exitOnError !== false
    });
    
    // Discover modules if needed
    let modules: Module[] = [];
    let moduleErrors: string[] = [];
    
    if (options.discoverModules !== false) {
      debug('Discovering modules');
      const moduleResult = await discoverModulesFromConfig(
        config, 
        options.baseDirs || []
      );
      modules = moduleResult.modules || [];
      moduleErrors = moduleResult.errors || [];
      debug(`Found ${modules.length} modules`);
    }
    
    // Call the callback with the config context
    return await callback({
      config,
      validation,
      modules,
      moduleErrors,
      options
    });
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
    throw new Error('Unreachable code - process.exit was called');
  } finally {
    // Clean up shell resources
    if (useShell) {
      try {
        await shellPool.shutdown();
      } catch (err) {
        debug(`Error shutting down shell pool: ${err}`);
      }
    }
  }
} 
