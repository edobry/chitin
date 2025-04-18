import { Command } from 'commander';
import { exportEnvironmentToBash } from '../shell';
import { serializeToYaml } from '../utils';
import { loadAndValidateConfig, createEnvironmentVariables } from './utils';

/**
 * Create and configure the config command
 * @returns Configured Command object
 */
export function createConfigCommand(): Command {
  const command = new Command('config')
    .description('Load and validate the Chitin configuration')
    .option('-j, --json', 'Output as JSON instead of YAML')
    .option('-e, --export-env', 'Export configuration as environment variables')
    .option('-p, --path <path>', 'Custom path to user config file')
    .action(async (options) => {
      try {
        // Load and validate configuration
        const { config, validation } = await loadAndValidateConfig({
          userConfigPath: options.path,
          exitOnError: true
        });
        
        // Output format handling
        if (options.json) {
          // Output as JSON
          console.log(JSON.stringify(config, null, 2));
        } else if (options.exportEnv) {
          // Export as environment variables
          const env = createEnvironmentVariables(config);
          
          const exportPath = await exportEnvironmentToBash(env);
          console.log(`Exported environment to ${exportPath}`);
        } else {
          // Default: Output as YAML
          console.log(serializeToYaml(config as Record<string, unknown>));
        }
      } catch (error) {
        console.error('Error loading configuration:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
} 
