#!/usr/bin/env bun
import { Command } from 'commander';
import { loadUserConfig, getFullConfig, validateUserConfig, getCoreConfigValue } from './config';
import { exportEnvironmentToBash } from './shell';
import { serializeToYaml } from './utils';
import { findChitinDir } from './utils/path';
import { discoverModulesFromConfig, validateModules, validateModulesAgainstConfig } from './modules';
import { 
  getLoadableFibers, 
  isFiberEnabled, 
  areFiberDependenciesSatisfied, 
  createChainFilter,
  getFiberIds,
  getChainIds,
  orderChainsByDependencies,
  getChainDependencies
} from './fiber';

// Create the CLI program
const program = new Command();

program
  .name('synthase')
  .description('Configuration and environment management system for shell environments')
  .version('0.1.0');

// Add load-config command
program
  .command('load-config')
  .description('Load and validate the Chitin configuration')
  .option('-j, --json', 'Output as JSON instead of YAML')
  .option('-e, --export-env', 'Export configuration as environment variables')
  .option('-p, --path <path>', 'Custom path to user config file')
  .action(async (options) => {
    try {
      const userConfig = await loadUserConfig({
        userConfigPath: options.path,
      });
      
      const fullConfig = getFullConfig(userConfig);
      
      // Validate the configuration
      const validation = validateUserConfig(fullConfig);
      
      if (!validation.valid) {
        console.error('Configuration validation failed:');
        validation.errors.forEach(error => console.error(`- ${error}`));
        process.exit(1);
      }
      
      // Output format handling
      if (options.json) {
        // Output as JSON
        // Filter out empty objects first
        const cleanedConfig = {...fullConfig};
        for (const key of Object.keys(cleanedConfig)) {
          const value = cleanedConfig[key];
          if (value && typeof value === 'object' && Object.keys(value).length === 0) {
            delete cleanedConfig[key];
          }
        }
        console.log(JSON.stringify(cleanedConfig, null, 2));
      } else if (options.exportEnv) {
        // Export as environment variables
        const env = {
          CHITIN_CONFIG: JSON.stringify(fullConfig),
          CHI_DIR: findChitinDir() || process.cwd(),
          CHI_PROJECT_DIR: getCoreConfigValue(fullConfig, 'projectDir'),
          CHI_DOTFILES_DIR: getCoreConfigValue(fullConfig, 'dotfilesDir'),
          CHI_CHECK_TOOLS: getCoreConfigValue(fullConfig, 'checkTools') ? '1' : '0',
          CHI_AUTOINIT_DISABLED: getCoreConfigValue(fullConfig, 'autoInitDisabled') ? '1' : '0',
        };
        
        const exportPath = await exportEnvironmentToBash(env);
        console.log(`Exported environment to ${exportPath}`);
      } else {
        // Default: Output as YAML
        console.log(serializeToYaml(fullConfig as Record<string, unknown>));
      }
    } catch (error) {
      console.error('Error loading configuration:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Add init command
program
  .command('init')
  .description('Initialize the Chitin environment')
  .option('-c, --config <path>', 'Path to user config file')
  .option('-n, --no-tools', 'Skip tool dependency checking')
  .action(async (options) => {
    try {
      const userConfig = await loadUserConfig({
        userConfigPath: options.config,
      });
      
      const fullConfig = getFullConfig(userConfig);
      
      // Validate the configuration
      const validation = validateUserConfig(fullConfig);
      
      if (!validation.valid) {
        console.error('Configuration validation failed:');
        validation.errors.forEach(error => console.error(`- ${error}`));
        process.exit(1);
      }
      
      // Export configuration as environment variables
      const env = {
        CHITIN_CONFIG: JSON.stringify(cleanConfigForEnv(fullConfig)),
        CHI_DIR: findChitinDir() || process.cwd(),
        CHI_PROJECT_DIR: getCoreConfigValue(fullConfig, 'projectDir'),
        CHI_DOTFILES_DIR: getCoreConfigValue(fullConfig, 'dotfilesDir'),
        CHI_CHECK_TOOLS: (options.tools && getCoreConfigValue(fullConfig, 'checkTools')) ? 'true' : 'false',
        CHI_AUTOINIT_DISABLED: getCoreConfigValue(fullConfig, 'autoInitDisabled') ? 'true' : 'false',
      };
      
      const exportPath = await exportEnvironmentToBash(env);
      console.log(`Configuration loaded and environment exported to ${exportPath}`);
      console.log('Environment initialized. To apply settings to your current shell:');
      console.log(`source ${exportPath}`);
    } catch (error) {
      console.error('Initialization error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Add module discovery command
program
  .command('fibers')
  .description('List fibers and their modules in load order')
  .option('-l, --list', 'List all fibers (default)')
  .option('-a, --available', 'List only available fibers (enabled with satisfied dependencies)')
  .option('-c, --check-dependencies', 'Check dependencies for all fibers')
  .option('-d, --detailed', 'Show detailed information for fibers and chains')
  .action(async (options) => {
    try {
      // Load the user configuration
      const userConfig = await loadUserConfig();
      if (!userConfig) {
        console.error('No user configuration found.');
        process.exit(1);
      }

      const config = getFullConfig(userConfig);
      
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
      
      // Get all chains from all fibers
      const allChainIds = getChainIds(config);
      
      // Create chain filter based on loadable fibers
      const chainFilter = createChainFilter(config, loadableFibers);
      
      // Filter the chains that will be loaded
      const loadableChains = allChainIds.filter(chainId => chainFilter(chainId));
      
      // Order chains by dependencies
      const orderedChains = orderChainsByDependencies(loadableChains, config, loadableFibers);
      
      // Create a map of fibers to their chains
      const fiberChainMap = new Map<string, string[]>();
      
      // First, find which fiber each chain belongs to
      for (const chainId of orderedChains) {
        for (const fiberId of loadableFibers) {
          const fiber = config[fiberId];
          if (fiber?.moduleConfig && chainId in fiber.moduleConfig) {
            if (!fiberChainMap.has(fiberId)) {
              fiberChainMap.set(fiberId, []);
            }
            fiberChainMap.get(fiberId)?.push(chainId);
          }
        }
      }
      
      // Prepare the output header
      const headerPrefix = options.available ? 'Available' : 'All';
      const fiberStatus = options.available ? '(enabled with satisfied dependencies)' : '';
      console.log(`${headerPrefix} fibers ${fiberStatus}:`);
      
      // Output fibers and chains in a structured format
      let fiberIndex = 1;
      for (const fiberId of loadableFibers) {
        const isCore = fiberId === 'core';
        const fiberPrefix = isCore ? 'CORE' : `FIBER ${fiberIndex++}`;
        const enabled = isFiberEnabled(fiberId, config);
        const satisfied = areFiberDependenciesSatisfied(fiberId, config, dependencyChecker);
        const status = isCore ? '(always loaded)' : 
          enabled && satisfied ? '(enabled)' : '(disabled)';
        
        console.log(`\n${fiberPrefix}: ${fiberId} ${status}`);
        
        // Get chains for this fiber
        const fiberChains = fiberChainMap.get(fiberId) || [];
        if (fiberChains.length > 0) {
          console.log(`  Chains (${fiberChains.length}):`);
          for (const chainId of fiberChains) {
            // Find the chain's position in the dependency order
            const orderIndex = orderedChains.indexOf(chainId);
            // Get dependencies
            const dependencies = getChainDependencies(chainId, config, loadableFibers)
              .filter(dep => loadableChains.includes(dep));
            
            // Show chain with load order and dependencies
            if (dependencies.length > 0) {
              console.log(`    ${orderIndex+1}. ${chainId}`);
              console.log(`       Dependencies: ${dependencies.join(', ')}`);
            } else {
              console.log(`    ${orderIndex+1}. ${chainId}`);
            }
            
            // Show additional details if requested
            if (options.detailed) {
              const chainConfig = config[fiberId]?.moduleConfig?.[chainId];
              if (chainConfig) {
                if (chainConfig.enabled === false) {
                  console.log(`       Status: Disabled`);
                }
                if (chainConfig.toolDeps && chainConfig.toolDeps.length > 0) {
                  console.log(`       Tool Dependencies: ${chainConfig.toolDeps.join(', ')}`);
                }
                if (chainConfig.provides && chainConfig.provides.length > 0) {
                  console.log(`       Provides: ${chainConfig.provides.join(', ')}`);
                }
              }
            }
          }
        } else {
          console.log(`  No chains in this fiber`);
        }
      }
      
      // Display chains that aren't tied to any fiber
      const unmappedChains = orderedChains.filter(chainId => 
        !Array.from(fiberChainMap.values()).flat().includes(chainId)
      );
      
      if (unmappedChains.length > 0) {
        console.log(`\nChains not associated with any loaded fiber:`);
        for (let i = 0; i < unmappedChains.length; i++) {
          const chainId = unmappedChains[i];
          console.log(`  ${i+1}. ${chainId}`);
        }
      }
      
      // Add a summary section
      console.log(`\nSummary:`);
      console.log(`- Fibers: ${loadableFibers.length}/${allFibers.length} (${options.available ? 'loadable/total' : 'available/total'})`);
      console.log(`- Chains: ${orderedChains.length}/${allChainIds.length} (${options.available ? 'loadable/total' : 'available/total'})`);
      
    } catch (error) {
      console.error('Error listing fibers:', error);
      process.exit(1);
    }
  });

// Add module validation command
program
  .command('validate')
  .description('Validate module configurations')
  .option('-j, --json', 'Output in JSON format')
  .option('-y, --yaml', 'Output in YAML format')
  .action(async (options) => {
    try {
      const userConfig = await loadUserConfig();
      if (!userConfig) {
        console.error('No user configuration found.');
        process.exit(1);
      }
      
      const fullConfig = getFullConfig(userConfig);
      
      // Validate the configuration with focus on paths
      const validation = validateUserConfig(fullConfig);
      if (!validation.valid) {
        console.error('Configuration validation failed:');
        validation.errors.forEach(error => console.error(`- ${error}`));
        // Continue anyway but warn the user
        console.warn('Continuing with module validation despite validation errors...');
      }
      
      console.log('Discovering modules...');
      
      const result = await discoverModulesFromConfig(fullConfig);
      
      if (result.errors.length > 0) {
        console.warn('Encountered errors during module discovery:');
        for (const error of result.errors) {
          console.warn(`- ${error}`);
        }
      }
      
      console.log('Validating modules...');
      const validationResults = validateModulesAgainstConfig(
        result.modules,
        fullConfig
      );
      
      if (options.json) {
        console.log(JSON.stringify(validationResults, null, 2));
      } else if (options.yaml) {
        console.log(serializeToYaml({ results: validationResults }));
      } else {
        // Display validation results
        console.log('Validation results:');
        
        for (const [moduleId, result] of Object.entries(validationResults)) {
          console.log(`- ${moduleId}: ${result.valid ? 'Valid' : 'Invalid'}`);
          
          if (result.errors.length > 0) {
            console.log('  Errors:');
            for (const error of result.errors) {
              console.log(`  - ${error}`);
            }
          }
          
          if (result.warnings.length > 0) {
            console.log('  Warnings:');
            for (const warning of result.warnings) {
              console.log(`  - ${warning}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error validating modules:', error);
      process.exit(1);
    }
  });

// Parse the command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}

/**
 * Removes empty objects from a configuration object
 * @param config Configuration object
 * @returns Cleaned configuration object
 */
function cleanConfigForEnv(config: Record<string, any>): Record<string, any> {
  const cleaned = {...config};
  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key];
    if (value && typeof value === 'object' && Object.keys(value).length === 0) {
      delete cleaned[key];
    }
  }
  return cleaned;
} 
