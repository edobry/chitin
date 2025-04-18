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
    
    // Skip if this chain is already associated with a fiber
    if (Array.from(fiberChainMap.values()).some(chains => chains.includes(chainId))) {
      continue;
    }
    
    // Try to find the fiber this chain belongs to based on path
    let foundFiber = false;
    for (const fiberId of displayFiberIds) {
      const fiberModule = discoveredFiberMap.get(fiberId) || 
                         moduleResult.modules.find((m) => m.id === fiberId);
      
      if (fiberModule && fiberModule.path && chainPath.includes(fiberModule.path)) {
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
 * Orders fibers with configured ones first, followed by discovered ones
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
  return Array.from(allFiberModuleIds).sort((a, b) => {
    // If both fibers are in the config or both are not, sort by orderedFibers position
    const aInConfig = allFibers.includes(a);
    const bInConfig = allFibers.includes(b);
    
    if (aInConfig && !bInConfig) return -1;
    if (!aInConfig && bInConfig) return 1;
    
    // If both are in config, respect the original ordering
    if (aInConfig && bInConfig) {
      const aIndex = orderedFibers.indexOf(a);
      const bIndex = orderedFibers.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // If one isn't in ordered fibers, fall back to alphabetical
    }
    
    // Otherwise sort alphabetically
    return a.localeCompare(b);
  });
} 
