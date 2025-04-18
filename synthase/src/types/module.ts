/**
 * Module interface that represents a loadable Chitin module
 */
export interface Module {
  /** Unique identifier for the module */
  id: string;
  /** Module name */
  name: string;
  /** Module path */
  path: string;
  /** Module type (fiber or chain) */
  type: 'fiber' | 'chain';
  /** Module metadata */
  metadata: ModuleMetadata;
  /** Module configuration */
  config?: Record<string, any>;
}

/**
 * Module metadata
 */
export interface ModuleMetadata {
  /** Module description */
  description?: string;
  /** Module version */
  version?: string;
  /** Module author */
  author?: string;
  /** Module dependencies */
  dependencies?: ModuleDependency[];
  /** Module creation time */
  createdAt?: Date;
  /** Module last updated time */
  updatedAt?: Date;
}

/**
 * Module dependency that defines a relationship between modules
 */
export interface ModuleDependency {
  /** Module ID that is depended on */
  moduleId: string;
  /** Whether the dependency is optional */
  optional?: boolean;
  /** Condition that needs to be satisfied for the dependency to be active */
  condition?: string;
}

/**
 * Module state tracking information
 */
export interface ModuleState {
  /** Module ID */
  moduleId: string;
  /** Whether the module is currently loaded */
  loaded: boolean;
  /** Last loaded timestamp */
  lastLoaded?: Date;
  /** Last error if any occurred during loading */
  lastError?: string;
  /** Additional data stored by the module */
  data?: Record<string, any>;
}

/**
 * Module load options
 */
export interface ModuleLoadOptions {
  /** Whether to force reload even if already loaded */
  force?: boolean;
  /** Whether to load dependencies */
  loadDependencies?: boolean;
  /** Active fibers to filter by */
  activeFibers?: string[];
}

/**
 * Result of module load operation
 */
export interface ModuleLoadResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Module that was loaded */
  module: Module;
  /** Error message if operation failed */
  error?: string;
  /** Dependencies that were loaded */
  loadedDependencies?: Module[];
}

/**
 * Options for module discovery
 */
export interface ModuleDiscoveryOptions {
  /** Base directories to scan for modules */
  baseDirs: string[];
  /** Whether to recursively scan directories */
  recursive?: boolean;
  /** Pattern to match module directories */
  modulePattern?: RegExp;
  /** Maximum depth to scan */
  maxDepth?: number;
  /** The path to the dotfiles directory */
  dotfilesDir?: string;
}

/**
 * Result of module discovery operation
 */
export interface ModuleDiscoveryResult {
  /** Discovered modules */
  modules: Module[];
  /** Errors encountered during discovery */
  errors: string[];
}

/**
 * Module validation result
 */
export interface ModuleValidationResult {
  /** Whether the module is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
} 
