/**
 * @file utils.ts
 * @description Re-exports utility functions from specialized modules for backward compatibility
 */

// Re-export functions from the dependency utils module
export {
  ensureCoreDependencies,
  orderFibersByDependencies,
  getDependentFibers,
  getChainDependencies,
  processDependency
} from './utils/dependency-utils';

// Re-export functions from the fiber utils module
export {
  isFiberEnabled,
  getFiberPath,
  countDisplayedModules
} from './utils/fiber-utils';

// Re-export functions from the module utils module
export {
  findModuleById,
  getModuleFromMap,
  moduleExists
} from './utils/module-utils';

// Re-export functions from the config loader module
export {
  loadConfigAndModules
} from './utils/config-loader'; 
