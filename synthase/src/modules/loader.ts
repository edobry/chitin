import { Module, ModuleLoadOptions, ModuleLoadResult, ModuleState } from '../types';
import { resolveDependencies } from './dependency';
import { validateModule } from './validator';
import { join } from 'path';
import { fileExists, readFile } from '../utils/file';

// In-memory storage for loaded modules
const loadedModules = new Map<string, Module>();
// In-memory storage for module states
const moduleStates = new Map<string, ModuleState>();

/**
 * Loads a module
 * @param module Module to load
 * @param options Load options
 * @returns Load result
 */
export async function loadModule(
  module: Module,
  options: ModuleLoadOptions = {}
): Promise<ModuleLoadResult> {
  // Validate the module
  const validation = validateModule(module);
  if (!validation.valid) {
    return {
      success: false,
      module,
      error: `Invalid module: ${validation.errors.join(', ')}`
    };
  }
  
  // Check if already loaded (and not forced)
  const state = moduleStates.get(module.id);
  if (state?.loaded && !options.force) {
    return {
      success: true,
      module
    };
  }
  
  // Check fiber filter if active fibers are specified
  if (options.activeFibers && options.activeFibers.length > 0) {
    if (module.type === 'fiber' && !options.activeFibers.includes(module.id)) {
      return {
        success: false,
        module,
        error: `Module ${module.id} is not in active fibers`
      };
    }
  }
  
  // Load dependencies if requested
  let loadedDependencies: Module[] = [];
  if (options.loadDependencies && module.metadata.dependencies?.length) {
    // Get all loaded modules
    const allModules = Array.from(loadedModules.values());
    
    try {
      // Resolve dependencies
      const { sorted } = resolveDependencies(
        allModules,
        m => m.id,
        m => (m.metadata.dependencies || []).map(d => d.moduleId),
        { throwOnCircular: true }
      );
      
      // Filter for dependencies of this module
      const dependencies = sorted.filter(m => 
        (module.metadata.dependencies || []).some(d => d.moduleId === m.id)
      );
      
      // Load each dependency
      for (const dep of dependencies) {
        const result = await loadModule(dep, {
          ...options,
          loadDependencies: false // Avoid circular loading
        });
        
        if (result.success) {
          loadedDependencies.push(dep);
        } else {
          // Check if dependency is optional
          const depInfo = (module.metadata.dependencies || []).find(d => d.moduleId === dep.id);
          if (!depInfo?.optional) {
            return {
              success: false,
              module,
              error: `Failed to load dependency ${dep.id}: ${result.error}`
            };
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        module,
        error: `Dependency resolution error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  try {
    // Perform actual module loading
    if (module.type === 'chain') {
      // For chains, we load shell scripts
      await loadShellScript(module);
    } else if (module.type === 'fiber') {
      // For fibers, we ensure child chains are loaded
    }
    
    // Store module as loaded
    loadedModules.set(module.id, module);
    
    // Update module state
    updateModuleState(module.id, {
      loaded: true,
      lastLoaded: new Date()
    });
    
    return {
      success: true,
      module,
      loadedDependencies
    };
  } catch (error) {
    // Update module state with error
    updateModuleState(module.id, {
      loaded: false,
      lastError: error instanceof Error ? error.message : String(error)
    });
    
    return {
      success: false,
      module,
      error: `Module load error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Unloads a module
 * @param moduleId Module ID to unload
 * @returns Whether unload was successful
 */
export function unloadModule(moduleId: string): boolean {
  const module = loadedModules.get(moduleId);
  if (!module) {
    return false;
  }
  
  // Remove from loaded modules
  loadedModules.delete(moduleId);
  
  // Update state
  updateModuleState(moduleId, {
    loaded: false
  });
  
  return true;
}

/**
 * Loads a shell script for a chain module
 * @param module Chain module to load
 */
async function loadShellScript(module: Module): Promise<void> {
  // Find main script in the module directory
  const possibleScripts = ['index.sh', 'init.sh', `${module.id}.sh`];
  let scriptPath = null;
  
  for (const script of possibleScripts) {
    const path = join(module.path, script);
    if (await fileExists(path)) {
      scriptPath = path;
      break;
    }
  }
  
  if (!scriptPath) {
    throw new Error(`No shell script found for module ${module.id}`);
  }
  
  // For actual loading, we'd need to source the script in the shell environment
  // In this implementation, we'll just read the file to verify it exists
  await readFile(scriptPath);
  
  // In a real implementation, we would use the shell integration mechanisms
  // to source the script in the user's shell environment
}

/**
 * Updates module state
 * @param moduleId Module ID
 * @param stateUpdate State update partial object
 */
export function updateModuleState(
  moduleId: string,
  stateUpdate: Partial<ModuleState>
): void {
  const currentState = moduleStates.get(moduleId) || {
    moduleId,
    loaded: false
  };
  
  moduleStates.set(moduleId, {
    ...currentState,
    ...stateUpdate
  });
}

/**
 * Gets module state
 * @param moduleId Module ID
 * @returns Module state or null if not found
 */
export function getModuleState(moduleId: string): ModuleState | null {
  return moduleStates.get(moduleId) || null;
}

/**
 * Gets all module states
 * @returns All module states
 */
export function getAllModuleStates(): ModuleState[] {
  return Array.from(moduleStates.values());
}

/**
 * Checks if a module is loaded
 * @param moduleId Module ID
 * @returns Whether the module is loaded
 */
export function isModuleLoaded(moduleId: string): boolean {
  const state = moduleStates.get(moduleId);
  return state?.loaded || false;
}

/**
 * Gets all loaded modules
 * @returns Array of loaded modules
 */
export function getLoadedModules(): Module[] {
  return Array.from(loadedModules.values());
} 
