import { isFiberEnabled } from './utils';
import { UserConfig, Module } from '../../types';

/**
 * Associates chains with fibers based on configuration and paths
 * @param displayFiberIds Display fiber IDs
 * @param config Configuration
 * @param discoveredChainModules Discovered chain modules
 * @param discoveredFiberMap Map of fiber ID to fiber module
 * @param moduleResult Module discovery result
 * @returns Map of fiber IDs to chain IDs
 */
export function associateChainsByFiber(
  displayFiberIds: string[],
  config: UserConfig,
  discoveredChainModules: Module[],
  discoveredFiberMap: Map<string, Module>,
  moduleResult: { modules: Module[] }
): Map<string, string[]> {
  // Group all chains by fiber, including unconfigured chains
  const fiberChainMap = new Map<string, string[]>();
  
  // First, map chains that are explicitly configured in fibers
  for (const fiberId of displayFiberIds) {
    if (config[fiberId]?.moduleConfig) {
      const configuredChains = Object.keys(config[fiberId].moduleConfig);
      if (configuredChains.length > 0) {
        fiberChainMap.set(fiberId, [...configuredChains]);
      }
    }
  }
  
  // Now process all discovered chains and associate them with fibers
  for (const chainModule of discoveredChainModules) {
    const chainId = chainModule.id;
    const chainPath = chainModule.path;
    
    // Skip if this chain is already associated with a fiber through configuration
    if (Array.from(fiberChainMap.values()).some(chains => chains.includes(chainId))) {
      continue;
    }
    
    // Try to find the fiber this chain belongs to based on path,
    // but with more precise matching to avoid incorrect associations
    let foundFiber = false;
    
    // Sort fibers by path length (descending) to find the most specific match first
    // This ensures we match to the most specific fiber path rather than a parent
    const fiberModulesWithPath = displayFiberIds
      .map(fiberId => {
        const fiberModule = discoveredFiberMap.get(fiberId) || 
                         moduleResult.modules.find((m) => m.id === fiberId);
        return { fiberId, fiberModule };
      })
      .filter(item => item.fiberModule && item.fiberModule.path)
      .sort((a, b) => {
        // Sort by path length (longest first) for more precise matching
        return (b.fiberModule?.path?.length || 0) - (a.fiberModule?.path?.length || 0);
      });
    
    for (const { fiberId, fiberModule } of fiberModulesWithPath) {
      if (fiberModule && fiberModule.path && chainPath.includes(fiberModule.path)) {
        // Make sure we're not associating with 'core' if another more specific fiber matches
        // This prevents the issue with chains being incorrectly associated with 'core'
        if (fiberId === 'core' && fiberModulesWithPath.length > 1) {
          // Skip for now, we might find a better match
          continue;
        }
        
        // Add this chain to the fiber
        if (!fiberChainMap.has(fiberId)) {
          fiberChainMap.set(fiberId, []);
        }
        fiberChainMap.get(fiberId)?.push(chainId);
        foundFiber = true;
        break;
      }
    }
    
    // If no matching fiber was found, add to "standalone" fiber
    if (!foundFiber) {
      if (!fiberChainMap.has('standalone')) {
        fiberChainMap.set('standalone', []);
        
        // Add standalone to display fibers if not already there
        if (!displayFiberIds.includes('standalone')) {
          displayFiberIds.push('standalone');
        }
      }
      fiberChainMap.get('standalone')?.push(chainId);
    }
  }
  
  return fiberChainMap;
}

/**
 * Filters fibers based on the hide-disabled option
 * @param displayFiberIds Array of fiber IDs to potentially display
 * @param config Configuration object
 * @param hideDisabled Whether to hide disabled fibers
 * @returns Filtered array of fiber IDs
 */
export function filterDisabledFibers(
  displayFiberIds: string[],
  config: UserConfig,
  hideDisabled: boolean
): string[] {
  if (!hideDisabled) return displayFiberIds;
  
  return displayFiberIds.filter(fiberId => {
    // Core is always enabled
    if (fiberId === 'core') return true;
    
    // Check if the fiber is enabled
    return isFiberEnabled(fiberId, config);
  });
}

/**
 * Orders fibers with configured ones first, followed by discovered ones,
 * while preserving the dependency order from the topological sort
 * @param allFiberModuleIds Set of all fiber module IDs
 * @param allFibers All fibers in config
 * @param orderedFibers Ordered fibers from dependency resolution
 * @returns Ordered array of fiber IDs
 */
export function orderFibersByConfigAndName(
  allFiberModuleIds: Set<string>,
  allFibers: string[],
  orderedFibers: string[]
): string[] {
  // Create a map for quick lookup of fiber index in the ordered list
  const fiberOrderMap = new Map<string, number>();
  orderedFibers.forEach((fiberId, index) => {
    fiberOrderMap.set(fiberId, index);
  });
  
  return Array.from(allFiberModuleIds).sort((a, b) => {
    // If both fibers are in the config or both are not, sort by orderedFibers position
    const aInConfig = allFibers.includes(a);
    const bInConfig = allFibers.includes(b);
    
    if (aInConfig && !bInConfig) return -1;
    if (!aInConfig && bInConfig) return 1;
    
    // If both are in config, respect the dependency order from topological sort
    if (aInConfig && bInConfig) {
      const aIndex = fiberOrderMap.get(a) ?? -1;
      const bIndex = fiberOrderMap.get(b) ?? -1;
      
      // If both are in the ordered list, use their original order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one is in the ordered list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
    }
    
    // Otherwise sort alphabetically
    return a.localeCompare(b);
  });
} 
