import { UserConfig } from '../../../types/config';
import { Module } from '../../../modules/types';
import { isFiberEnabled } from './fiber-utils';

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
    
    // If no matching fiber was found, simply don't associate this chain with any fiber
    // We no longer add unassociated chains to a "standalone" fiber
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
