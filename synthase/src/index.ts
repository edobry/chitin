import { loadUserConfig, getFullConfig, validateUserConfig, getCoreConfigValue } from './config';
import { exportEnvironmentToBash, importEnvironmentFromBash, mergeEnvironments } from './shell';
import { UserConfig } from './types';
import { findChitinDir } from './utils/path';

/**
 * Main Synthase class for programmatic usage
 */
export class Synthase {
  private config: UserConfig | null = null;
  private chitinDir: string | null = null;
  
  /**
   * Creates a new Synthase instance
   * @param configPath Optional path to user config file
   */
  constructor(private configPath?: string) {
    this.chitinDir = findChitinDir();
  }
  
  /**
   * Initializes Synthase by loading configurations
   */
  async initialize(): Promise<void> {
    // Load user configuration
    this.config = await loadUserConfig({
      chitinDir: this.chitinDir || undefined,
      userConfigPath: this.configPath,
    });
    
    // Validate configuration
    const fullConfig = getFullConfig(this.config);
    const validation = validateUserConfig(fullConfig);
    
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
  }
  
  /**
   * Gets the current configuration
   * @returns Current configuration
   */
  getConfig(): UserConfig {
    if (!this.config) {
      throw new Error('Synthase not initialized. Call initialize() first.');
    }
    
    return getFullConfig(this.config);
  }
  
  /**
   * Gets a value from the core configuration
   * @param field The field name to get
   * @returns The field value or undefined if not found
   */
  getCoreValue(field: string): any {
    const config = this.getConfig();
    return getCoreConfigValue(config, field);
  }
  
  /**
   * Exports configuration as environment variables
   * @param includeCurrentEnv Whether to include current environment variables
   * @returns Path to the exported environment file
   */
  async exportEnvironment(includeCurrentEnv = false): Promise<string> {
    if (!this.config) {
      throw new Error('Synthase not initialized. Call initialize() first.');
    }
    
    const config = getFullConfig(this.config);
    
    // Clean configuration by removing empty objects
    const cleanedConfig = {...config};
    for (const key of Object.keys(cleanedConfig)) {
      const value = cleanedConfig[key];
      if (value && typeof value === 'object' && Object.keys(value).length === 0) {
        delete cleanedConfig[key];
      }
    }
    
    let env = {
      CHITIN_CONFIG: JSON.stringify(cleanedConfig),
      CHI_DIR: this.chitinDir || process.cwd(),
      CHI_PROJECT_DIR: getCoreConfigValue(config, 'projectDir'),
      CHI_DOTFILES_DIR: getCoreConfigValue(config, 'dotfilesDir'),
      CHI_CHECK_TOOLS: getCoreConfigValue(config, 'checkTools') ? '1' : '0',
      CHI_AUTOINIT_DISABLED: getCoreConfigValue(config, 'autoInitDisabled') ? '1' : '0',
    };
    
    // Merge with current environment if requested
    if (includeCurrentEnv) {
      const currentEnv = await importEnvironmentFromBash();
      env = mergeEnvironments(currentEnv, env) as typeof env;
    }
    
    return exportEnvironmentToBash(env);
  }
}

// Export everything from submodules
export * from './config';
export * from './shell';
export * from './types';
export * from './utils'; 
