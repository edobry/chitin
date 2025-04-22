/**
 * Base configuration interface for all configuration types
 */
export interface BaseConfig {
  enabled?: boolean;
}

/**
 * Tool configuration interface
 */
export interface ToolConfig {
  // Presence check methods
  checkCommand?: string | boolean;
  checkBrew?: boolean;
  checkPath?: string;
  checkEval?: string;
  
  // Version management
  version?: string;
  versionCommand?: string;
  
  // Installation method
  brew?: boolean | {
    name?: string;
    cask?: boolean;
    tap?: string;
    tapUrl?: string;
  };
  git?: {
    url: string;
    target: string;
  };
  script?: string;
  artifact?: {
    url: string;
    target: string;
    appendFilename?: boolean;
  };
  command?: string;
  // Pipx package installation
  pipx?: string | boolean;
  checkPipx?: boolean;
  
  // Additional configuration
  optional?: boolean;
  postInstall?: string;
}

/**
 * Core configuration interface
 */
export interface CoreConfig extends BaseConfig {
  projectDir?: string;
  dotfilesDir?: string;
  checkTools?: boolean;
  installToolDeps?: boolean;
  autoInitDisabled?: boolean;
  failOnError?: boolean;
  loadParallel?: boolean;
  moduleConfig?: Record<string, ChainConfig>;
}

/**
 * Chain configuration interface
 */
export interface ChainConfig extends BaseConfig {
  tools?: Record<string, ToolConfig>;
  toolDeps?: string[];
}

/**
 * Fiber configuration interface
 */
export interface FiberConfig extends BaseConfig {
  fiberDeps?: string[];
  moduleConfig?: Record<string, ChainConfig>;
  tools?: Record<string, ToolConfig>;
  toolDeps?: string[];
}

/**
 * User configuration interface
 */
export interface UserConfig {
  core: CoreConfig;
  [fiberName: string]: FiberConfig | CoreConfig | Record<string, any>;
}

/**
 * Configuration merging options
 */
export interface ConfigMergeOptions {
  overwriteArrays?: boolean;
  deep?: boolean;
}

/**
 * Path expansion options
 */
export interface PathExpansionOptions {
  homeDir?: string;
  localShareDir?: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
} 
