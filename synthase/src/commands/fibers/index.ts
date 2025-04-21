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

import { join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { FIBER_NAMES, CONFIG_FIELDS, FILE_NAMES } from '../../constants';

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
        console.log('Legend: 🧬 = fiber   ⛓️ = chain   🟢 = enabled   🔴 = disabled   ⬆️ = depends on\n');

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
 * Create the 'deps' subcommand for showing fiber dependencies in a diagram
 * @returns Configured Command object
 */
function createDepsCommand(): Command {
  return new Command('deps')
    .description('Display fiber dependency diagram')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .option('-H, --hide-disabled', 'Hide disabled fibers')
    .option('-r, --reverse', 'Show reverse dependencies (what requires this fiber)')
    .option('-d, --detailed', 'Show detailed dependency information')
    .option('-f, --flat', 'Show flat list instead of tree view')
    .action(async (options) => {
      try {
        const {
          config,
          moduleResult,
          displayFiberIds,
          orderedFibers
        } = await loadConfigAndModules(options);

        // Filter out disabled fibers if requested
        let fibersToShow = displayFiberIds;
        if (options.hideDisabled) {
          fibersToShow = fibersToShow.filter(fiberId => {
            const isCore = fiberId === 'core';
            return isCore || isFiberEnabled(fiberId, config);
          });
        }
        
        // Get dependency map for each fiber
        const dependencyMap = new Map<string, string[]>();
        const reverseDependencyMap = new Map<string, string[]>();
        const dependencyDetectionInfo = new Map<string, {source: string, deps: string[]}[]>();
        
        // Initialize maps with empty arrays
        for (const fiberId of fibersToShow) {
          dependencyMap.set(fiberId, []);
          reverseDependencyMap.set(fiberId, []);
          dependencyDetectionInfo.set(fiberId, []);
        }
        
        // Load the test-user-config.yaml file directly to get proper fiberDeps
        // This matches the same loading logic used in orderFibersByDependencies
        let rawUserConfig: Record<string, any> = {};
        const configPath = join(process.cwd(), FILE_NAMES.TEST_USER_CONFIG);
        if (fs.existsSync(configPath)) {
          const rawConfig = fs.readFileSync(configPath, 'utf8');
          rawUserConfig = yaml.load(rawConfig) as Record<string, any>;
          if (options.detailed) {
            console.log(`Loaded raw user config from ${configPath}`);
          }
        }
        
        // Collect all possible dependency sources
        for (const fiberId of fibersToShow) {
          const detectionSources: {source: string, deps: string[]}[] = [];
          
          // First try to get dependencies from module metadata
          const fiberModule = moduleResult.modules.find(m => m.id === fiberId && m.type === 'fiber');
          if (fiberModule && fiberModule.metadata && fiberModule.metadata.dependencies) {
            const metadataDeps = fiberModule.metadata.dependencies
              .map(dep => dep.moduleId)
              .filter(depId => fibersToShow.includes(depId));
              
            if (metadataDeps.length > 0) {
              detectionSources.push({
                source: 'module.metadata.dependencies',
                deps: metadataDeps
              });
            }
          }
          
          // Try the raw user config for fiberDeps (which should include config from fiber-specific config.yaml files)
          if (rawUserConfig[fiberId] && rawUserConfig[fiberId][CONFIG_FIELDS.FIBER_DEPS]) {
            const rawConfigDeps = rawUserConfig[fiberId][CONFIG_FIELDS.FIBER_DEPS]
              .filter((depId: string) => fibersToShow.includes(depId));
              
            if (rawConfigDeps.length > 0) {
              detectionSources.push({
                source: 'config.fiberDeps (from test-user-config.yaml)',
                deps: rawConfigDeps
              });
            }
          }
          
          // Fallback to merged config if needed
          if (config[fiberId]) {
            // Check direct fiber dependencies from config fiberDeps
            const configFiberDeps = (config[fiberId] as any)?.fiberDeps || [];
            if (configFiberDeps.length > 0) {
              detectionSources.push({
                source: 'config.fiberDeps (from merged config)',
                deps: configFiberDeps.filter((depId: string) => fibersToShow.includes(depId))
              });
            }
            
            // Check tool dependencies that might map to fibers
            const configToolDeps = (config[fiberId] as any)?.toolDeps || [];
            if (configToolDeps.length > 0) {
              // Find fibers that provide these tools
              const toolToFiberMap = new Map<string, string[]>();
              
              // Build map of tool providers
              for (const otherFiberId of fibersToShow) {
                if (otherFiberId === fiberId) continue; // Skip self
                
                // Check for provides in fiber config
                const provides = (config[otherFiberId] as any)?.provides || [];
                for (const tool of provides) {
                  if (!toolToFiberMap.has(tool)) {
                    toolToFiberMap.set(tool, []);
                  }
                  toolToFiberMap.get(tool)?.push(otherFiberId);
                }
                
                // Check for provides in chains
                const moduleConfig = (config[otherFiberId] as any)?.moduleConfig || {};
                for (const [chainId, chainConfig] of Object.entries(moduleConfig)) {
                  const chainProvides = (chainConfig as any)?.provides || [];
                  for (const tool of chainProvides) {
                    if (!toolToFiberMap.has(tool)) {
                      toolToFiberMap.set(tool, []);
                    }
                    toolToFiberMap.get(tool)?.push(otherFiberId);
                  }
                }
              }
              
              // Find fibers providing tools we depend on
              const toolDerivedDeps: string[] = [];
              for (const tool of configToolDeps) {
                const providers = toolToFiberMap.get(tool) || [];
                for (const provider of providers) {
                  if (!toolDerivedDeps.includes(provider)) {
                    toolDerivedDeps.push(provider);
                  }
                }
              }
              
              if (toolDerivedDeps.length > 0) {
                detectionSources.push({
                  source: 'config.toolDeps (via provides)',
                  deps: toolDerivedDeps
                });
              }
            }
          }
          
          // Store all detection sources
          dependencyDetectionInfo.set(fiberId, detectionSources);
          
          // Get all unique dependencies from all sources 
          const allDeps = Array.from(new Set(
            detectionSources.flatMap(source => source.deps)
          ));
          
          // Set consolidated dependencies
          dependencyMap.set(fiberId, allDeps);
          
          // Update reverse dependencies
          for (const depId of allDeps) {
            const reverseList = reverseDependencyMap.get(depId) || [];
            if (!reverseList.includes(fiberId)) {
              reverseList.push(fiberId);
              reverseDependencyMap.set(depId, reverseList);
            }
          }
        }
        
        // Guess dependencies based on ordered fibers list if none were explicitly defined
        // This is only used when no explicit dependencies were found through other methods
        const totalDeps = Array.from(dependencyMap.values()).reduce((sum, deps) => sum + deps.length, 0);
        if (totalDeps === 0 && orderedFibers.length > 1) {
          console.error('No explicit dependencies found. Inferring dependencies based on load order...');
          
          // Assume each fiber depends on the one before it
          for (let i = 1; i < orderedFibers.length; i++) {
            const fiberId = orderedFibers[i];
            const prevId = orderedFibers[i-1];
            
            if (fibersToShow.includes(fiberId) && fibersToShow.includes(prevId)) {
              // Add dependency
              const deps = dependencyMap.get(fiberId) || [];
              if (!deps.includes(prevId)) {
                deps.push(prevId);
                dependencyMap.set(fiberId, deps);
                
                // Update detection info
                const detectionInfo = dependencyDetectionInfo.get(fiberId) || [];
                detectionInfo.push({
                  source: 'inferred from load order',
                  deps: [prevId]
                });
                dependencyDetectionInfo.set(fiberId, detectionInfo);
                
                // Update reverse deps
                const reverseDeps = reverseDependencyMap.get(prevId) || [];
                if (!reverseDeps.includes(fiberId)) {
                  reverseDeps.push(fiberId);
                  reverseDependencyMap.set(prevId, reverseDeps);
                }
              }
            }
          }
        }
        
        const activeMap = options.reverse ? reverseDependencyMap : dependencyMap;
        
        // If flat view is requested, just show all fibers with their dependencies
        if (options.flat) {
          console.log('Fiber Dependencies:');
          console.log('─────────────────────────');
          
          // Show fibers sorted alphabetically, with core first
          const sortedFibers = [...fibersToShow].sort((a, b) => {
            if (a === 'core') return -1;
            if (b === 'core') return 1;
            return a.localeCompare(b);
          });
          
          for (const fiberId of sortedFibers) {
            const isCore = fiberId === 'core';
            const isEnabled = isCore || isFiberEnabled(fiberId, config);
            const statusSymbol = isEnabled ? '🟢' : '🔴';
            const deps = activeMap.get(fiberId) || [];
            
            // Sort dependencies alphabetically for consistent display
            const sortedDeps = [...deps].sort((a, b) => {
              if (a === 'core') return -1;
              if (b === 'core') return 1;
              return a.localeCompare(b);
            });
            
            const depsText = sortedDeps.length > 0 
              ? sortedDeps.join(', ')
              : '(none)';
              
            if (options.reverse) {
              console.log(`${statusSymbol} ${fiberId}: required by ${depsText}`);
            } else {
              console.log(`${statusSymbol} ${fiberId}: requires ${depsText}`);
            }
            
            if (options.detailed) {
              const sources = dependencyDetectionInfo.get(fiberId) || [];
              if (sources.length > 0) {
                for (const source of sources) {
                  console.log(`   Source: ${source.source}`);
                  console.log(`   Dependencies: ${source.deps.join(', ')}`);
                }
              }
              console.log('');
            }
          }
        } else {
          // Function to print the dependency tree
          const printDependencyTree = (
            fiberId: string, 
            map: Map<string, string[]>, 
            detailInfo: Map<string, {source: string, deps: string[]}[]> | null = null,
            seen: Set<string> = new Set(), 
            prefix = '', 
            isLast = true
          ) => {
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';
            
            // Skip if we've seen this fiber already (cycle prevention)
            if (seen.has(fiberId)) {
              console.log(`${prefix}${connector}${fiberId} (cyclic reference)`);
              return;
            }
            
            // Get enabled/disabled status symbol
            const isCore = fiberId === 'core';
            const isEnabled = isCore || isFiberEnabled(fiberId, config);
            const statusSymbol = isEnabled ? '🟢' : '🔴';
            
            // Display fiber with status
            console.log(`${prefix}${connector}${statusSymbol} ${fiberId}`);
            
            // Show detailed dependency info if requested
            if (options.detailed && detailInfo) {
              const sources = detailInfo.get(fiberId) || [];
              if (sources.length > 0) {
                for (const source of sources) {
                  console.log(`${prefix}${childPrefix}   Source: ${source.source}`);
                  console.log(`${prefix}${childPrefix}   Dependencies: ${source.deps.join(', ')}`);
                }
              }
            }
            
            // Mark as seen for cycle detection
            seen.add(fiberId);
            
            // Get dependencies
            const deps = map.get(fiberId) || [];
            
            // Sort alphabetically for consistent display, but put core first if present
            deps.sort((a, b) => {
              if (a === 'core') return -1;
              if (b === 'core') return 1;
              return a.localeCompare(b);
            });
            
            // Print child dependencies
            deps.forEach((depId, index) => {
              const isLastDep = index === deps.length - 1;
              printDependencyTree(
                depId, 
                map, 
                detailInfo,
                new Set(seen), 
                prefix + childPrefix, 
                isLastDep
              );
            });
          };
          
          console.log('Fiber Dependency Diagram:');
          console.log('─────────────────────────');
          
          // Build proper tree structure without duplication
          // First, identify root nodes (no incoming dependencies or with max outgoing dependencies)
          const allSeen = new Set<string>();
          
          // Find fibers not depending on anything (for normal mode) or not depended upon (for reverse mode)
          const getRootFibers = (): string[] => {
            if (options.reverse) {
              // For reverse mode, roots are fibers that nobody depends on
              return fibersToShow.filter(id => 
                (reverseDependencyMap.get(id) || []).length === 0
              );
            } else {
              // For normal mode, roots are fibers with no dependencies
              return fibersToShow.filter(id => 
                (dependencyMap.get(id) || []).length === 0
              );
            }
          };
          
          // Get root fibers to start the tree
          let rootFibers = getRootFibers();
          
          // If no clear roots, pick fibers with the most dependents (reverse mode) or
          // least dependencies (normal mode)
          if (rootFibers.length === 0) {
            if (options.reverse) {
              // Find fibers with most dependents
              const maxDependents = Math.max(...Array.from(
                reverseDependencyMap.entries(),
                ([_, deps]) => deps.length
              ));
              
              rootFibers = Array.from(
                reverseDependencyMap.entries()
              ).filter(([id, deps]) => 
                deps.length === maxDependents
              ).map(([id, _]) => id);
            } else {
              // Find fibers with fewest dependencies
              const minDependencies = Math.min(...Array.from(
                dependencyMap.entries(),
                ([_, deps]) => deps.length
              ));
              
              rootFibers = Array.from(
                dependencyMap.entries()
              ).filter(([id, deps]) => 
                deps.length === minDependencies
              ).map(([id, _]) => id);
            }
          }
          
          // Sort roots with core first, then alphabetically
          rootFibers.sort((a, b) => {
            if (a === 'core') return -1;
            if (b === 'core') return 1;
            return a.localeCompare(b);
          });
          
          // Build a global tree to avoid duplication
          const buildTree = (
            fibers: string[],
            seen: Set<string> = new Set(),
            prefix = '',
            isLastGroup = true
          ) => {
            // Process each fiber in the root set
            fibers.forEach((fiberId, index) => {
              // Skip if already processed
              if (allSeen.has(fiberId)) return;
              allSeen.add(fiberId);
              
              const isLast = index === fibers.length - 1 && isLastGroup;
              
              // Get enabled/disabled status symbol
              const isCore = fiberId === 'core';
              const isEnabled = isCore || isFiberEnabled(fiberId, config);
              const statusSymbol = isEnabled ? '🟢' : '🔴';
              
              // Display connector
              const connector = isLast ? '└── ' : '├── ';
              const childPrefix = isLast ? '    ' : '│   ';
              
              // Display fiber with status
              console.log(`${prefix}${connector}${statusSymbol} ${fiberId}`);
              
              // Show detailed dependency info if requested
              if (options.detailed) {
                const sources = dependencyDetectionInfo.get(fiberId) || [];
                if (sources.length > 0) {
                  for (const source of sources) {
                    console.log(`${prefix}${childPrefix}   Source: ${source.source}`);
                    console.log(`${prefix}${childPrefix}   Dependencies: ${source.deps.join(', ')}`);
                  }
                }
              }
              
              // Get child dependencies
              let children: string[] = [];
              
              if (options.reverse) {
                // In reverse mode, children are fibers that depend on this fiber
                children = reverseDependencyMap.get(fiberId) || [];
              } else {
                // In normal mode, children are fibers this fiber depends on
                children = dependencyMap.get(fiberId) || [];
              }
              
              // Filter out already processed children
              children = children.filter(id => !allSeen.has(id) && fibersToShow.includes(id));
              
              // Sort children alphabetically for consistent display, but put core first if present
              children.sort((a, b) => {
                if (a === 'core') return -1;
                if (b === 'core') return 1;
                return a.localeCompare(b);
              });
              
              // Include cycle references for dependencies we've already seen
              const cycles = (options.reverse ? reverseDependencyMap : dependencyMap)
                .get(fiberId)
                ?.filter(id => allSeen.has(id) && id !== fiberId) || [];
                
              if (cycles.length > 0) {
                cycles.sort((a, b) => a.localeCompare(b));
                cycles.forEach((cycleId, cycleIndex) => {
                  const isLastCycle = cycleIndex === cycles.length - 1 && children.length === 0;
                  const cycleConnector = isLastCycle ? '└── ' : '├── ';
                  console.log(`${prefix}${childPrefix}${cycleConnector}${cycleId} (cyclic reference)`);
                });
              }
              
              // Process child fibers recursively
              if (children.length > 0) {
                buildTree(children, new Set(seen), prefix + childPrefix, true);
              }
            });
          };
          
          // Start building the tree from root fibers
          buildTree(rootFibers);
          
          // If some fibers weren't included in the tree, add them at the root level
          const remainingFibers = fibersToShow.filter(id => !allSeen.has(id));
          
          if (remainingFibers.length > 0) {
            console.log('\nIndependent Fibers:');
            
            // Sort remaining fibers alphabetically
            remainingFibers.sort((a, b) => a.localeCompare(b));
            
            buildTree(remainingFibers, new Set(), '', true);
          }
        }

        // Show stats
        console.log('\nStats:');
        console.log(`- ${fibersToShow.length} fibers in diagram`);
        
        // Count total dependency relationships
        let totalRelationships = 0;
        for (const deps of dependencyMap.values()) {
          totalRelationships += deps.length;
        }
        console.log(`- ${totalRelationships} dependencies between fibers`);
        
        // Find fibers with the most dependencies
        const mostDeps = [...dependencyMap.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 3)
          .filter(([_, deps]) => deps.length > 0);
          
        if (mostDeps.length > 0) {
          console.log('\nFibers requiring the most dependencies:');
          mostDeps.forEach(([fiberId, deps]) => {
            console.log(`- ${fiberId}: ${deps.length} dependencies`);
          });
        }
        
        // Find fibers that the most other fibers depend on
        const mostRequired = [...reverseDependencyMap.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 3)
          .filter(([_, deps]) => deps.length > 0);
          
        if (mostRequired.length > 0) {
          console.log('\nMost required fibers:');
          mostRequired.forEach(([fiberId, deps]) => {
            console.log(`- ${fiberId}: required by ${deps.length} fibers`);
          });
        }
      } catch (error) {
        console.error('Error displaying fiber dependencies:', error);
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
