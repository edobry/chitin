import { createDependencyGraph } from '../../modules/dependency';
import { Module } from '../../types';
import fs from 'fs';
import yaml from 'js-yaml';
import { join } from 'path';
import { FIBER_NAMES, CONFIG_FIELDS, FILE_NAMES } from '../../constants';

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
 * Orders fibers by their dependencies with foundational fibers first
 * @param fibers Fiber IDs to order
 * @param config Configuration object
 * @param modules Array of discovered modules
 * @returns Ordered list of fiber IDs
 */
export function orderFibersByDependencies(
  fibers: string[], 
  config: Record<string, any>,
  modules: Module[] = []
): string[] {
  // Create a dependency graph for topological sorting
  const graph = createDependencyGraph<string>();
  
  // Make a copy of fibers to avoid side effects
  const fibersToSort = [...fibers];
  
  // Add all fibers to the graph
  for (const fiberId of fibersToSort) {
    graph.addNode(fiberId, fiberId);
  }
  
  // Add dependency relationships
  for (const fiberId of fibersToSort) {
    // First try to get dependencies from module metadata
    const fiberModule = modules.find(m => m.id === fiberId && m.type === 'fiber');
    let fiberDeps: string[] = [];
    
    if (fiberModule && fiberModule.metadata && fiberModule.metadata.dependencies) {
      fiberDeps = fiberModule.metadata.dependencies.map(dep => dep.moduleId);
    }
    // Then try to get dependencies from the module's config 
    else if (fiberModule && fiberModule.config && fiberModule.config[CONFIG_FIELDS.FIBER_DEPS]) {
      fiberDeps = fiberModule.config[CONFIG_FIELDS.FIBER_DEPS];
    } 
    // Fallback to merged config if needed
    else if (config[fiberId] && config[fiberId][CONFIG_FIELDS.FIBER_DEPS]) {
      fiberDeps = config[fiberId][CONFIG_FIELDS.FIBER_DEPS];
    }
    
    for (const depId of fiberDeps) {
      // Only add the dependency if it's in our fiber list
      if (fibersToSort.includes(depId)) {
        // Add dependency relationship to graph
        graph.addDependency(fiberId, depId);
      }
    }
  }
  
  // Ensure all fibers have an implicit dependency on core
  ensureCoreDependencies(fibersToSort, undefined, undefined, undefined, graph);
  
  // Get topologically sorted fibers (dependencies come before dependents)
  let sortedFibers = graph.getTopologicalSort();
  
  // Handle special case fibers - core must be first and dotfiles second (depending on core)
  // Remove core and dotfiles from the sorted list
  sortedFibers = sortedFibers.filter(id => id !== FIBER_NAMES.CORE && id !== FIBER_NAMES.DOTFILES);
  
  // Create the final ordered list with core first, dotfiles second, then the rest 
  const orderedFibers: string[] = [];
  
  // Add core if present in the original list
  if (fibers.includes(FIBER_NAMES.CORE)) {
    orderedFibers.push(FIBER_NAMES.CORE);
  }
  
  // Add dotfiles if present in the original list
  if (fibers.includes(FIBER_NAMES.DOTFILES)) {
    orderedFibers.push(FIBER_NAMES.DOTFILES);
  }
  
  // Add the remaining sorted fibers
  return [...orderedFibers, ...sortedFibers];
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
 * Check if a fiber is enabled in the configuration
 * @param fiberId Fiber ID to check
 * @param config Configuration object
 * @returns Whether the fiber is enabled
 */
export function isFiberEnabled(fiberId: string, config: Record<string, any>): boolean {
  // Core is always enabled
  if (fiberId === FIBER_NAMES.CORE) return true;
  
  // Check if the fiber exists in config
  if (!(fiberId in config)) return false;
  
  // Check if the fiber is explicitly disabled
  return config[fiberId]?.[CONFIG_FIELDS.ENABLED] !== false;
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
 * Counts displayed modules for summary
 * @param fiberIds Fiber IDs being displayed
 * @param fiberChainMap Map of fibers to their chains
 * @returns Object with fiber and chain counts
 */
export function countDisplayedModules(
  fiberIds: string[],
  fiberChainMap: Map<string, string[]>
): { fibers: number, chains: number } {
  let fiberCount = 0;
  let chainCount = 0;
  
  for (const fiberId of fiberIds) {
    fiberCount++;
    const chains = fiberChainMap.get(fiberId) || [];
    chainCount += chains.length;
  }
  
  return { fibers: fiberCount, chains: chainCount };
} 
