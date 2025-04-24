import { loadAndValidateConfig, ConfigResult } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { validateModulesAgainstConfig } from '../../modules/validator';
import { getFiberIds, getLoadableFibers, areFiberDependenciesSatisfied, getChainIds, createChainFilter, orderChainsByDependencies } from '../../fiber';
import { orderFibersByDependencies } from './utils';
import { CoreConfig, FiberConfig, ModuleDiscoveryResult, Module, UserConfig } from '../../types';
import { buildFiberDependencyGraph, FiberDependencyGraph, FiberEnvironment } from '../../fiber/dependency-graph';
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
  const discoveredFiberModules = moduleResult.modules.filter(m => m.type === 'fiber');
  
  // Create a map for all discovered fibers with their IDs as keys
  const discoveredFiberMap = new Map(
    discoveredFiberModules.map(module => [module.id, module])
  );
  
  // Get all chain modules from module discovery
  const discoveredChainModules = moduleResult.modules.filter(m => m.type === 'chain');
  
  // Create a map for all discovered chains with their IDs as keys
  const discoveredChainMap = new Map(
    discoveredChainModules.map(module => [module.id, module])
  );
  
  // Combine all fibers - configured and unconfigured for unified display
  const allFiberModuleIds = new Set([
    ...allFibers,
    ...discoveredFiberModules.map(m => m.id)
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
  
  // Create a properly ordered list of fibers based on dependency relationships
  // We need to perform a topological sort to ensure dependencies come before dependents
  // We'll use the dependency graph to create this ordering
  
  // First, let's handle special cases: core should always be first
  const orderedFibers: string[] = [];
  
  // Start with core if it's in the list
  if (dependencyGraph.fibersToShow.includes('core')) {
    orderedFibers.push('core');
  }
  
  // Then add dotfiles if present (as it's a special case that usually comes after core)
  if (dependencyGraph.fibersToShow.includes('dotfiles')) {
    orderedFibers.push('dotfiles');
  }
  
  // Now create a list of the remaining fibers, ordered by dependencies
  const remainingFibers = dependencyGraph.fibersToShow.filter(
    id => id !== 'core' && id !== 'dotfiles'
  );
  
  // Create a dependency graph for topological sorting
  const tempGraph = new Map<string, string[]>();
  
  // Initialize the graph with empty dependency lists
  for (const fiberId of remainingFibers) {
    tempGraph.set(fiberId, []);
  }
  
  // Add dependency relationships from our fully computed dependency graph
  for (const fiberId of remainingFibers) {
    const deps = dependencyGraph.dependencyMap.get(fiberId) || [];
    
    // Only consider dependencies that are in our remaining list
    // (core and dotfiles are already handled)
    const relevantDeps = deps.filter(
      dep => remainingFibers.includes(dep)
    );
    
    tempGraph.set(fiberId, relevantDeps);
  }
  
  // Perform a topological sort
  const visited = new Set<string>();
  const tempVisited = new Set<string>();
  const result: string[] = [];
  
  // Topological sort function (dependencies before dependents)
  function visit(fiberId: string) {
    // Skip if already processed
    if (visited.has(fiberId)) return;
    
    // Skip if already in the current path (circular dependency)
    if (tempVisited.has(fiberId)) return;
    
    // Mark as being visited in current path
    tempVisited.add(fiberId);
    
    // Visit all dependencies first
    const deps = tempGraph.get(fiberId) || [];
    for (const dep of deps) {
      visit(dep);
    }
    
    // Mark as fully visited
    tempVisited.delete(fiberId);
    visited.add(fiberId);
    
    // Add to result (dependencies will be added before dependents)
    result.push(fiberId);
  }
  
  // Visit each fiber
  for (const fiberId of remainingFibers) {
    if (!visited.has(fiberId)) {
      visit(fiberId);
    }
  }
  
  // Add the topologically sorted fibers to our result
  // The result of topological sort gives us dependencies first, then dependents
  orderedFibers.push(...result);
  
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

/**
 * Find a module by its ID
 */
export function findModuleById(moduleResult: ModuleDiscoveryResult, id: string, type?: string): Module | undefined {
  return moduleResult.modules.find(m => 
    m.id === id && (type === undefined || m.type === type)
  );
} 
