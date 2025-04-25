/**
 * @file processor.ts
 * @description Data processing functions for the fiber command refactoring
 */

import { FiberEnvironment, FiberCommandOptions, ProcessedFiberData, FiberDisplayModel, ChainDisplayModel, FiberSummaryModel } from './models';
import { areFiberDependenciesSatisfied } from '../../fiber';
import { FIBER_NAMES } from '../../fiber/types';

// Import from the new utility modules
import { isFiberEnabled } from './utils/fiber-utils';
import { getChainDependencies } from './utils/dependency-utils';

/**
 * Processes environment data into display models based on command options
 */
export function processFibers(
  environment: FiberEnvironment,
  options: FiberCommandOptions
): ProcessedFiberData {
  const {
    config,
    validationResults,
    orderedFibers,
    dependencyGraph,
    fiberChainMap,
    moduleResult,
    discoveredFiberMap,
    discoveredChainModules,
    discoveredFiberModules,
    loadableFibers,
    allFibers,
    loadableChains
  } = environment;

  // Filter fibers based on options
  let fibersToProcess = [...orderedFibers];
  
  // Filter by name if specified
  if (options.name) {
    fibersToProcess = fibersToProcess.filter(id => id === options.name);
  }
  
  // Filter by availability if requested
  if (options.available) {
    fibersToProcess = fibersToProcess.filter(id => 
      id === FIBER_NAMES.CORE || 
      areFiberDependenciesSatisfied(id, config, environment.dependencyChecker)
    );
  }
  
  // Filter out disabled fibers if requested
  if (options.hideDisabled) {
    fibersToProcess = fibersToProcess.filter(id => 
      id === FIBER_NAMES.CORE || 
      isFiberEnabled(id, config)
    );
  }

  // Create display models for each fiber
  const fiberModels = fibersToProcess.map(fiberId => 
    createFiberDisplayModel(fiberId, environment, options)
  );

  // Generate summary statistics
  const summary = createFiberSummaryModel(
    fiberModels,
    fiberChainMap,
    loadableFibers,
    allFibers,
    loadableChains,
    discoveredFiberModules,
    discoveredChainModules,
    validationResults,
    config,
    options
  );

  return {
    fibers: fiberModels,
    summary
  };
}

/**
 * Creates a display model for a single fiber with all its metadata
 */
function createFiberDisplayModel(
  fiberId: string,
  environment: FiberEnvironment,
  options: FiberCommandOptions
): FiberDisplayModel {
  const {
    config,
    validationResults,
    dependencyGraph,
    fiberChainMap,
    moduleResult,
    discoveredFiberMap,
    dependencyChecker
  } = environment;

  const isCore = fiberId === FIBER_NAMES.CORE;
  const enabled = isCore || isFiberEnabled(fiberId, config);
  const inConfig = fiberId in config;
  
  // Get fiber path
  const fiberModule = inConfig 
    ? moduleResult.modules.find(m => m.id === fiberId)
    : discoveredFiberMap.get(fiberId);
  const fiberPath = getFiberPath(fiberId, fiberModule, config);

  // Get dependencies
  const dependencies = dependencyGraph.dependencyMap.get(fiberId) || [];
  const dependencyInfo = dependencyGraph.detectionInfo.get(fiberId) || [];
  const dependencyModels = dependencyInfo.map(info => ({
    id: info.deps[0], // Assuming single dependency per source for now
    source: info.source,
    isSatisfied: areFiberDependenciesSatisfied(info.deps[0], config, dependencyChecker)
  }));

  // Get chains
  const chainIds = fiberChainMap.get(fiberId) || [];
  const chains = chainIds.map(chainId => 
    createChainDisplayModel(chainId, fiberId, environment, options)
  );

  // Get validation results
  const validation = validationResults[fiberId] || {
    valid: true,
    errors: [],
    warnings: []
  };

  return {
    id: fiberId,
    isCore,
    isEnabled: enabled,
    path: fiberPath,
    dependencies: dependencyModels,
    validation: {
      isValid: validation.valid,
      errors: validation.errors || [],
      warnings: (validation as any).warnings ?? []
    },
    chains
  };
}

/**
 * Creates a display model for a single chain
 */
function createChainDisplayModel(
  chainId: string,
  fiberId: string,
  environment: FiberEnvironment,
  options: FiberCommandOptions
): ChainDisplayModel {
  const {
    config,
    validationResults,
    moduleResult,
    orderedChains,
    dependencyChecker
  } = environment;

  const chainConfig = config[fiberId]?.moduleConfig?.[chainId];
  const chainModule = moduleResult.modules.find(m => 
    m.id === chainId && m.type === 'chain'
  );

  // If fiber is disabled, chain is automatically disabled
  const fiberEnabled = isFiberEnabled(fiberId, config);
  const isEnabled = fiberEnabled && (chainConfig?.enabled !== false);
  const isConfigured = !!chainConfig;
  const order = orderedChains.indexOf(chainId) + 1;

  // Check if chain is available (dependencies satisfied)
  const isAvailable = isEnabled && isConfigured && 
    areFiberDependenciesSatisfied(fiberId, config, dependencyChecker);

  // Get dependencies
  const dependencies = getChainDependencies(chainId, config[fiberId]?.moduleConfig || {});
  const dependencyModels = dependencies.map(depId => ({
    id: depId,
    isSatisfied: areFiberDependenciesSatisfied(depId, config, dependencyChecker)
  }));

  // Get validation results
  const validation = validationResults[chainId] || {
    valid: true,
    errors: [],
    warnings: []
  };

  return {
    id: chainId,
    isEnabled,
    isAvailable,
    isConfigured,
    dependencies: dependencyModels,
    validation: {
      isValid: validation.valid,
      errors: validation.errors || [],
      warnings: (validation as any).warnings ?? []
    },
    order,
    toolDependencies: chainConfig?.tools,
    provides: chainConfig?.provides
  };
}

/**
 * Creates a summary model for the fiber data
 */
function createFiberSummaryModel(
  fiberModels: FiberDisplayModel[],
  fiberChainMap: Map<string, string[]>,
  loadableFibers: string[],
  allFibers: string[],
  loadableChains: string[],
  discoveredFiberModules: any[],
  discoveredChainModules: any[],
  validationResults: Record<string, any>,
  config: any,
  options: FiberCommandOptions
): FiberSummaryModel {
  const displayedFibers = fiberModels.length;
  const totalFibers = allFibers.length;
  const configuredFibers = Object.keys(config).length;

  const displayedChains = fiberModels.reduce((count: number, fiber) => 
    count + fiber.chains.length, 0
  );
  const totalChains = loadableChains.length;
  const configuredChains = Object.values(config).reduce((count: number, fiberConfig: any) => 
    count + (fiberConfig.moduleConfig ? Object.keys(fiberConfig.moduleConfig).length : 0), 0
  );

  const validModules = Object.values(validationResults).filter(
    (result: any) => result.valid
  ).length;
  const totalModules = Object.keys(validationResults).length;

  return {
    displayedFibers,
    totalFibers,
    configuredFibers,
    displayedChains,
    totalChains,
    configuredChains,
    validModules,
    totalModules
  };
}

/**
 * Gets the path for a fiber, with special handling for core and dotfiles
 */
function getFiberPath(
  fiberId: string,
  fiberModule: any,
  config: any
): string {
  if (fiberId === 'dotfiles') {
    return config.core?.dotfilesDir || fiberModule?.path || "Unknown";
  } else if (fiberId === 'core') {
    return fiberModule?.path || "Unknown";
  } else {
    return fiberModule?.path || config[fiberId]?.path || "Unknown";
  }
} 
