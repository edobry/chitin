import { getCoreConfigValue } from '../../config';
import { findChitinDir } from '../../utils/path';
import { isFiberEnabled, getChainDependencies, getDependentFibers } from './utils';
import { UserConfig, ConfigValidationResult, Module, FiberConfig } from '../../types';

/**
 * Display options for fibers command
 */
export interface DisplayOptions {
  detailed?: boolean;
  hideDisabled?: boolean;
}

/**
 * Extended validation result with warnings
 */
export interface ExtendedValidationResult extends ConfigValidationResult {
  warnings?: string[];
}

/**
 * Validation results map
 */
export interface ValidationResultsMap {
  [moduleId: string]: ExtendedValidationResult;
}

/**
 * Displays a separator line for a fiber
 * @param fiberId Fiber ID
 * @param status Status indicator text
 * @param validation Validation indicator
 */
export function displayFiberHeader(
  fiberId: string, 
  status: string, 
  validation: string
): void {
  console.log(`\n━━━ ${fiberId} ${status} ${validation} ━━━`);
}

/**
 * Gets the appropriate status text for a fiber
 * @param fiberId Fiber ID
 * @param isEnabled Whether the fiber is enabled
 * @param isSatisfied Whether dependencies are satisfied
 * @param inConfig Whether the fiber is in config
 * @returns Status text to display
 */
export function getFiberStatus(
  fiberId: string,
  isEnabled: boolean,
  isSatisfied: boolean,
  inConfig: boolean
): string {
  if (fiberId === 'core') {
    return '(core)';
  } else if (!isEnabled) {
    return '(disabled)';
  } else if (!isSatisfied) {
    return '(unsatisfied dependencies)';
  } else if (!inConfig) {
    return '(unconfigured)';
  }
  return '';
}

/**
 * Gets the path for a fiber, with special handling for core and dotfiles
 * @param fiberId Fiber ID
 * @param fiberModule The fiber module object
 * @param config Configuration object
 * @returns Path to display
 */
export function getFiberPath(
  fiberId: string,
  fiberModule: Module | undefined,
  config: UserConfig
): string {
  if (fiberId === 'dotfiles') {
    return getCoreConfigValue(config, 'dotfilesDir') || fiberModule?.path || "Unknown";
  } else if (fiberId === 'core') {
    return findChitinDir() || fiberModule?.path || "Unknown";
  } else {
    return fiberModule?.path || (config[fiberId] as any)?.path || "Unknown";
  }
}

/**
 * Displays validation errors and warnings for a module
 * @param validationResult Validation result for the module
 */
export function displayValidationResults(validationResult: ExtendedValidationResult | undefined): void {
  if (!validationResult) return;
  
  if (validationResult.errors.length > 0) {
    console.log(`  Errors:`);
    for (const error of validationResult.errors) {
      console.log(`    ❌ ${error}`);
    }
  }
  
  if (validationResult.warnings && validationResult.warnings.length > 0) {
    console.log(`  Warnings:`);
    for (const warning of validationResult.warnings) {
      console.log(`    ⚠️  ${warning}`);
    }
  }
}

/**
 * Displays fiber dependencies if in detailed mode
 * @param fiberId Fiber ID
 * @param config Configuration object
 * @param options Display options
 * @param modules Array of discovered modules
 */
export function displayFiberDependencies(
  fiberId: string,
  config: UserConfig,
  options: DisplayOptions,
  modules: Module[] = []
): void {
  if (fiberId === 'standalone') return;
  
  // First try to find the fiber in the modules
  const fiberModule = modules.find(m => m.id === fiberId && m.type === 'fiber');
  
  // Get dependencies from the module metadata if available
  let fiberDeps: string[] = [];
  if (fiberModule && fiberModule.metadata.dependencies) {
    fiberDeps = fiberModule.metadata.dependencies.map(dep => dep.moduleId);
  }
  // Fallback to user config if no metadata
  if (fiberDeps.length === 0) {
    const fiberConfig = config[fiberId] as FiberConfig;
    fiberDeps = fiberConfig?.fiberDeps || [];
  }
  
  if (fiberDeps.length > 0) {
    console.log(`  Depends on: ${fiberDeps.join(', ')}`);
  }
  
  // Show fibers that depend on this fiber
  // Get dependent fibers from module metadata
  const dependentFibers = modules
    .filter(m => 
      m.type === 'fiber' && 
      m.metadata.dependencies?.some(dep => dep.moduleId === fiberId)
    )
    .map(m => m.id);
  
  // If no dependents found in metadata, fall back to config
  if (dependentFibers.length === 0) {
    const configDependents = getDependentFibers(fiberId, config);
    if (configDependents.length > 0) {
      console.log(`  Required by: ${configDependents.join(', ')}`);
    }
  } else {
    console.log(`  Required by: ${dependentFibers.join(', ')}`);
  }
}

/**
 * Gets chain status text
 * @param isEnabled Whether the chain is enabled
 * @param isConfigured Whether the chain is configured
 * @returns Status text
 */
