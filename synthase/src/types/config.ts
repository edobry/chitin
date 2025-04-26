import { FiberConfig, FiberConfigValue } from './fiber';
import { ChainConfig } from './chain';
import { ToolConfig } from './tool';

export { ChainConfig };
export { ToolConfig };

/**
 * Core configuration interface
 */
export interface CoreConfig {
  /** Project directory */
  projectDir?: string;
  /** Dotfiles directory */
  dotfilesDir?: string;
  /** Whether to check tool dependencies */
  checkTools?: boolean;
  /** Whether to install tool dependencies */
  installToolDeps?: boolean;
  /** Whether to disable auto-initialization */
  autoInitDisabled?: boolean;
  /** Whether to fail on error */
  failOnError?: boolean;
  /** Whether to load modules in parallel */
  loadParallel?: boolean;
  /** Module configuration */
  moduleConfig?: Record<string, ChainConfig>;
}

/**
 * User configuration interface
 */
export interface UserConfig {
  /** Core configuration */
  core: CoreConfig;
  /** Fiber configurations */
  fibers?: Record<string, FiberConfig>;
  /** Chain configurations */
  chains?: Record<string, ChainConfig>;
  /** Tool configurations */
  tools?: Record<string, ToolConfig>;
  /** Additional configuration fields */
  [key: string]: FiberConfig | CoreConfig | Record<string, FiberConfigValue> | undefined;
}

/**
 * Configuration merging options
 */
export interface ConfigMergeOptions {
  /** Whether to overwrite arrays instead of merging them */
  overwriteArrays?: boolean;
  /** Whether to perform deep merge */
  deep?: boolean;
}

/**
 * Path expansion options
 */
export interface PathExpansionOptions {
  /** Home directory override */
  homeDir?: string;
  /** Local share directory override */
  localShareDir?: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings?: string[];
} 
