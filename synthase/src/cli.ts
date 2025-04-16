#!/usr/bin/env bun
import { Command } from 'commander';
import { loadUserConfig, getFullConfig, validateUserConfig, getCoreConfigValue } from './config';
import { exportEnvironmentToBash } from './shell';
import { serializeToYaml } from './utils';
import { findChitinDir } from './utils/path';
import { discoverModulesFromConfig, validateModules, validateModulesAgainstConfig } from './modules';
import { createFiberManager } from './fiber';

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
  .command('discover-modules')
  .description('Discover modules')
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
      console.log('Discovering modules...');
      
      const result = await discoverModulesFromConfig(fullConfig);
      
      if (result.errors.length > 0) {
        console.warn('Encountered errors during module discovery:');
        for (const error of result.errors) {
          console.warn(`- ${error}`);
        }
      }
      
      if (options.json) {
        console.log(JSON.stringify(result.modules, null, 2));
      } else if (options.yaml) {
        console.log(serializeToYaml({ modules: result.modules }));
      } else {
        console.log(`Discovered ${result.modules.length} modules:`);
        for (const module of result.modules) {
          console.log(`- ${module.id} (${module.type})`);
        }
      }
    } catch (error) {
      console.error('Error discovering modules:', error);
      process.exit(1);
    }
  });

// Add fiber management command
program
  .command('fibers')
  .description('Manage fibers')
  .option('-l, --list', 'List all fibers')
  .option('-a, --active', 'List active fibers')
  .option('--activate <fiber>', 'Activate a fiber')
  .option('--deactivate <fiber>', 'Deactivate a fiber')
  .action(async (options) => {
    try {
      const fiberManager = createFiberManager();
      
      // Load fiber state
      await fiberManager.loadFiberState();
      
      if (options.activate) {
        const success = fiberManager.activateFiber(options.activate);
        if (success) {
          console.log(`Activated fiber: ${options.activate}`);
        } else {
          console.error(`Failed to activate fiber: ${options.activate}`);
          process.exit(1);
        }
      } else if (options.deactivate) {
        const success = fiberManager.deactivateFiber(options.deactivate);
        if (success) {
          console.log(`Deactivated fiber: ${options.deactivate}`);
        } else {
          console.error(`Failed to deactivate fiber: ${options.deactivate}`);
          process.exit(1);
        }
      } else if (options.active) {
        const activefibers = fiberManager.getActiveFibers();
        console.log('Active fibers:');
        for (const fiber of activefibers) {
          console.log(`- ${fiber.id}`);
        }
      } else {
        // Default to listing all fibers
        const fibers = fiberManager.getAllFibers();
        console.log('All fibers:');
        for (const fiber of fibers) {
          console.log(`- ${fiber.id} ${fiber.active ? '(active)' : ''}`);
        }
      }
    } catch (error) {
      console.error('Error managing fibers:', error);
      process.exit(1);
    }
  });

// Add module validation command
program
  .command('validate-modules')
  .description('Validate discovered modules')
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
