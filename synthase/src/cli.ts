#!/usr/bin/env bun
import { Command } from 'commander';
import { loadUserConfig, getFullConfig, validateUserConfig, getCoreConfigValue } from './config';
import { exportEnvironmentToBash } from './shell';
import { serializeToYaml } from './utils';
import { findChitinDir } from './utils/path';

// Create the CLI program
const program = new Command();

program
  .name('synthase')
  .description('TypeScript port of Chitin initialization system')
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
        console.log(JSON.stringify(fullConfig, null, 2));
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

// Add init command (minimal for Round 1)
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
        CHITIN_CONFIG: JSON.stringify(fullConfig),
        CHI_DIR: findChitinDir() || process.cwd(),
        CHI_PROJECT_DIR: getCoreConfigValue(fullConfig, 'projectDir'),
        CHI_DOTFILES_DIR: getCoreConfigValue(fullConfig, 'dotfilesDir'),
        CHI_CHECK_TOOLS: options.tools && getCoreConfigValue(fullConfig, 'checkTools') ? '1' : '0',
        CHI_AUTOINIT_DISABLED: getCoreConfigValue(fullConfig, 'autoInitDisabled') ? '1' : '0',
      };
      
      const exportPath = await exportEnvironmentToBash(env);
      console.log(`Configuration loaded and environment exported to ${exportPath}`);
      
      // The actual initialization will be implemented in Round 2-4
      console.log('Basic initialization complete. Full initialization will be implemented in future rounds.');
    } catch (error) {
      console.error('Initialization error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse the command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
} 
