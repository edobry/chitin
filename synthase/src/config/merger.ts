import { ConfigMergeOptions } from '../types';

/**
 * Performs a deep merge of objects
 * @param target The target object to merge into
 * @param sources The source objects to merge from
 * @param options Merge options
 * @returns The merged object
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  sources: Record<string, any>[],
  options?: ConfigMergeOptions
): T {
  if (!sources.length) return target;
  
  const isOverwriteArrays = options?.overwriteArrays ?? false;
  
  const source = sources.shift();
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      const targetValue = target[key];
      const sourceValue = source[key];
      
      if (isObject(sourceValue)) {
        if (!targetValue) {
          target = { ...target, [key]: {} } as T;
        }
        
        // If the option is set, deeply merge objects
        if (options?.deep !== false) {
          deepMerge(target[key] as Record<string, any>, [sourceValue], options);
        } else {
          // Otherwise just assign the value
          target = { ...target, [key]: sourceValue } as T;
        }
      } else if (Array.isArray(sourceValue)) {
        // Handle arrays based on options
        if (isOverwriteArrays || !Array.isArray(targetValue)) {
          target = { ...target, [key]: [...sourceValue] } as T;
        } else {
          // Merge arrays without duplicates
          target = { ...target, [key]: [...new Set([...targetValue, ...sourceValue])] } as T;
        }
      } else {
        // For primitives, just override
        target = { ...target, [key]: sourceValue } as T;
      }
    }
  }
  
  // Recursively merge other sources
  return deepMerge(target, sources, options);
}

/**
 * Represents a configuration with tools and toolDeps
 */
interface ModuleConfigWithTools {
  tools?: Record<string, any>;
  toolDeps?: string[];
  [key: string]: any;
}

/**
 * Merges tool configurations from different sources
 * @param target Target configuration
 * @param sources Source configurations
 * @returns Merged tool configuration
 */
export function mergeToolConfigs(
  target: Record<string, any>,
  sources: Record<string, any>[]
): Record<string, any> {
  // Use deep merge with array preservation for tool configs
  return deepMerge(target, sources, { deep: true, overwriteArrays: false });
}

/**
 * Merges fiber and chain configurations
 * @param baseConfig Base configuration
 * @param moduleConfig Module configuration
 * @returns Merged configuration
 */
export function mergeModuleConfigs(
  baseConfig: ModuleConfigWithTools,
  moduleConfig: ModuleConfigWithTools
): ModuleConfigWithTools {
  // Make sure we have proper objects
  const base = baseConfig || {};
  const module = moduleConfig || {};
  
  // Special handling for tools
  const mergedConfig = deepMerge({} as ModuleConfigWithTools, [base, module], { deep: true });
  
  // Special handling for toolDeps array
  if (base.toolDeps || module.toolDeps) {
    mergedConfig.toolDeps = [
      ...(base.toolDeps || []),
      ...(module.toolDeps || []),
    ];
    
    // Remove duplicates
    mergedConfig.toolDeps = [...new Set(mergedConfig.toolDeps)];
  }
  
  return mergedConfig;
}

/**
 * Checks if a value is an object
 * @param item Value to check
 * @returns Whether the value is an object
 */
function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === 'object' && !Array.isArray(item));
} 
