import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { validateModulesAgainstConfig } from '../../modules/validator';
import { getFiberIds, getLoadableFibers } from '../../fiber';
import { orderFibersByDependencies } from './utils';
import { CoreConfig, FiberConfig, ModuleResult } from '../../types';

/**
 * Load configuration and discover modules
 */
export async function loadConfigAndModules(options: any): Promise<{
  config: Record<string, CoreConfig | FiberConfig>;
  moduleResult: ModuleResult;
  displayFiberIds: string[];
  orderedFibers: string[];
}> {
  // Load config and discover modules
  const config = await loadAndValidateConfig(options.path);
  const moduleResult = await discoverModulesFromConfig(config, options.baseDirs);
  
  // Validate modules against config
  validateModulesAgainstConfig(moduleResult, config);

  // Get all fiber IDs for display
  const fiberIds = getFiberIds(config);
  
  // Get loadable fibers (those that can actually be loaded)
  const loadableFibers = getLoadableFibers(fiberIds, config);
  
  // Order fibers by dependencies
  const orderedFibers = orderFibersByDependencies(loadableFibers, config);

  return {
    config,
    moduleResult,
    displayFiberIds: fiberIds,
    orderedFibers
  };
}

/**
 * Find a module by its ID
 */
export function findModuleById(moduleResult: ModuleResult, id: string, type?: string) {
  return moduleResult.modules.find(m => 
    m.id === id && (type === undefined || m.type === type)
  );
} 
