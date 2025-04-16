import { Module, ModuleValidationResult, FiberConfig, ChainConfig } from '../types';
import { validateFiberConfig, validateChainConfig } from '../config/validator';

/**
 * Validates a module against its configuration
 * @param module Module to validate
 * @returns Validation result
 */
export function validateModule(module: Module): ModuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate basic module structure
  if (!module.id) {
    errors.push('Module ID is required');
  }
  
  if (!module.path) {
    errors.push('Module path is required');
  }
  
  if (module.type !== 'fiber' && module.type !== 'chain') {
    errors.push(`Invalid module type: ${module.type}`);
  }
  
  // Check if module configuration exists
  if (!module.config) {
    warnings.push('Module has no configuration');
    return { valid: errors.length === 0, errors, warnings };
  }
  
  // Validate configuration based on module type
  if (module.type === 'fiber') {
    const fiberValidation = validateFiberConfig(module.config as FiberConfig);
    if (!fiberValidation.valid) {
      errors.push(...fiberValidation.errors.map(err => `Fiber config error: ${err}`));
    }
  } else if (module.type === 'chain') {
    const chainValidation = validateChainConfig(module.config as ChainConfig);
    if (!chainValidation.valid) {
      errors.push(...chainValidation.errors.map(err => `Chain config error: ${err}`));
    }
  }
  
  // Validate dependencies
  if (module.metadata.dependencies) {
    for (const dep of module.metadata.dependencies) {
      if (!dep.moduleId) {
        errors.push('Dependency missing module ID');
      }
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates a list of modules against their configurations
 * @param modules Modules to validate
 * @returns Object mapping module IDs to validation results
 */
export function validateModules(modules: Module[]): Record<string, ModuleValidationResult> {
  const results: Record<string, ModuleValidationResult> = {};
  
  for (const module of modules) {
    results[module.id] = validateModule(module);
  }
  
  return results;
}

/**
 * Validates modules against user configuration
 * @param modules Modules to validate
 * @param configModules User configuration modules
 * @returns Object mapping module IDs to validation results
 */
export function validateModulesAgainstConfig(
  modules: Module[],
  configModules: Record<string, any>
): Record<string, ModuleValidationResult> {
  const results: Record<string, ModuleValidationResult> = {};
  
  for (const module of modules) {
    const validationResult = validateModule(module);
    const errors = [...validationResult.errors];
    const warnings = [...validationResult.warnings];
    
    // Check if module is configured in user config
    const userConfig = configModules[module.id];
    if (!userConfig) {
      warnings.push('Module not configured in user configuration');
    } else if (userConfig.enabled === false) {
      warnings.push('Module is disabled in user configuration');
    }
    
    results[module.id] = {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  return results;
}

/**
 * Filters valid modules from a list
 * @param modules Modules to filter
 * @returns Valid modules
 */
export function filterValidModules(modules: Module[]): Module[] {
  return modules.filter(module => validateModule(module).valid);
} 
