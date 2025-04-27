/**
 * Tool-specific configuration value types
 */
export type ToolConfigValue = 
  | string 
  | number 
  | boolean 
  | null 
  | ToolConfigValue[] 
  | { [key: string]: ToolConfigValue };

/**
 * Tool-specific configuration type
 */
export type ToolSpecificConfig = Record<string, ToolConfigValue>;

/**
 * Brew configuration interface
 */
export interface BrewConfig {
  /** Package name in Homebrew */
  name?: string;
  /** Whether to install as a cask */
  cask?: boolean | string;
  /** Tap to add */
  tap?: string;
  /** URL for the tap */
  tapUrl?: string;
  /** Formula name */
  formula?: string;
}

/**
 * Git configuration interface
 */
export interface GitConfig {
  /** Repository URL */
  url: string;
  /** Target directory */
  target: string;
}

/**
 * Artifact configuration interface
 */
export interface ArtifactConfig {
  /** Artifact URL */
  url: string;
  /** Target path */
  target: string;
  /** Whether to append filename to target */
  appendFilename?: boolean;
}

/**
 * NPM configuration interface
 */
export interface NpmConfig {
  /** Package name */
  package?: string;
  /** Whether to install globally */
  global?: boolean;
}

/**
 * PIP configuration interface
 */
export interface PipConfig {
  /** Package name */
  package?: string;
  /** Whether to install for user */
  user?: boolean;
}

/**
 * Curl configuration interface
 */
export interface CurlConfig {
  /** URL to download from */
  url: string;
  /** Target path */
  target?: string;
}

/**
 * Tool configuration interface
 */
export interface ToolConfig {
  // Presence check methods
  /** Command to check for tool presence */
  checkCommand?: string | boolean;
  /** Whether to check in Homebrew */
  checkBrew?: boolean;
  /** Path to check for tool */
  checkPath?: string;
  /** Expression to evaluate for presence */
  checkEval?: string;
  /** Whether to check in pipx */
  checkPipx?: boolean;
  
  // Version management
  /** Required version */
  version?: string;
  /** Command to get version */
  versionCommand?: string;
  
  // Installation methods
  /** Homebrew installation configuration */
  brew?: boolean | BrewConfig;
  /** Git installation configuration */
  git?: GitConfig | string;
  /** Installation script */
  script?: string;
  /** Artifact installation configuration */
  artifact?: ArtifactConfig;
  /** Installation command */
  command?: string;
  /** NPM installation configuration */
  npm?: string | boolean | NpmConfig;
  /** PIP installation configuration */
  pip?: string | boolean | PipConfig;
  /** PIPX installation configuration */
  pipx?: string | boolean;
  /** Curl installation configuration */
  curl?: string | CurlConfig;
  
  // Alternative identification methods
  /** Tool name to check in PATH */
  tool?: string | boolean;
  /** macOS app bundle to check */
  app?: string | boolean;
  
  // Dependencies and relationships
  /** Tool dependencies */
  deps?: string[];
  /** Features provided by this tool */
  provides?: string[];
  
  // Additional configuration
  /** Whether the tool is optional */
  optional?: boolean;
  /** Post-installation script */
  postInstall?: string;
  /** Additional tool-specific configuration */
  config?: ToolSpecificConfig;
}

/**
 * Tool state interface
 */
export interface ToolState {
  /** Whether the tool is installed */
  installed: boolean;
  /** Installed version */
  version?: string;
  /** Last check timestamp */
  lastChecked?: Date;
  /** Last error if any occurred during check/install */
  lastError?: string;
  /** Additional state data */
  data?: Record<string, ToolConfigValue>;
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  /** Whether the tool is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Tool dependency graph node
 */
export interface ToolDependencyNode {
  /** Tool ID */
  id: string;
  /** Dependencies */
  dependencies: string[];
  /** Dependents */
  dependents: string[];
  /** Whether this tool is installed */
  installed: boolean;
  /** Features provided by this tool */
  provides: string[];
}

/**
 * Tool dependency graph
 */
export interface ToolDependencyGraph {
  /** Graph nodes */
  nodes: Record<string, ToolDependencyNode>;
  /** Ordered list of tool IDs */
  order: string[];
} 
