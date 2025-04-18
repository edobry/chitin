import { ToolDependencyChecker, ModuleFilter } from '../types';

/**
 * Get fiber IDs from the user config
 * This extracts only the actual fiber IDs (including core)
 * @param config User configuration
 * @returns Array of fiber IDs
 */
export function getFiberIds(config: Record<string, any>): string[] {
  // Get top-level keys from config, excluding non-fiber system properties
  return Object.keys(config).filter(key => 
    // Exclude system properties copied at the top level
    key !== 'projectDir' && 
    key !== 'dotfilesDir' && 
    key !== 'checkTools' && 
    key !== 'installToolDeps' && 
    key !== 'autoInitDisabled' && 
    key !== 'failOnError' && 
    key !== 'loadParallel' && 
    // Exclude special collections (but not their contents)
    key !== 'fibers' && 
    key !== 'chains' && 
    key !== 'tools'
  );
}

/**
 * Gets loadable fibers from config
 * @param config User configuration
 * @param dependencyChecker Function to check if tool dependencies are satisfied
 * @returns Array of fiber IDs that are enabled and have satisfied dependencies
 */
export function getLoadableFibers(
  config: Record<string, any>,
  dependencyChecker: ToolDependencyChecker = () => true
): string[] {
  return getFiberIds(config)
    .filter(fiberId => {
      // Core is always loaded
      if (fiberId === 'core') {
        return true;
      }
      
      const fiber = config[fiberId];
      
      // Skip if explicitly disabled
      if (fiber.enabled === false) {
        return false;
      }
      
      // Check tool dependencies if toolDeps is specified
      const toolDeps = fiber.toolDeps || [];
      return toolDeps.every((tool: string) => dependencyChecker(tool));
    });
}

/**
 * Checks if a fiber is enabled in config
 * @param fiberId Fiber ID to check
 * @param config User configuration
 * @returns Whether the fiber is enabled
 */
export function isFiberEnabled(fiberId: string, config: Record<string, any>): boolean {
  // Ensure we're only checking actual fibers
  if (!getFiberIds(config).includes(fiberId)) {
    return false;
  }
  
  // Core is always enabled
  if (fiberId === 'core') {
    return true;
  }
  
  const fiber = config[fiberId];
  return fiber.enabled !== false;
}

/**
 * Checks if a fiber's dependencies are satisfied
 * @param fiberId Fiber ID to check
 * @param config User configuration
 * @param dependencyChecker Function to check tool dependencies
 * @returns Whether all dependencies are satisfied
 */
export function areFiberDependenciesSatisfied(
  fiberId: string,
  config: Record<string, any>,
  dependencyChecker: ToolDependencyChecker = () => true
): boolean {
  // Ensure we're only checking actual fibers
  if (!getFiberIds(config).includes(fiberId)) {
    return false;
  }
  
  // Core has no tool dependencies
  if (fiberId === 'core') {
    return true;
  }
  
  const fiber = config[fiberId];
  const toolDeps = fiber.toolDeps || [];
  return toolDeps.every((tool: string) => dependencyChecker(tool));
}

/**
 * Gets all chains defined in the fibers (including from core)
 * @param config User configuration
 * @param fiberIds Fibers to check for chains (defaults to all fibers)
 * @returns Array of chain IDs
 */
export function getChainIds(
  config: Record<string, any>,
  fiberIds?: string[]
): string[] {
  const fibersToCheck = fiberIds || getFiberIds(config);
  const chainIds = new Set<string>();
  
  // Check each fiber for moduleConfig entries (chains)
  for (const fiberId of fibersToCheck) {
    const fiber = config[fiberId];
    if (fiber && fiber.moduleConfig) {
      Object.keys(fiber.moduleConfig).forEach(chainId => chainIds.add(chainId));
    }
  }
  
  return Array.from(chainIds);
}

/**
 * Gets dependency information for a chain
 * @param chainId Chain ID
 * @param config User configuration
 * @param loadableFibers Fibers to check for the chain
 * @returns Array of chain IDs that this chain depends on
 */
export function getChainDependencies(
  chainId: string,
  config: Record<string, any>,
  loadableFibers: string[]
): string[] {
  const dependencies = new Set<string>();
  
  // Look for the chain in all loadable fibers
  for (const fiberId of loadableFibers) {
    const fiber = config[fiberId];
    if (!fiber || !fiber.moduleConfig || !fiber.moduleConfig[chainId]) {
      continue;
    }
    
    const chainConfig = fiber.moduleConfig[chainId];
    
    // Add chain dependencies if specified
    if (chainConfig.deps && Array.isArray(chainConfig.deps)) {
      chainConfig.deps.forEach((dep: string) => dependencies.add(dep));
    }
    
    // Add chain dependencies by tool dependencies
    if (chainConfig.toolDeps && Array.isArray(chainConfig.toolDeps)) {
      // Find which chains provide these tools
      chainConfig.toolDeps.forEach((toolDep: string) => {
        // Check all chains in all loadable fibers for tool provision
        for (const otherFiberId of loadableFibers) {
          const otherFiber = config[otherFiberId];
          if (!otherFiber || !otherFiber.moduleConfig) {
            continue;
          }
          
          // Check each chain in this fiber
          Object.entries(otherFiber.moduleConfig).forEach(([otherChainId, otherChainConfig]: [string, any]) => {
            // Skip self-dependencies
            if (otherChainId === chainId) {
              return;
            }
            
            // If this chain provides the needed tool, add as dependency
            if (otherChainConfig.provides && 
                Array.isArray(otherChainConfig.provides) && 
                otherChainConfig.provides.includes(toolDep)) {
              dependencies.add(otherChainId);
            }
          });
        }
      });
    }
  }
  
  return Array.from(dependencies);
}

