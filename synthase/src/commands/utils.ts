import { findChitinDir } from '../utils/path';
import { loadUserConfig, getFullConfig, validateUserConfig, getCoreConfigValue } from '../config';
import { UserConfig, ConfigValidationResult } from '../types';

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
