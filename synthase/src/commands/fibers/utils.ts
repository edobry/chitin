import { createDependencyGraph } from '../../modules/dependency';
import { Module } from '../../types';

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
  // Always put core and dotfiles first in that order
  const orderedFibers: string[] = [];
  
  // Handle core fiber first
  if (fibers.includes('core')) {
    orderedFibers.push('core');
    fibers = fibers.filter(id => id !== 'core');
  }
  
  // Always place dotfiles immediately after core if it exists
  if (fibers.includes('dotfiles')) {
    orderedFibers.push('dotfiles');
    fibers = fibers.filter(id => id !== 'dotfiles');
  }

  // Use dependency resolution to create proper topological order
  // Create a dependency graph
  const graph = createDependencyGraph<string>();
  
  // Add all fibers to the graph
  for (const fiberId of fibers) {
    graph.addNode(fiberId, fiberId);
  }
  
  // Add dependency relationships
  for (const fiberId of fibers) {
    // First try to get dependencies from module metadata
    const fiberModule = modules.find(m => m.id === fiberId && m.type === 'fiber');
    let fiberDeps: string[] = [];
    
    if (fiberModule && fiberModule.metadata.dependencies) {
      fiberDeps = fiberModule.metadata.dependencies.map(dep => dep.moduleId);
    }
    
    // Fallback to config if no metadata dependencies
    if (fiberDeps.length === 0) {
      fiberDeps = config[fiberId]?.fiberDeps || [];
    }
    
    for (const depId of fiberDeps) {
      // Only add the dependency if it's in our fiber list
      if (fibers.includes(depId)) {
        // IMPORTANT: The dependency relationship is from dependent to dependency
        // For proper sorting, the dependent should depend on dependency
        // For example, if cloud depends on dev, then cloud should come AFTER dev
        graph.addDependency(fiberId, depId);
      }
    }
  }
  
  // Get topologically sorted fibers
  // This ensures dependencies come BEFORE dependents
  const sortedFibers = graph.getTopologicalSort();
  
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
    .filter(id => config[id]?.fiberDeps?.includes(fiberId))
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
  if (fiberId === 'core') return true;
  
  // Check if the fiber exists in config
  if (!(fiberId in config)) return false;
  
  // Check if the fiber is explicitly disabled
  return config[fiberId]?.enabled !== false;
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
  const chainDeps = moduleConfig[chainId].chainDeps || [];
  
  return [...deps, ...chainDeps];
}

/**
 * Counts displayed modules for summary
 * @param fiberIds Fiber IDs being displayed
 * @param fiberChainMap Map of fibers to their chains
 * @param unmappedChains Any standalone chains
 * @returns Object with fiber and chain counts
 */
export function countDisplayedModules(
  fiberIds: string[],
  fiberChainMap: Map<string, string[]>,
  unmappedChains: string[] = []
): { fibers: number, chains: number } {
  let fiberCount = 0;
  let chainCount = 0;
  
  for (const fiberId of fiberIds) {
    fiberCount++;
    const chains = fiberChainMap.get(fiberId) || [];
    chainCount += chains.length;
  }
  
  // Add standalone chains
  chainCount += unmappedChains.length;
  
  return { fibers: fiberCount, chains: chainCount };
} 
