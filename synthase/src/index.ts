import { loadUserConfig, loadModuleConfig, getFullConfig } from './config/loader';
import { validateUserConfig, validateFiberConfig, validateChainConfig } from './config/validator';
import { deepMerge, mergeToolConfigs, mergeModuleConfigs } from './config/merger';
import { expandPath, getOriginalPath } from './utils/file';
import { importEnvironmentFromBash, exportEnvironmentToBash } from './shell/environment';

// Re-export types
export * from './types';
// Re-export config module
export * from './config';
// Re-export utils
export * from './utils';
// Re-export shell functionality
export * from './shell/environment';
// Export module system
export * from './modules';
// Export fiber system
export * from './fiber';

// Export individual functions for backward compatibility
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

// If this file is run directly, execute the CLI
if (import.meta.url === import.meta.main) {
  console.log("Index.ts running as main, executing CLI...");
  import('./cli.ts').then(() => {
    console.log("CLI execution complete");
  }).catch(err => {
    console.error("Error executing CLI:", err);
  });
} else {
  console.log("Index.ts loaded as a module, not executing CLI");
} 
