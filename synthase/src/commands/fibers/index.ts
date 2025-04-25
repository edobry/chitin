import { Command } from 'commander';
import { serializeToYaml } from '../../utils';
import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { validateModulesAgainstConfig } from '../../modules/validator';
import { UserConfig } from '../../config/types';
import { Module } from '../../modules/types';
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
import { FIBER_NAMES } from '../../fiber/types';
import { CONFIG_FIELDS } from '../../config/types';
import { FILE_NAMES, EMOJI } from '../../constants';
import { createDepsCommand } from './deps-command';
import { createGetCommand } from './get-command';

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
