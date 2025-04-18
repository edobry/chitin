import { DependencyGraph, DependencyNode, CircularDependency, DependencyResolutionResult, DependencyResolutionOptions } from './dependency-types';

/**
 * Creates a new dependency graph
 */
export function createDependencyGraph<T>(): DependencyGraph<T> {
  const nodes = new Map<string, DependencyNode<T>>();

  /**
   * Adds a node to the graph
   * @param id Node ID
   * @param value Node value
   */
  const addNode = (id: string, value: T): void => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        value,
        dependencies: new Set<string>(),
        dependents: new Set<string>()
      });
    } else {
      // Update existing node value
      const node = nodes.get(id)!;
      node.value = value;
    }
  };

  /**
   * Adds a dependency relationship between nodes
   * @param from Dependent node ID
   * @param to Dependency node ID
   */
  const addDependency = (from: string, to: string): void => {
    if (!nodes.has(from)) {
      throw new Error(`Node "${from}" not found in dependency graph`);
    }
    if (!nodes.has(to)) {
      throw new Error(`Node "${to}" not found in dependency graph`);
    }

    const fromNode = nodes.get(from)!;
    const toNode = nodes.get(to)!;

    fromNode.dependencies.add(to);
    toNode.dependents.add(from);
  };

  /**
   * Performs a topological sort on the graph
   * @returns Sorted list of node values
   */
  const getTopologicalSort = (): T[] => {
    const result: T[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (nodeId: string): void => {
      if (temp.has(nodeId)) {
        // Circular dependency detected, but we continue
        return;
      }
      if (visited.has(nodeId)) {
        return;
      }
      
      temp.add(nodeId);
      
      const node = nodes.get(nodeId)!;
      for (const depId of node.dependencies) {
        visit(depId);
      }
      
      temp.delete(nodeId);
      visited.add(nodeId);
      result.push(node.value);
    };

    // Visit all nodes
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    // Reverse the result to get correct dependency order
    // Dependencies should come BEFORE the modules that depend on them
    return result;
  };

  /**
   * Detects circular dependencies in the graph
   * @returns List of circular dependencies
   */
  const detectCircularDependencies = (): CircularDependency[] => {
    const result: CircularDependency[] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      if (path.includes(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        result.push({ path: cycle });
        return;
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      path.push(nodeId);
      
      const node = nodes.get(nodeId)!;
      for (const depId of node.dependencies) {
        dfs(depId);
      }
      
      path.pop();
    };

    // Run DFS for each node
    for (const nodeId of nodes.keys()) {
      path.length = 0; // Clear path for each new start node
      dfs(nodeId);
    }

    return result;
  };

  /**
   * Gets all node values in the graph
   * @returns List of all node values
   */
  const getAll = (): T[] => {
    return Array.from(nodes.values()).map(node => node.value);
  };

  return {
    nodes,
    addNode,
    addDependency,
    getTopologicalSort,
    detectCircularDependencies,
    getAll
  };
}

/**
 * Resolves dependencies for a set of items
 * @param items Items to resolve dependencies for
 * @param getItemId Function to get item ID
 * @param getItemDependencies Function to get item dependencies
 * @param options Options for dependency resolution
 * @returns Dependency resolution result
 */
export function resolveDependencies<T>(
  items: T[],
  getItemId: (item: T) => string,
  getItemDependencies: (item: T) => string[],
  options: DependencyResolutionOptions = {}
): DependencyResolutionResult<T> {
  const graph = createDependencyGraph<T>();
  
  // Add all items to the graph
  for (const item of items) {
    const id = getItemId(item);
    graph.addNode(id, item);
  }
  
  // Add dependencies
  for (const item of items) {
    const id = getItemId(item);
    const dependencies = getItemDependencies(item);
    
    for (const depId of dependencies) {
      // Skip if dependent doesn't exist (optional external dependency)
      if (!graph.nodes.has(depId)) {
        continue;
      }
      graph.addDependency(id, depId);
    }
  }
  
  // Detect circular dependencies
  const circularDependencies = graph.detectCircularDependencies();
  const hasCircular = circularDependencies.length > 0;
  
  // Throw error if configured to do so and circular dependencies are found
  if (options.throwOnCircular && hasCircular) {
    const cycles = circularDependencies.map(dep => dep.path.join(' -> ')).join(', ');
    throw new Error(`Circular dependencies detected: ${cycles}`);
  }
  
  // Get sorted items
  const sorted = graph.getTopologicalSort();
  
  return {
    sorted,
    hasCircular,
    circularDependencies
  };
} 