/**
 * Orders chains based on their dependencies
 * @param chainIds Chain IDs to order
 * @param config User configuration
 * @param loadableFibers Loadable fibers
 * @returns Ordered array of chain IDs
 */
export function orderChainsByDependencies(
  chainIds: string[],
  config: Record<string, any>,
  loadableFibers: string[]
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: string[] = [];
  
  // Recursive depth-first search for topological sorting
  function visit(chainId: string) {
    // Skip if already processed
    if (visited.has(chainId)) {
      return;
    }
    
    // Check for circular dependencies
    if (visiting.has(chainId)) {
      console.warn(`Circular dependency detected involving ${chainId}`);
      return;
    }
    
    // Mark as being processed
    visiting.add(chainId);
    
    // Process dependencies first
    const dependencies = getChainDependencies(chainId, config, loadableFibers);
    for (const dep of dependencies) {
      if (chainIds.includes(dep)) {
        visit(dep);
      }
    }
    
    // Mark as processed and add to ordered list
    visiting.delete(chainId);
    visited.add(chainId);
    ordered.push(chainId);
  }
  
  // Visit each chain
  for (const chainId of chainIds) {
    if (!visited.has(chainId)) {
      visit(chainId);
    }
  }
  
  return ordered;
}

/**
 * Creates a filter function for chains based on fiber configs
 * @param config User configuration
 * @param loadableFibers Array of loadable fiber IDs
 * @returns Filter function
 */
export function createChainFilter(
  config: Record<string, any>,
  loadableFibers: string[]
): ModuleFilter {
  return (chainId: string): boolean => {
    // Core is always loaded if it's in loadableFibers
    const coreIncluded = loadableFibers.includes('core');
    
    // Check if chain is in core and we're including core
    if (coreIncluded && config.core?.moduleConfig && chainId in config.core.moduleConfig) {
      return true;
    }
    
    // Check if chain is in any loadable fiber
    return loadableFibers.some(fiberId => {
      if (fiberId === 'core') return false; // Already checked core
      
      const fiber = config[fiberId];
      const moduleConfig = fiber.moduleConfig || {};
      
      return chainId in moduleConfig;
    });
  };
}

/**
 * Creates a new fiber manager instance
 * @returns FiberManager instance
 */
export function createFiberManager() {
  // Store for fiber states
  const fibers: Array<{
    id: string,
    active: boolean,
    modules: string[],
    lastActivated?: Date
  }> = [];
  
  return {
    /**
     * Get all registered fibers
     */
    getAllFibers: () => {
      return [...fibers];
    },
    
    /**
     * Register a new fiber
     */
    registerFiber: (id: string, modules: string[]) => {
      // Don't register duplicates
      if (fibers.some(f => f.id === id)) {
        return false;
      }
      
      fibers.push({
        id,
        active: false,
        modules
      });
      
      return true;
    },
    
    /**
     * Activate a fiber
     */
    activateFiber: (id: string) => {
      const fiber = fibers.find(f => f.id === id);
      if (!fiber) {
        return false;
      }
      
      fiber.active = true;
      fiber.lastActivated = new Date();
      return true;
    },
    
    /**
     * Deactivate a fiber
     */
    deactivateFiber: (id: string) => {
      const fiber = fibers.find(f => f.id === id);
      if (!fiber) {
        return false;
      }
      
      fiber.active = false;
      return true;
    },
    
    /**
     * Check if a fiber is active
     */
    isFiberActive: (id: string) => {
      const fiber = fibers.find(f => f.id === id);
      return fiber ? fiber.active : false;
    },
    
    /**
     * Get all active fibers
     */
    getActiveFibers: () => {
      return fibers.filter(f => f.active);
    }
  };
}

/**
 * Creates a filter function for modules based on fiber states
 * @param includeInactive Whether to include modules from inactive fibers
 * @returns Filter function for modules
 */
export function createFiberFilter(includeInactive: boolean = false): (moduleId: string, fiberStates: Array<{id: string, active: boolean, modules: string[]}>) => boolean {
  return (moduleId: string, fiberStates: Array<{id: string, active: boolean, modules: string[]}>): boolean => {
    // Check if module is in any fiber
    return fiberStates.some(fiber => {
      // Skip inactive fibers if not including them
      if (!includeInactive && !fiber.active) {
        return false;
      }
      
      // Check if module is in this fiber
      return fiber.modules.includes(moduleId);
    });
  };
}
