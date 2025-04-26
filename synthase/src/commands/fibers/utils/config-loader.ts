/**
 * @file config-loader.ts
 * @description Functions for loading and processing fiber configuration
 */

import { loadAndValidateConfig, ConfigResult } from '../../utils';
import { discoverModulesFromConfig } from '../../../modules/discovery';
import { validateModulesAgainstConfig } from '../../../modules/validator';
import { getFiberIds, getLoadableFibers, getChainIds, createChainFilter, orderChainsByDependencies } from '../../../fiber';
import { orderFibers } from './dependency-utils';
import { Module, ModuleDiscoveryResult } from '../../../modules/types';
import { UserConfig } from '../../../config/types';
import { buildFiberDependencyGraph, FiberDependencyGraph, FiberEnvironment } from '../../../fiber/dependency-graph';
import { associateChainsByFiber, filterDisabledFibers } from './organization';

/**
 * Load configuration and discover modules
 */
export async function loadConfigAndModules(options: any): Promise<{
  config: UserConfig;
  validation: any;
  moduleResult: ModuleDiscoveryResult;
  validationResults: any;
  allFibers: string[];
  loadableFibers: string[];
  displayFiberIds: string[];
  discoveredFiberModules: Module[];
  discoveredFiberMap: Map<string, Module>;
  discoveredChainModules: Module[];
  discoveredChainMap: Map<string, Module>;
  orderedFibers: string[];
  orderedChains: string[];
  fiberChainMap: Map<string, string[]>;
  loadableChains: string[];
  dependencyChecker: (tool: string) => boolean;
  dependencyGraph: FiberDependencyGraph;
}> {
  // Load and validate configuration
  const { config, validation } = await loadAndValidateConfig({
    userConfigPath: options.path,
    exitOnError: false
  });
  
  if (!validation.valid) {
    console.error('Configuration validation failed:');
    validation.errors.forEach(error => console.error(`- ${error}`));
    console.error('Continuing despite validation errors...');
  }
  
  // Discover and validate modules (silently)
  const moduleResult = await discoverModulesFromConfig(
    config, 
    options.baseDirs || []
  );
  
  if (moduleResult.errors.length > 0) {
    console.error('Encountered errors during module discovery:');
    for (const error of moduleResult.errors) {
      console.error(`- ${error}`);
    }
  }

  // Always run validation
  const validationResults = validateModulesAgainstConfig(
    moduleResult.modules,
    config
  );
  
  // Simple dependency checker for demonstration
  const dependencyChecker = (tool: string) => {
    if (options.detailed) console.error(`Checking dependency: ${tool} (assuming available)`);
    return true;
  };
  
  // Get all fibers from config
  const allFibers = getFiberIds(config);
  
  // Get loadable fibers
  const loadableFibers = options.available ? 
    getLoadableFibers(config, dependencyChecker) :
    allFibers;
  
  // Get all chains from all fibers
  const allChainIds = getChainIds(config);
  
  // Create chain filter based on loadable fibers
  const chainFilter = createChainFilter(config, loadableFibers);
  
  // Filter the chains that will be loaded
  const loadableChains = allChainIds.filter(chainId => chainFilter(chainId));
  
  // Order chains by dependencies
  const orderedChains = orderChainsByDependencies(loadableChains, config, loadableFibers);
  
  // Get all fiber modules from module discovery
  const discoveredFiberModules = moduleResult.modules.filter((m: Module) => m.type === 'fiber');
  
  // Create a map for all discovered fibers with their IDs as keys
  const discoveredFiberMap = new Map<string, Module>(
    discoveredFiberModules.map((module: Module) => [module.id, module])
  );
  
  // Get all chain modules from module discovery
  const discoveredChainModules = moduleResult.modules.filter((m: Module) => m.type === 'chain');
  
  // Create a map for all discovered chains with their IDs as keys
  const discoveredChainMap = new Map<string, Module>(
    discoveredChainModules.map((module: Module) => [module.id, module])
  );
  
  // Combine all fibers - configured and unconfigured for unified display
  const allFiberModuleIds = new Set([
    ...allFibers,
    ...discoveredFiberModules.map((m: Module) => m.id)
  ]);
  
  // Create a list of all fiber IDs to display
  let displayFiberIds = [...allFibers];
  
  // Add any discovered fibers that weren't in the list
  Array.from(allFiberModuleIds)
    .filter(id => !displayFiberIds.includes(id))
    .sort((a, b) => a.localeCompare(b))
    .forEach(id => displayFiberIds.push(id));
  
  // Build the fiber dependency graph with advanced detection logic
  const environment: FiberEnvironment = {
    config,
    moduleResult,
    displayFiberIds,
    orderedFibers: loadableFibers // Initial ordering, will be improved by graph
  };
  
  const dependencyGraph = buildFiberDependencyGraph(
    environment,
    { 
      hideDisabled: options.hideDisabled,
      reverse: false
    }
  );
  
  // Use the unified orderFibers function to create a properly ordered list of fibers
  const orderedFibers = orderFibers(dependencyGraph.fibersToShow, config, moduleResult.modules, {
    handleSpecialFibers: true,
    includeDiscovered: false,
    hideDisabled: options.hideDisabled,
    reverse: false
  });
  
  // Apply hide-disabled option if selected
  if (options.hideDisabled) {
    displayFiberIds = filterDisabledFibers(displayFiberIds, config, options.hideDisabled);
  }

  // Associate chains with their fibers
  const fiberChainMap = associateChainsByFiber(
    displayFiberIds,
    config,
    discoveredChainModules,
    discoveredFiberMap,
    moduleResult
  );
  
  return {
    config,
    validation,
    moduleResult,
    validationResults,
    allFibers,
    loadableFibers,
    displayFiberIds,
    discoveredFiberModules,
    discoveredFiberMap,
    discoveredChainModules,
    discoveredChainMap,
    orderedFibers,
    orderedChains,
    fiberChainMap,
    loadableChains,
    dependencyChecker,
    dependencyGraph
  };
} 
