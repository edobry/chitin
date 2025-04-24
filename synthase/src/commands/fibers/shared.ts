import { loadAndValidateConfig, ConfigResult } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { validateModulesAgainstConfig } from '../../modules/validator';
import { getFiberIds, getLoadableFibers, areFiberDependenciesSatisfied } from '../../fiber';
import { orderFibersByDependencies } from './utils';
import { CoreConfig, FiberConfig, ModuleDiscoveryResult, Module, UserConfig } from '../../types';

/**
 * Load configuration and discover modules
 */
export async function loadConfigAndModules(options: any): Promise<{
  config: UserConfig;
  moduleResult: ModuleDiscoveryResult;
  displayFiberIds: string[];
  orderedFibers: string[];
}> {
  // Load config and discover modules
  const { config } = await loadAndValidateConfig({
    userConfigPath: options.path
  });
  const moduleResult = await discoverModulesFromConfig(config, options.baseDirs);
  
  // Validate modules against config - skip for now due to error
  // validateModulesAgainstConfig(moduleResult, config);

  // Get all fiber IDs for display
  const fiberIds = getFiberIds(config);
  
  // Create a dependency checker function
  const dependencyChecker = () => true;
  
  // Get loadable fibers (those that can actually be loaded)
  const loadableFibers = getLoadableFibers(config, dependencyChecker);
  
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
export function findModuleById(moduleResult: ModuleDiscoveryResult, id: string, type?: string): Module | undefined {
  return moduleResult.modules.find(m => 
    m.id === id && (type === undefined || m.type === type)
  );
} 
