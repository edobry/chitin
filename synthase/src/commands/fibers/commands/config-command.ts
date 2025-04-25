import { Command } from 'commander';
import { loadConfigAndModules } from '../utils/config-loader';
import { serializeToYaml } from '../../../utils';
import { FiberCommandOptions } from '../types';

/**
 * Create the 'config' subcommand for showing fiber configuration
 * @returns Configured Command object
 */
export function createConfigCommand(): Command {
  return new Command('config')
    .description('Display the configuration for a specific fiber')
    .argument('<n>', 'Name of the fiber to show configuration for')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-j, --json', 'Output in JSON format instead of YAML')
    .action(async (name, options: FiberCommandOptions) => {
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
