import { createDependencyGraph } from '../../../modules/dependency';
import { Module, ModuleDependency } from '../../../modules/types';
import { FIBER_NAMES } from '../../../fiber/types';
import { CONFIG_FIELDS } from '../../../config/types';
import { UserConfig } from '../../../types/config';
import { isFiberEnabled } from '../utils';

/**
 * Ensures all fibers have an implicit dependency on core
 * @param fibers List of fiber IDs to process
 * @param dependencyMap Optional dependency map to update (for deps command)
 * @param dependencyInfo Optional dependency detection info to update (for deps command)
 * @param reverseDependencyMap Optional reverse dependency map to update
 * @param graph Optional dependency graph to update (for ordering function)
 */
export function ensureCoreDependencies(
  fibers: string[],
  dependencyMap?: Map<string, string[]>,
  dependencyInfo?: Map<string, {source: string, deps: string[]}[]>,
  reverseDependencyMap?: Map<string, string[]>,
  graph?: ReturnType<typeof createDependencyGraph<string>>
): void {
  // Only process if core is in the fiber list
  if (!fibers.includes(FIBER_NAMES.CORE)) {
    return;
  }
  
  // Make everything depend on core except core itself
  for (const fiberId of fibers) {
    if (fiberId !== FIBER_NAMES.CORE) {
      // Update dependency graph if provided
      if (graph) {
        graph.addDependency(fiberId, FIBER_NAMES.CORE);
      }
      
      // Update dependency map if provided
      if (dependencyMap) {
        const deps = dependencyMap.get(fiberId) || [];
        if (!deps.includes(FIBER_NAMES.CORE)) {
          deps.push(FIBER_NAMES.CORE);
          dependencyMap.set(fiberId, deps);
        }
      }
      
      // Update reverse dependency map if provided
      if (reverseDependencyMap) {
        const reverseDeps = reverseDependencyMap.get(FIBER_NAMES.CORE) || [];
        if (!reverseDeps.includes(fiberId)) {
          reverseDeps.push(fiberId);
          reverseDependencyMap.set(FIBER_NAMES.CORE, reverseDeps);
        }
      }
      
      // Update dependency info if provided
      if (dependencyInfo) {
        const info = dependencyInfo.get(fiberId) || [];
        if (!info.some(entry => entry.deps.includes(FIBER_NAMES.CORE))) {
          info.push({
            source: 'implicit.core',
            deps: [FIBER_NAMES.CORE]
          });
          dependencyInfo.set(fiberId, info);
        }
      }
    }
  }
}

/**
 * Options for fiber ordering
 */
export interface FiberOrderingOptions {
  /** Whether to prioritize configured fibers over discovered ones */
  prioritizeConfigured?: boolean;
  /** Whether to sort alphabetically after dependency ordering */
  sortAlphabetically?: boolean;
  /** Whether to handle special fibers (core, dotfiles) */
  handleSpecialFibers?: boolean;
  /** Whether to sort dependents in a special way (e.g., dev first for core) */
  specialDependentSorting?: boolean;
  /** Whether to include discovered fibers not in the original list */
  includeDiscovered?: boolean;
  /** Whether to filter disabled fibers */
  hideDisabled?: boolean;
  /** Whether to reverse the dependency direction */
  reverse?: boolean;
}

/**
 * Unified function to order fibers based on various criteria
 * @param fibers Fiber IDs to order
 * @param config Configuration object
 * @param modules Array of discovered modules
 * @param options Ordering options
 * @returns Ordered list of fiber IDs
 */
