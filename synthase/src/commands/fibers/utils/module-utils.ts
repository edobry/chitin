import { Module } from '../../../modules/types';

/**
 * Find a module in a list of modules by ID and optionally by type
 * @param modules List of modules to search
 * @param id Module ID to find
 * @param type Optional module type filter
 * @returns The found module or undefined
 */
export function findModuleById(modules: Module[], id: string, type?: 'fiber' | 'chain'): Module | undefined {
  return modules.find(module => 
    module.id === id && (type === undefined || module.type === type)
  );
}

/**
 * Get a module from a module map by its ID
 * @param moduleMap Map of modules
 * @param moduleId ID of the module to get
 * @returns The module or undefined
 */
export function getModuleFromMap(moduleMap: Map<string, Module>, moduleId: string): Module | undefined {
  return moduleMap.get(moduleId);
}

/**
 * Check if a module exists in the discovered modules
 * @param moduleId ID of the module to check
 * @param moduleMap Map of modules
 * @returns True if the module exists, false otherwise
 */
export function moduleExists(moduleId: string, moduleMap: Map<string, Module>): boolean {
  return moduleMap.has(moduleId);
} 
