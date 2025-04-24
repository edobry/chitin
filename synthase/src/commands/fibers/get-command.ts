/**
 * @file get-command.ts
 * @description Implementation of the 'get' subcommand for the fibers command.
 * This command is responsible for displaying detailed information about fibers
 * and their associated modules.
 */

import { Command } from 'commander';
import { serializeToYaml } from '../../utils';
import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { validateModulesAgainstConfig } from '../../modules/validator';
import { UserConfig, Module } from '../../types';
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
  displaySummary,
  displayFiber
} from './display';

import {
  associateChainsByFiber,
  filterDisabledFibers,
  orderFibersByConfigAndName
} from './organization';

import { DISPLAY } from '../../constants';
import { loadConfigAndModules } from './shared';

/**
 * Find a module in a list of modules by ID and optionally by type
 * @param modules List of modules to search
 * @param id Module ID to find
 * @param type Optional module type filter
 * @returns The found module or undefined
 */
function findModuleById(modules: any[], id: string, type?: 'fiber' | 'chain'): any | undefined {
  return modules.find(module => 
    module.id === id && (type === undefined || module.type === type)
  );
}

/**
 * Create the 'get' subcommand for displaying fibers
 * @returns Configured Command object
 */
export function createGetCommand(): Command {
  return new Command('get')
    .description('Display details for fibers and their modules')
    .argument('[name]', 'Fiber name to display (displays all if not specified)')
    .option('-a, --available', 'List only available fibers (enabled with satisfied dependencies)')
    .option('-c, --check-dependencies', 'Check dependencies for all fibers')
    .option('-d, --detailed', 'Show detailed information for fibers and chains')
    .option('-A, --all-modules', 'Show all discovered modules, not just configured ones')
    .option('-H, --hide-disabled', 'Hide disabled fibers and chains')
    .option('-j, --json', 'Output validation results in JSON format')
    .option('-y, --yaml', 'Output validation results in YAML format')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .action(async (name, options) => {
      try {
        const environment = await loadConfigAndModules(options);
        const {
          config,
          validationResults,
          allFibers,
          loadableFibers,
          displayFiberIds,
          discoveredFiberModules,
          discoveredFiberMap,
          discoveredChainModules,
          moduleResult,
          orderedChains,
          fiberChainMap,
          loadableChains,
          dependencyChecker,
          dependencyGraph
        } = environment;
        
        // If JSON or YAML output is requested, return validation results
        if (options.json) {
          console.log(JSON.stringify(validationResults, null, 2));
          return;
        } else if (options.yaml) {
          console.log(serializeToYaml({ results: validationResults }));
          return;
        }
        
        if (options.checkDependencies) {
          console.log('Dependency status for fibers:');
          for (const fiberId of allFibers) {
            const satisfied = areFiberDependenciesSatisfied(fiberId, config, dependencyChecker);
            // Note: Core always reports as satisfied
            console.log(`- ${fiberId}${fiberId === 'core' ? ' (core)' : ''}: ${satisfied ? 'Dependencies satisfied' : 'Missing dependencies'}`);
          }
          return;
        }

        // Use the ordered fibers from the environment, which have been properly sorted
        // This ensures we show dependencies before dependents, using the same logic as the deps command
        let fibersToDisplay = [...environment.orderedFibers];
        
        // If a specific fiber name was requested, filter to just that fiber
        if (name) {
          if (!displayFiberIds.includes(name)) {
            console.error(`Fiber '${name}' not found.`);
            process.exit(1);
          }
          fibersToDisplay = [name];
        }

        // Display options for command-line flags
        if (options.available) {
          console.log('Showing fibers with satisfied dependencies\n');
        }
        
        if (options.hideDisabled) {
          console.log('Hiding disabled fibers and chains\n');
        }

        // Display legend at the beginning
        console.log(`Legend: ${DISPLAY.EMOJIS.FIBER} = fiber   ${DISPLAY.EMOJIS.CHAIN} = chain   ${DISPLAY.EMOJIS.ENABLED} = enabled   ${DISPLAY.EMOJIS.DISABLED} = disabled   ${DISPLAY.EMOJIS.DEPENDS_ON} = depends on\n`);

        // Output fibers and chains in a structured format
        for (const fiberId of fibersToDisplay) {
          const isCore = fiberId === 'core';
          const enabled = isFiberEnabled(fiberId, config);
          const satisfied = areFiberDependenciesSatisfied(fiberId, config, dependencyChecker);
          const inConfig = fiberId in config;
          
          // Skip disabled fibers if hide-disabled option is enabled
          if (options.hideDisabled && !enabled && !isCore) {
            continue;
          }
          
          // Get status and validation indicators
          const statusIndicator = getFiberStatus(fiberId, enabled, satisfied, inConfig, options.hideDisabled);
          const fiberValidation = validationResults[fiberId] && !validationResults[fiberId].valid ? '✗' : '';
          
          // Display fiber header
          displayFiberHeader(fiberId, statusIndicator, fiberValidation);
          
          // Add an empty line after fiber name
          console.log('');
          
          // Find the fiber's path from the module result
          const fiberModule = inConfig 
            ? moduleResult.modules.find(m => m.id === fiberId)
            : discoveredFiberMap.get(fiberId);
            
          // Get and display fiber path
          const fiberPath = getFiberPath(fiberId, fiberModule, config);
          console.log(`  📂 ${fiberPath}`);
          
          // Display validation results
          displayValidationResults(validationResults[fiberId]);
          
          // Show fiber dependencies using the dependency graph
          const dependencies = dependencyGraph.dependencyMap.get(fiberId) || [];
          if (dependencies.length > 0) {
            const dependencyText = dependencies.join(', ');
            console.log(`  ${DISPLAY.EMOJIS.DEPENDS_ON} Depends on: ${dependencyText}`);
            
            // Add detailed dependency info if requested
            if (options.detailed) {
              const sources = dependencyGraph.detectionInfo.get(fiberId) || [];
              for (const source of sources) {
                console.log(`    📌 Source: ${source.source}`);
                console.log(`      Dependencies: ${source.deps.join(', ')}`);
              }
            }
          }
          
          // Add a bottom separator line
          console.log(`  ───────────────────────────────────────────`);
          
          // Get chains for this fiber
          const fiberChains = fiberChainMap.get(fiberId) || [];
          
          if (fiberChains.length > 0) {
            // Add plural "s" when count is not 1
            const pluralS = fiberChains.length === 1 ? '' : 's';
            console.log(`  ${fiberChains.length} ${DISPLAY.EMOJIS.CHAIN}${pluralS}:`);
            
            for (const chainId of fiberChains) {
              const chainConfig = config[fiberId]?.moduleConfig?.[chainId];
              
              // Find the module to get accurate enabled state
              const chainModule = findModuleById(
                moduleResult.modules, 
                chainId, 
                'chain'
              );
              
              // Display chain with module
              displayChain(
                chainId,
                chainConfig,
                fiberId,
                config,
                validationResults,
                orderedChains.indexOf(chainId) + 1,
                { 
                  detailed: options.detailed, 
                  hideDisabled: options.hideDisabled 
                },
                chainModule
              );
            }
          } else {
            // Show "0 ${DISPLAY.EMOJIS.CHAIN}s" for empty fibers
            console.log(`  0 ${DISPLAY.EMOJIS.CHAIN}s`);
          }
        }
        
        // Only show summary when displaying all fibers
        if (!name) {
          // Display summary information
          displaySummary(
            fibersToDisplay,
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
        }
      } catch (error) {
        console.error('Error processing fibers:', error);
        process.exit(1);
      }
    });
} 
