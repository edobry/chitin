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
  displaySummary,
  displayFiber
} from './display';

import {
  associateChainsByFiber,
  filterDisabledFibers,
  orderFibersByConfigAndName
} from './organization';

/**
 * Find a module in a list of modules by ID and optionally by type
 * @param modules List of modules to search
 * @param id Module ID to find
 * @param type Optional module type filter
 * @returns The found module or undefined
 */
function findModuleById(modules: Module[], id: string, type?: 'fiber' | 'chain'): Module | undefined {
  return modules.find(module => 
    module.id === id && (type === undefined || module.type === type)
  );
}

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
    .option('-S, --hide-standalone', 'Hide the standalone fiber (for chains not associated with any fiber)')
    .option('-j, --json', 'Output validation results in JSON format')
    .option('-y, --yaml', 'Output validation results in YAML format')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .action(async (options) => {
      try {
        // Load and validate configuration
        const { config, validation } = await loadAndValidateConfig({
          userConfigPath: options.path,
          exitOnError: false
        });
        
        if (!validation.valid) {
          console.error('Configuration validation failed:');
          validation.errors.forEach(error => console.error(`- ${error}`));
          console.warn('Continuing despite validation errors...');
        }
        
        // Discover and validate modules (silently)
        const moduleResult = await discoverModulesFromConfig(
          config, 
          options.baseDirs || []
        );
        
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

        // Display options for command-line flags
        if (options.available) {
          console.log('Showing fibers with satisfied dependencies\n');
        }
        
        if (options.hideDisabled) {
          console.log('Hiding disabled fibers and chains\n');
        }

        // Display legend at the beginning
        console.log('Legend: 🧬 = fiber   ⛓️ = chain   🟢 = enabled   🔴 = disabled   ⬆️ = depends on\n');

        // Output fibers and chains in a structured format
        for (const fiberId of displayFiberIds) {
          // Skip standalone fiber if it's empty or if hide-standalone option is set
          if ((fiberId === 'standalone' && 
              (!fiberChainMap.has('standalone') || fiberChainMap.get('standalone')?.length === 0)) || 
              (options.hideStandalone && fiberId === 'standalone')) {
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
          if (fiberId !== 'standalone') {
            console.log(`  📂 ${fiberPath}`);
          }
          
          // Display validation results
          displayValidationResults(validationResults[fiberId]);
          
          // Show fiber dependencies using the discovered modules
          displayFiberDependencies(fiberId, config, { 
            detailed: options.detailed, 
            hideDisabled: options.hideDisabled 
          }, moduleResult.modules);
          
          // Add a bottom separator line
          console.log(`  ───────────────────────────────────────────`);
          
          // Get chains for this fiber
          const fiberChains = fiberChainMap.get(fiberId) || [];
          
          if (fiberChains.length > 0) {
            // Add plural "s" when count is not 1
            const pluralS = fiberChains.length === 1 ? '' : 's';
            console.log(`  ${fiberChains.length} ⛓️${pluralS}:`);
            
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
            // Show "0 ⛓️s" for empty fibers
            console.log(`  0 ⛓️s`);
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
