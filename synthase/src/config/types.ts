/**
 * Configuration field names
 */
export const CONFIG_FIELDS = {
  // Common fields
  ENABLED: 'enabled',
  MODULE_CONFIG: 'moduleConfig',
  
  // Fiber-specific fields
  FIBER_DEPS: 'fiberDeps',
  TOOL_DEPS: 'toolDeps',
  PROJECT_DIR: 'projectDir',
  DOTFILES_DIR: 'dotfilesDir',
  CHECK_TOOLS: 'checkTools',
  INSTALL_TOOL_DEPS: 'installToolDeps',
  AUTO_INIT_DISABLED: 'autoInitDisabled',
  LOAD_PARALLEL: 'loadParallel',
  
  // Chain-specific fields
  DEPS: 'deps',
  CHAIN_DEPS: 'chainDeps',
  PROVIDES: 'provides',
  
  // Special collection names
  FIBERS: 'fibers',
  CHAINS: 'chains',
  TOOLS: 'tools',
} as const;

/**
 * File and directory names
 */
export const FILE_NAMES = {
  USER_CONFIG: 'userConfig.yaml',
  MODULE_CONFIG: 'config.yaml',
  TEST_USER_CONFIG: 'test-user-config.yaml',
} as const;

/**
 * Path prefixes
 */
export const PATH_PREFIXES = {
  CHITIN: 'chitin',
  CHITIN_EXTERNAL: 'chitin-',
} as const;

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
  warnings?: string[];
} 
