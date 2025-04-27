/**
 * Module configuration value types
 */
export type ModuleConfigValue = 
  | string 
  | number 
  | boolean 
  | null 
  | ModuleConfigValue[] 
  | { [key: string]: ModuleConfigValue };

/**
 * Module configuration type
 */
export type ModuleConfig = Record<string, ModuleConfigValue>;

/**
 * Module data value types
 */
export type ModuleDataValue = 
  | string 
  | number 
  | boolean 
  | null 
  | Date 
  | ModuleDataValue[] 
  | { [key: string]: ModuleDataValue };

/**
 * Module data type
 */
export type ModuleData = Record<string, ModuleDataValue>;

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
  config?: ModuleConfig;
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
 * Module dependency
 */
export interface ModuleDependency {
  /** Module ID */
  moduleId: string;
  /** Whether this is a required dependency */
  required: boolean;
  /** Dependency type */
  type: 'fiber' | 'chain' | 'tool';
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
  data?: ModuleData;
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
}

/**
 * Result of module discovery operation
 */
export interface ModuleDiscoveryResult {
  /** Discovered modules */
  modules: Module[];
  /** Paths that were scanned */
  scannedPaths: string[];
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
