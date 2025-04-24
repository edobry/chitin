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
  orderChainsByDependencies,
  generateFiberDependencyGraph
} from '../../fiber';

import {
  orderFibersByDependencies,
  getDependentFibers,
  isFiberEnabled,
  getChainDependencies,
  countDisplayedModules,
  ensureCoreDependencies
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

import { join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { FIBER_NAMES, CONFIG_FIELDS, FILE_NAMES, DISPLAY } from '../../constants';
import { createDepsCommand } from './deps-command';

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
 * Shared function to load config and discover modules
 * @param options Command options
 * @returns Loaded configuration and module data
 */
async function loadConfigAndModules(options: any) {
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
    dependencyChecker
  };
}

/**
 * Create the 'get' subcommand for displaying fibers
 * @returns Configured Command object
 */
function createGetCommand(): Command {
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
          dependencyChecker
        } = await loadConfigAndModules(options);
        
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

        // If a specific fiber name was requested, filter to just that fiber
        let fibersToDisplay = displayFiberIds;
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

/**
 * Create the 'list' subcommand for listing fiber names
 * @returns Configured Command object
 */
function createListCommand(): Command {
  return new Command('list')
    .description('List available fiber names')
    .option('-a, --available', 'List only available fibers (enabled with satisfied dependencies)')
    .option('-H, --hide-disabled', 'Hide disabled fibers')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .action(async (options) => {
      try {
        const {
          config,
          allFibers,
          loadableFibers,
          displayFiberIds,
          dependencyChecker
        } = await loadConfigAndModules(options);
        
        let fibersToList = options.available ? loadableFibers : displayFiberIds;
        
        // Apply hide-disabled option
        if (options.hideDisabled) {
          fibersToList = fibersToList.filter(fiberId => {
            const isCore = fiberId === 'core';
            return isCore || isFiberEnabled(fiberId, config);
          });
        }
        
        // Only output fiber names to stdout, one per line, with no headers or decorations
        for (const fiberId of fibersToList) {
          console.log(fiberId);
        }
      } catch (error) {
        console.error('Error listing fibers:', error);
        process.exit(1);
      }
    });
}

/**
 * Create the 'config' subcommand for showing fiber configuration
 * @returns Configured Command object
 */
function createConfigCommand(): Command {
  return new Command('config')
    .description('Display the configuration for a specific fiber')
    .argument('<name>', 'Name of the fiber to show configuration for')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-j, --json', 'Output in JSON format instead of YAML')
    .action(async (name, options) => {
      try {
        const { config } = await loadConfigAndModules(options);
        
        // Check if the fiber exists in config
        if (!(name in config)) {
          console.error(`Fiber '${name}' not found in configuration.`);
          process.exit(1);
        }
        
        // Get the fiber's configuration
        const fiberConfig = config[name];
        
        // Output the configuration in YAML or JSON format
        if (options.json) {
          console.log(JSON.stringify(fiberConfig, null, 2));
        } else {
          console.log(serializeToYaml(fiberConfig as Record<string, unknown>));
        }
      } catch (error) {
        console.error('Error displaying fiber configuration:', error);
        process.exit(1);
      }
    });
}

/**
 * Create and configure the fibers command with subcommands
 * @returns Configured Command object
 */
export function createFibersCommand(): Command {
  const command = new Command('fibers')
    .description('Manage fibers and their modules')
    .addCommand(createGetCommand())
    .addCommand(createListCommand())
    .addCommand(createDepsCommand())
    .addCommand(createConfigCommand());

  // Make 'get' the default command when no subcommand is specified
  command.action(() => {
    command.help();
  });

  return command;
} 
