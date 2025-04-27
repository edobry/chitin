import { ToolConfig } from './config';

/**
 * Chain-specific configuration value types
 */
export type ChainConfigValue = 
  | string 
  | number 
  | boolean 
  | null 
  | ChainConfigValue[] 
  | { [key: string]: ChainConfigValue };

/**
 * Chain-specific configuration type
 */
export type ChainSpecificConfig = Record<string, ChainConfigValue>;

/**
 * Chain configuration interface
 */
export interface ChainConfig {
  /** Whether the chain is enabled */
  enabled?: boolean;
  /** Chain dependencies */
  chainDeps?: string[];
  /** Tool configuration */
  tools?: Record<string, ToolConfig>;
  /** Tool dependencies */
  toolDeps?: string[];
  /** Features provided by this chain */
  provides?: string[];
  /** Additional chain-specific configuration */
  config?: ChainSpecificConfig;
}

/**
 * Chain state interface
 */
export interface ChainState {
  /** Whether the chain is loaded */
  loaded: boolean;
  /** Last loaded timestamp */
  lastLoaded?: Date;
  /** Last error if any occurred during loading */
  lastError?: string;
  /** Additional state data */
  data?: Record<string, ChainConfigValue>;
}

/**
 * Chain validation result
 */
export interface ChainValidationResult {
  /** Whether the chain is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Chain dependency graph node
 */
export interface ChainDependencyNode {
  /** Chain ID */
  id: string;
  /** Dependencies */
  dependencies: string[];
  /** Dependents */
  dependents: string[];
  /** Whether this chain is enabled */
  enabled: boolean;
  /** Features provided by this chain */
  provides: string[];
}

/**
 * Chain dependency graph
 */
export interface ChainDependencyGraph {
  /** Graph nodes */
  nodes: Record<string, ChainDependencyNode>;
  /** Ordered list of chain IDs */
  order: string[];
} 
