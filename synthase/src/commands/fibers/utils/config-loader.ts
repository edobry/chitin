import { loadAndValidateConfig } from '../../utils';
import { discoverModulesFromConfig } from '../../../modules/discovery';
import { validateModulesAgainstConfig } from '../../../modules/validator';
import { Module } from '../../../modules/types';
import { 
  getLoadableFibers, 
  getFiberIds,
  getChainIds,
  createChainFilter,
  orderChainsByDependencies
} from '../../../fiber';

import {
  orderFibersByDependencies,
  getDependentFibers,
  isFiberEnabled,
  getChainDependencies,
  countDisplayedModules,
  ensureCoreDependencies
} from '../utils';

import {
  associateChainsByFiber,
  filterDisabledFibers
} from '../organization';

import { FiberCommandOptions, ConfigAndModulesResult } from '../types';

/**
 * Shared function to load config and discover modules
 * @param options Command options
 * @returns Loaded configuration and module data
 */
export async function loadConfigAndModules(options: FiberCommandOptions): Promise<ConfigAndModulesResult> {
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
  
  // Order fibers by dependency (foundational first, dependent last)
  const orderedFibers = orderFibersByDependencies(loadableFibers, config, moduleResult.modules);
  
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
  
  // Create a list of all fiber IDs to display ensuring proper dependency order
  // First, use the orderedFibers array to maintain dependency relationships
  let displayFiberIds = [...orderedFibers];
  
  // Add any discovered fibers that weren't in the ordered list
  Array.from(allFiberModuleIds)
    .filter(id => !displayFiberIds.includes(id))
    .sort((a, b) => a.localeCompare(b))
    .forEach(id => displayFiberIds.push(id));
  
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
  
  // Generate dependency maps for fibers
  const dependencyMap = new Map<string, string[]>();
  const detectionInfo = new Map<string, Array<{source: string, deps: string[]}>>();
  
  // Initialize for each fiber
  for (const fiberId of displayFiberIds) {
    dependencyMap.set(fiberId, getDependentFibers(fiberId, config) || []);
    detectionInfo.set(fiberId, [{
      source: 'config',
      deps: getDependentFibers(fiberId, config) || []
    }]);
  }
  
  // Create a simple dependency graph
  const dependencyGraph = {
    dependencyMap,
    detectionInfo
  };
  
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
