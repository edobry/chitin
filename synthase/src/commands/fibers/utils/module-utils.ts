/**
 * @file module-utils.ts
 * @description Utility functions for working with modules
 */

import { Module, ModuleDiscoveryResult } from '../../../modules/types';

/**
 * Find a module by ID and optionally type
 */
export function findModuleById(moduleResult: ModuleDiscoveryResult, id: string, type?: string): Module | undefined {
  return moduleResult.modules.find(m => 
    m.id === id && (!type || m.type === type)
  );
}

/**
 * Get a module from a module map by ID
 */
export function getModuleFromMap(moduleMap: Map<string, Module>, id: string): Module | undefined {
  return moduleMap.get(id);
}

/**
 * Check if a module exists in a module map
 */
export function moduleExists(moduleMap: Map<string, Module>, id: string): boolean {
  return moduleMap.has(id);
} 
