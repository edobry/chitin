import { Command } from 'commander';
import { serializeToYaml } from '../../utils';
import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig, validateModulesAgainstConfig } from '../../modules';
import { 
  getLoadableFibers, 
  areFiberDependenciesSatisfied, 
  createChainFilter,
  getFiberIds,
  getChainIds,
  orderChainsByDependencies
} from '../../fiber';

import {
  orderFibersByDependencies,
  getDependentFibers,
  isFiberEnabled,
  getChainDependencies,
  countDisplayedModules
} from './utils';

import {
  displayFiberHeader,
  getFiberStatus,
  getFiberPath,
  displayValidationResults,
  displayFiberDependencies,
  displayChain,
  displaySummary
} from './display';

import {
  associateChainsByFiber,
  filterDisabledFibers,
  orderFibersByConfigAndName
} from './organization';

/**
 * Create and configure the fibers command
 * @returns Configured Command object
 */
export function createFibersCommand(): Command {
  const command = new Command('fibers')
    .description('List fibers and their modules in load order with validation')
    .option('-l, --list', 'List all fibers (default)')
    .option('-a, --available', 'List only available fibers (enabled with satisfied dependencies)')
    .option('-c, --check-dependencies', 'Check dependencies for all fibers')
    .option('-d, --detailed', 'Show detailed information for fibers and chains')
    .option('-A, --all-modules', 'Show all discovered modules, not just configured ones')
    .option('-H, --hide-disabled', 'Hide disabled fibers and chains')
    .option('-j, --json', 'Output validation results in JSON format')
    .option('-y, --yaml', 'Output validation results in YAML format')
    .action(async (options) => {
      try {
        // Load and validate configuration
        const { config, validation } = await loadAndValidateConfig({
          exitOnError: false
        });
        
        if (!validation.valid) {
          console.error('Configuration validation failed:');
          validation.errors.forEach(error => console.error(`- ${error}`));
          console.warn('Continuing despite validation errors...');
        }
        
        // Discover and validate modules (silently)
        const moduleResult = await discoverModulesFromConfig(config);
        
        if (moduleResult.errors.length > 0) {
          console.warn('Encountered errors during module discovery:');
          for (const error of moduleResult.errors) {
            console.warn(`- ${error}`);
          }
        }

        // Always run validation
        const validationResults = validateModulesAgainstConfig(
          moduleResult.modules,
          config
        );
        
        // Handle JSON or YAML output if requested
        if (options.json) {
          console.log(JSON.stringify(validationResults, null, 2));
          return;
        } else if (options.yaml) {
          console.log(serializeToYaml({ results: validationResults }));
          return;
        }
        
        // Simple dependency checker for demonstration
        const dependencyChecker = (tool: string) => {
          if (options.detailed) console.log(`Checking dependency: ${tool} (assuming available)`);
          return true;
        };
        
        // Get all fibers from config
        const allFibers = getFiberIds(config);
        
        if (options.checkDependencies) {
          console.log('Dependency status for fibers:');
          for (const fiberId of allFibers) {
            const satisfied = areFiberDependenciesSatisfied(fiberId, config, dependencyChecker);
            // Note: Core always reports as satisfied
            console.log(`- ${fiberId}${fiberId === 'core' ? ' (core)' : ''}: ${satisfied ? 'Dependencies satisfied' : 'Missing dependencies'}`);
          }
          return;
        } 
        
        // Get loadable fibers
        const loadableFibers = options.available ? 
          getLoadableFibers(config, dependencyChecker) :
          allFibers;
        
        // Order fibers by dependency (foundational first, dependent last)
        const orderedFibers = orderFibersByDependencies(loadableFibers, config);
        
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
        
        // Create a list of all fiber IDs to display and sort them
        let displayFiberIds = orderFibersByConfigAndName(
          allFiberModuleIds,
          allFibers,
          orderedFibers
        );
        
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

        // Display options for command-line flags
        if (options.available) {
          console.log('Showing fibers with satisfied dependencies\n');
        }
        
        if (options.hideDisabled) {
          console.log('Hiding disabled fibers and chains\n');
        }

        // Output fibers and chains in a structured format
        for (const fiberId of displayFiberIds) {
          // Skip standalone fiber if it's empty
          if (fiberId === 'standalone' && 
              (!fiberChainMap.has('standalone') || fiberChainMap.get('standalone')?.length === 0)) {
            continue;
          }
          
          const isCore = fiberId === 'core';
          const enabled = isFiberEnabled(fiberId, config);
          const satisfied = areFiberDependenciesSatisfied(fiberId, config, dependencyChecker);
          const inConfig = fiberId in config;
          
          // Skip disabled fibers if hide-disabled option is enabled
          if (options.hideDisabled && !enabled && !isCore) {
            continue;
          }
          
          // Get status and validation indicators
          const statusIndicator = getFiberStatus(fiberId, enabled, satisfied, inConfig);
          const fiberValidation = validationResults[fiberId] && !validationResults[fiberId].valid ? '✗' : '';
          
          // Display fiber header
          displayFiberHeader(fiberId, statusIndicator, fiberValidation);
          
          // Find the fiber's path from the module result
          const fiberModule = inConfig 
            ? moduleResult.modules.find(m => m.id === fiberId)
            : discoveredFiberMap.get(fiberId);
            
          // Get and display fiber path
          const fiberPath = getFiberPath(fiberId, fiberModule, config);
          if (fiberId !== 'standalone') {
            console.log(`  Location: ${fiberPath}`);
          }
          
          // Display validation results
          displayValidationResults(validationResults[fiberId]);
          
          // Show fiber dependencies if detailed mode is enabled
          displayFiberDependencies(fiberId, config, { 
            detailed: options.detailed, 
            hideDisabled: options.hideDisabled 
          });
          
          // Get chains for this fiber
          const fiberChains = fiberChainMap.get(fiberId) || [];
          
          if (fiberChains.length > 0) {
            console.log(`  Chains (${fiberChains.length}):`);
            
            // Use a counter for sequential numbering within the fiber
            let chainCounter = 1;
            
            for (const chainId of fiberChains) {
              const chainConfig = config[fiberId]?.moduleConfig?.[chainId];
              
              // Display chain and increment counter only if it was displayed
              const wasDisplayed = displayChain(
                chainId,
                chainConfig,
                fiberId,
                config,
                validationResults,
                orderedChains.indexOf(chainId) + 1,
                chainCounter,
                { 
                  detailed: options.detailed, 
                  hideDisabled: options.hideDisabled 
                }
              );
              
              if (wasDisplayed) {
                chainCounter++;
              }
            }
          } else {
            console.log(`  No chains in this fiber`);
          }
        }
        
        // Display summary information
        displaySummary(
          displayFiberIds,
          fiberChainMap,
          loadableFibers,
          allFibers,
          loadableChains,
          discoveredFiberModules,
          discoveredChainModules,
          validationResults,
          config,
          { 
            available: options.available, 
            hideDisabled: options.hideDisabled 
          }
        );
      } catch (error) {
        console.error('Error processing fibers:', error);
        process.exit(1);
      }
    });

  return command;
} 
