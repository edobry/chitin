import { loadUserConfig, loadModuleConfig, getFullConfig } from './config/loader';
import { validateUserConfig, validateFiberConfig, validateChainConfig } from './config/validator';
import { deepMerge, mergeToolConfigs, mergeModuleConfigs } from './config/merger';
import { expandPath, getOriginalPath } from './utils/file';
import { importEnvironmentFromBash, exportEnvironmentToBash } from './shell/environment';

// Export base types
export * from './types';

// Selectively re-export from config to avoid duplicate exports with ./types
export {
  // Config loading and validation functions are already imported above
  // and re-exported below, so don't re-export them here
} from './config';

// Selectively re-export from utils
export {
  // Path handling functions are already imported above
  // and re-exported below, so don't re-export them here
} from './utils';

// Re-export shell functionality
export * from './shell/environment';

// Selectively re-export from modules
export {
  discoverModulesFromConfig,
  discoverModules,
  loadModule,
  validateModule
} from './modules';

// Selectively re-export from fiber
export {
  getFiberIds,
  getLoadableFibers,
  isFiberEnabled,
  areFiberDependenciesSatisfied,
  getChainIds,
  getChainDependencies,
  orderChainsByDependencies,
  createChainFilter,
  createFiberManager,
  createFiberFilter
} from './fiber';

// Export individual functions (these are the main exports)
export {
  // Configuration
  loadUserConfig,
  loadModuleConfig,
  getFullConfig,
  validateUserConfig,
  validateFiberConfig,
  validateChainConfig,
  deepMerge as mergeConfigurations,
  mergeToolConfigs,
  mergeModuleConfigs,
  
  // Path handling
  expandPath,
  getOriginalPath,
  
  // Shell environment
  importEnvironmentFromBash,
  exportEnvironmentToBash
};

// Fix comparison of import.meta.url and import.meta.main
// since they have different types (string vs boolean)
if (import.meta.main) {
  console.log("Index.ts running as main, executing CLI...");
  
  // Fix TypeScript error about importing file with .ts extension
  import('./cli.js').then(() => {
    console.log("CLI execution complete");
  }).catch(err => {
    console.error("Error executing CLI:", err);
  });
} else {
  console.log("Index.ts loaded as a module, not executing CLI");
} 