export function getChainStatus(
  isEnabled: boolean,
  isConfigured: boolean
): string {
  if (!isEnabled) {
    return ' (disabled)';
  } else if (!isConfigured) {
    return ' (unconfigured)';
  }
  return '';
}

/**
 * Displays a chain with its details
 * @param chainId Chain ID
 * @param chainConfig Chain configuration
 * @param fiberId Parent fiber ID
 * @param config Global configuration
 * @param validationResults Validation results
 * @param globalIndex Global load order index
 * @param counter Chain counter
 * @param options Display options
 * @returns Whether the chain was displayed (not hidden)
 */
export function displayChain(
  chainId: string,
  chainConfig: any,
  fiberId: string,
  config: UserConfig,
  validationResults: ValidationResultsMap,
  globalIndex: number,
  counter: number,
  options: DisplayOptions
): boolean {
  const isChainEnabled = chainConfig && chainConfig.enabled !== false;
  const isChainConfigured = !!chainConfig;
  
  // Skip disabled chains if hide-disabled option is enabled
  if (options.hideDisabled && !isChainEnabled) {
    return false;
  }
  
  // Get validation for this chain - only show something for failing validations
  const chainValidation = validationResults[chainId] && !validationResults[chainId].valid ? '✗' : '';
  
  // Create status indicator for chains
  const chainStatus = getChainStatus(isChainEnabled, isChainConfigured);
  
  // Get dependencies for this chain
  const dependencies = getChainDependencies(chainId, config[fiberId]?.moduleConfig || {});
  
  // Show chain with sequential numbering and validation status
  console.log(`    ${counter}. ${chainId}${chainStatus} ${chainValidation}`);
  
  // Show global load order in detailed mode
  if (options.detailed) {
    console.log(`       Load order: #${globalIndex} (global)`);
  }
  
  // Show dependencies
  if (dependencies.length > 0) {
    console.log(`       Dependencies: ${dependencies.join(', ')}`);
  }
  
  // Add chain validation errors/warnings
  if (validationResults[chainId]) {
    const result = validationResults[chainId];
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`       ❌ ${error}`);
      }
    }
    if (result.warnings && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(`       ⚠️  ${warning}`);
      }
    }
  }
  
  // Show additional details if requested
  if (options.detailed) {
    if (chainConfig) {
      if (chainConfig.toolDeps && chainConfig.toolDeps.length > 0) {
        console.log(`       Tool Dependencies: ${chainConfig.toolDeps.join(', ')}`);
      }
      if (chainConfig.provides && chainConfig.provides.length > 0) {
        console.log(`       Provides: ${chainConfig.provides.join(', ')}`);
      }
    }
  }
  
  return true;
}

/**
 * Displays summary information
 * @param displayFiberIds Displayed fiber IDs
 * @param fiberChainMap Map of fibers to chains
 * @param loadableFibers Loadable fibers
 * @param allFibers All fibers
 * @param loadableChains Loadable chains
 * @param discoveredFiberModules Discovered fiber modules
 * @param discoveredChainModules Discovered chain modules
 * @param validationResults Validation results
 * @param config Global configuration
 * @param options Display options
 */
export function displaySummary(
  displayFiberIds: string[],
  fiberChainMap: Map<string, string[]>,
  loadableFibers: string[],
  allFibers: string[],
  loadableChains: string[],
  discoveredFiberModules: Module[],
  discoveredChainModules: Module[],
  validationResults: ValidationResultsMap,
  config: UserConfig,
  options: { available?: boolean, hideDisabled?: boolean }
): void {
  console.log(`\n───────────────────────────────────`);
  console.log(`Summary`);
  console.log(`───────────────────────────────────`);

  // Create a more natural fiber summary
  if (options.available) {
    console.log(`Fibers: ${loadableFibers.length} of ${allFibers.length} available`);
  } else {
    console.log(`Fibers: ${displayFiberIds.length} displayed, ${allFibers.length} in config, ${discoveredFiberModules.length} total discovered`);
  }
  
  // Count chains shown vs total
  const displayedChains = options.hideDisabled 
    ? loadableChains.filter(id => {
        // Find which fiber this chain belongs to
        for (const [fiberId, chains] of fiberChainMap.entries()) {
          if (chains.includes(id)) {
            // Check if chain is enabled in this fiber
            const chainConfig = config[fiberId]?.moduleConfig?.[id];
            return chainConfig && chainConfig.enabled !== false;
          }
        }
        return false;
      })
    : loadableChains;
  
  console.log(`Chains: ${displayedChains.length} displayed, ${loadableChains.length} in config, ${discoveredChainModules.length} total discovered`);

  // Add validation summary with explanation of the module count discrepancy if needed
  const totalModules = Object.keys(validationResults).length;
  const validModules = Object.values(validationResults).filter((result) => result.valid).length;
  const invalidModules = totalModules - validModules;

  // Show validation summary
  console.log(`Validation: ${validModules} of ${totalModules} modules valid`);
  
  // Show info about the --hide-disabled option if it wasn't used
  if (!options.hideDisabled) {
    console.log(`Note: Use --hide-disabled (-H) to hide disabled fibers and chains.`);
  }
} 