export function orderFibers(
  fibers: string[], 
  config: Record<string, any>,
  modules: Module[] = [],
  options: FiberOrderingOptions = {}
): string[] {
  const {
    prioritizeConfigured = false,
    sortAlphabetically = false,
    handleSpecialFibers = true,
    specialDependentSorting = false,
    includeDiscovered = false,
    hideDisabled = false,
    reverse = false
  } = options;

  // Create a dependency graph for topological sorting
  const graph = createDependencyGraph<string>();
  
  // Make a copy of fibers to avoid side effects
  let fibersToSort = [...fibers];
  
  // Add discovered fibers if requested
  if (includeDiscovered) {
    const discoveredFibers = modules
      .filter(m => m.type === 'fiber')
      .map(m => m.id)
      .filter(id => !fibersToSort.includes(id));
    fibersToSort = [...fibersToSort, ...discoveredFibers];
  }
  
  // Filter disabled fibers if requested
  if (hideDisabled) {
    fibersToSort = fibersToSort.filter(fiberId => {
      const isCore = fiberId === FIBER_NAMES.CORE;
      return isCore || isFiberEnabled(fiberId, config as UserConfig);
    });
  }
  
  // Add all fibers to the graph
  for (const fiberId of fibersToSort) {
    graph.addNode(fiberId, fiberId);
  }
  
  // Precompute module map for O(1) lookups
  const moduleMap = new Map<string, Module>();
  for (const m of modules) {
    moduleMap.set(m.id, m);
  }
  
  // Add dependency relationships
  for (const fiberId of fibersToSort) {
    // Use precomputed module map
    const fiberModule = moduleMap.get(fiberId);
    let fiberDeps: string[] = [];
    if (fiberModule && fiberModule.metadata && fiberModule.metadata.dependencies) {
      fiberDeps = fiberModule.metadata.dependencies.map(dep => dep.moduleId);
    } else if (fiberModule && fiberModule.config && fiberModule.config[CONFIG_FIELDS.FIBER_DEPS]) {
      const val = fiberModule.config[CONFIG_FIELDS.FIBER_DEPS];
      fiberDeps = Array.isArray(val) ? val as string[] : [];
    } else if (config[fiberId] && config[fiberId][CONFIG_FIELDS.FIBER_DEPS]) {
      const val = config[fiberId][CONFIG_FIELDS.FIBER_DEPS];
      fiberDeps = Array.isArray(val) ? val as string[] : [];
    }
    for (const depId of fiberDeps) {
      if (fibersToSort.includes(depId)) {
        if (reverse) {
          graph.addDependency(depId, fiberId);
        } else {
          graph.addDependency(fiberId, depId);
        }
      }
    }
  }
  
  // Ensure all fibers have an implicit dependency on core
  if (handleSpecialFibers) {
  ensureCoreDependencies(fibersToSort, undefined, undefined, undefined, graph);
  }
  
  // Perform topological sort
  let sorted = graph.getTopologicalSort();
  
  // Handle special fibers if requested
  if (handleSpecialFibers) {
    const result: string[] = [];
    
    // Add core first if it exists
    if (fibersToSort.includes(FIBER_NAMES.CORE)) {
      result.push(FIBER_NAMES.CORE);
    }
    
    // Add dotfiles second if it exists
    if (fibersToSort.includes(FIBER_NAMES.DOTFILES)) {
      result.push(FIBER_NAMES.DOTFILES);
    }
    
    // Add remaining fibers in topological order, excluding core and dotfiles
    for (const fiberId of sorted) {
      if (fiberId !== FIBER_NAMES.CORE && fiberId !== FIBER_NAMES.DOTFILES) {
        result.push(fiberId);
      }
    }
    
    sorted = result;
  }
  
  // Prioritize configured fibers if requested
  if (prioritizeConfigured) {
    const configuredFibers = fibersToSort.filter(id => fibers.includes(id));
    const discoveredFibers = fibersToSort.filter(id => !fibers.includes(id));
    
    // Sort each group by their position in the topological sort
    const fiberOrderMap = new Map<string, number>();
    sorted.forEach((fiberId, index) => {
      fiberOrderMap.set(fiberId, index);
    });
    
    const sortByTopologicalOrder = (a: string, b: string) => {
      const aIndex = fiberOrderMap.get(a) ?? -1;
      const bIndex = fiberOrderMap.get(b) ?? -1;
      return aIndex - bIndex;
    };
    
    sorted = [
      ...configuredFibers.sort(sortByTopologicalOrder),
      ...discoveredFibers.sort(sortByTopologicalOrder)
    ];
  }
  
  // Apply special dependent sorting if requested
  if (specialDependentSorting) {
    const dependencyMap = new Map<string, string[]>();
    // Cache the topological sort result
    const topoSort = [...sorted];
    for (const fiberId of fibersToSort) {
      // Get all nodes that depend on this fiber
      const deps = fibersToSort.filter(otherId => {
        // Use cached topoSort instead of recomputing
        const otherDeps = topoSort.filter(id => id !== fiberId && id !== otherId);
        return otherDeps.includes(fiberId);
      });
      dependencyMap.set(fiberId, deps);
    }
    // Sort dependents in each entry
    for (const [fiberId, dependents] of dependencyMap.entries()) {
      dependents.sort((a, b) => {
        if (fiberId === FIBER_NAMES.CORE) {
          if (a === 'dev') return -1;
          if (b === 'dev') return 1;
          if (a === 'dotfiles') return -1;
          if (b === 'dotfiles') return 1;
        }
        return a.localeCompare(b);
      });
    }
  }
  
  // Sort alphabetically if requested
  if (sortAlphabetically) {
    sorted.sort((a, b) => {
      if (a === FIBER_NAMES.CORE) return -1;
      if (b === FIBER_NAMES.CORE) return 1;
      return a.localeCompare(b);
    });
  }
  
  return sorted;
}

/**
 * Gets a list of fibers that depend on the specified fiber
 * @param fiberId Fiber ID to check
 * @param config Configuration object
 * @returns Array of fiber IDs that depend on the specified fiber
 */
export function getDependentFibers(fiberId: string, config: Record<string, any>): string[] {
  return Object.keys(config)
    .filter(id => config[id]?.[CONFIG_FIELDS.FIBER_DEPS]?.includes(fiberId))
    .filter(id => id !== fiberId);
}

/**
 * Gets dependencies for a specific chain
 * @param chainId Chain ID to check
 * @param moduleConfig Module configuration object
 * @returns Array of chain dependencies
 */
export function getChainDependencies(chainId: string, moduleConfig: Record<string, any>): string[] {
  if (!moduleConfig || !moduleConfig[chainId]) return [];
  
  // Get direct dependencies from dependencies field
  const deps = moduleConfig[chainId].dependencies || [];
  
  // Get additional dependencies from chainDeps field if it exists
  const chainDeps = moduleConfig[chainId][CONFIG_FIELDS.CHAIN_DEPS] || [];
  
  return [...deps, ...chainDeps];
}

/**
 * Process a module dependency to extract the module ID
 * @param dep Module dependency object
 * @returns Module ID
 */
export function processDependency(dep: ModuleDependency): string {
  return dep.moduleId;
} 
