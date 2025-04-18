/**
 * Represents a node in a dependency graph
 */
export interface DependencyNode<T> {
  /** The value stored in the node */
  value: T;
  /** The dependencies of this node */
  dependencies: Set<string>;
  /** The dependents of this node (nodes that depend on this node) */
  dependents: Set<string>;
}

/**
 * Represents a dependency graph
 */
export interface DependencyGraph<T> {
  /** Map of node IDs to nodes */
  nodes: Map<string, DependencyNode<T>>;
  /** Adds a node to the graph */
  addNode: (id: string, value: T) => void;
  /** Adds a dependency relationship between nodes */
  addDependency: (from: string, to: string) => void;
  /** Gets a sorted list of nodes in dependency order */
  getTopologicalSort: () => T[];
  /** Detects circular dependencies in the graph */
  detectCircularDependencies: () => CircularDependency[];
  /** Gets all nodes in the graph */
  getAll: () => T[];
}

/**
 * Represents a circular dependency in the graph
 */
export interface CircularDependency {
  /** The cycle path, which is an array of node IDs forming a cycle */
  path: string[];
}

/**
 * Result of dependency resolution
 */
export interface DependencyResolutionResult<T> {
  /** Sorted items in dependency order */
  sorted: T[];
  /** Whether circular dependencies were detected */
  hasCircular: boolean;
  /** List of detected circular dependencies */
  circularDependencies: CircularDependency[];
}

/**
 * Options for dependency resolution
 */
export interface DependencyResolutionOptions {
  /** Whether to throw an error on circular dependencies */
  throwOnCircular?: boolean;
  /** Whether to include optional dependencies */
  includeOptional?: boolean;
  /** Whether to evaluate conditional dependencies */
  evaluateConditions?: boolean;
  /** Context for evaluating conditions */
  conditionContext?: Record<string, any>;
} 
