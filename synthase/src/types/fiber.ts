import { ChainConfig, ToolConfig } from './config';

/**
 * Fiber-specific configuration value types
 */
export type FiberConfigValue = 
  | string 
  | number 
  | boolean 
  | null 
  | FiberConfigValue[] 
  | { [key: string]: FiberConfigValue };

/**
 * Fiber-specific configuration type
 */
export type FiberSpecificConfig = Record<string, FiberConfigValue>;

/**
 * Fiber configuration interface
 */
export interface FiberConfig {
  /** Whether the fiber is enabled */
  enabled?: boolean;
  /** Fiber dependencies */
  fiberDeps?: string[];
  /** Module configuration */
  moduleConfig?: Record<string, ChainConfig>;
  /** Tool configuration */
  tools?: Record<string, ToolConfig>;
  /** Tool dependencies */
  toolDeps?: string[];
  /** Additional fiber-specific configuration */
  config?: FiberSpecificConfig;
}

/**
 * Fiber state interface
 */
export interface FiberState {
  /** Whether the fiber is loaded */
  loaded: boolean;
  /** Last loaded timestamp */
  lastLoaded?: Date;
  /** Last error if any occurred during loading */
  lastError?: string;
  /** Additional state data */
  data?: Record<string, FiberConfigValue>;
}

/**
 * Fiber validation result
 */
export interface FiberValidationResult {
  /** Whether the fiber is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Fiber dependency graph node
 */
export interface FiberDependencyNode {
  /** Fiber ID */
  id: string;
  /** Dependencies */
  dependencies: string[];
  /** Dependents */
  dependents: string[];
  /** Whether this is a core fiber */
  isCore: boolean;
  /** Whether this fiber is enabled */
  enabled: boolean;
}

/**
 * Fiber dependency graph
 */
export interface FiberDependencyGraph {
  /** Graph nodes */
  nodes: Record<string, FiberDependencyNode>;
  /** Ordered list of fiber IDs */
  order: string[];
}

/**
 * Fiber manager for handling fiber configurations
 */
export interface FiberManager {
  /** Get all registered fibers */
  getAllFibers: () => FiberState[];
  /** Get enabled fibers with satisfied dependencies */
  getLoadableFibers: () => FiberState[];
  /** Check if a fiber is enabled in configuration */
  isFiberEnabled: (id: string) => boolean;
  /** Check if a fiber's tool dependencies are satisfied */
  areDependenciesSatisfied: (id: string) => boolean;
  /** Register a new fiber from configuration */
  registerFiber: (id: string, config: Partial<FiberState>) => void;
}

/**
 * Tool dependency checker function
 */
export type ToolDependencyChecker = (tool: string) => boolean;

/**
 * Filter function for filtering modules based on fiber configs
 */
export type ModuleFilter = (moduleId: string) => boolean; 
