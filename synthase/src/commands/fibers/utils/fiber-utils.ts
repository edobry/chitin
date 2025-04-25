import { FIBER_NAMES } from '../../../fiber/types';
import { CONFIG_FIELDS } from '../../../config/types';
import { UserConfig } from '../../../types/config';
import { Module } from '../../../modules/types';
import { findChitinDir } from '../../../utils/path';
import { getCoreConfigValue } from '../../../config';

/**
 * Check if a fiber is enabled in the configuration
 * @param fiberId Fiber ID to check
 * @param config Configuration object
 * @returns Whether the fiber is enabled
 */
export function isFiberEnabled(fiberId: string, config: UserConfig): boolean {
  // Core is always enabled
  if (fiberId === FIBER_NAMES.CORE) return true;
  
  // Check if the fiber exists in config
  if (!(fiberId in config)) return false;
  
  // Check if the fiber is explicitly disabled
  return config[fiberId]?.[CONFIG_FIELDS.ENABLED] !== false;
}

/**
 * Gets the path for a fiber, with special handling for core and dotfiles
 * @param fiberId Fiber ID
 * @param fiberModule The fiber module object
 * @param config Configuration object
 * @returns Path to display
 */
export function getFiberPath(
  fiberId: string,
  fiberModule: Module | undefined,
  config: UserConfig
): string {
  if (fiberId === 'dotfiles') {
    return getCoreConfigValue(config, 'dotfilesDir') || fiberModule?.path || "Unknown";
  } else if (fiberId === 'core') {
    return findChitinDir() || fiberModule?.path || "Unknown";
  } else {
    return fiberModule?.path || (config[fiberId] as any)?.path || "Unknown";
  }
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
