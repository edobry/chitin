/**
 * Orders fibers by their dependencies with foundational fibers first
 * @param fibers Fiber IDs to order
 * @param config Configuration object
 * @returns Ordered list of fiber IDs
 */
export function orderFibersByDependencies(fibers: string[], config: Record<string, any>): string[] {
  // Always put core fiber first
  const orderedFibers: string[] = [];
  if (fibers.includes('core')) {
    orderedFibers.push('core');
    fibers = fibers.filter(id => id !== 'core');
  }

  // These are the "foundational" fibers that should appear high in the list
  const priorityFibers = ['dev', 'dotfiles'];
  
  // Sort the fibers based on priority, then by dependency count
  const sortedFibers = [...fibers].sort((a, b) => {
    // 1. Check if either fiber is a priority fiber
    const aIsPriority = priorityFibers.includes(a);
    const bIsPriority = priorityFibers.includes(b);
    
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    
    // 2. Sort by dependency count - fibers with fewer dependencies are more foundational
    const aDeps = config[a]?.fiberDeps?.length || 0;
    const bDeps = config[b]?.fiberDeps?.length || 0;
    
    if (aDeps !== bDeps) {
      return aDeps - bDeps; // Fewer dependencies first
    }
    
    // 3. If tied, sort by how many modules the fiber has - more modules = more important
    const aModules = Object.keys(config[a]?.moduleConfig || {}).length;
    const bModules = Object.keys(config[b]?.moduleConfig || {}).length;
    
    if (aModules !== bModules) {
      return bModules - aModules; // More modules first
    }
    
    // 4. As a last resort, sort alphabetically for stable ordering
    return a.localeCompare(b);
  });
  
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
