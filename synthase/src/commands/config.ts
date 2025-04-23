import { Command } from 'commander';
import { exportEnvironmentToBash } from '../shell';
import { serializeToYaml } from '../utils';
import { withConfig, createEnvironmentVariables } from './utils';
import { createCommand } from './factory';

/**
 * Create and configure the config command
 * @returns Configured Command object
 */
export function createConfigCommand(): Command {
  return createCommand({
    name: 'config',
    description: 'Load and validate the Chitin configuration',
    options: [
      ['-j, --json', 'Output as JSON instead of YAML'],
      ['-e, --export-env', 'Export configuration as environment variables'],
      ['-p, --path <path>', 'Custom path to user config file']
    ],
    needsProcessCleanup: false, // This command doesn't need process cleanup
    subcommands: [],
    defaultSubcommand: undefined // Use the main action
  })
  .action(async (options) => {
    // Use our withConfig utility
    await withConfig(async ({ config }) => {
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
    }, {
      ...options,
      discoverModules: false, // Don't need to discover modules for config display
      useShell: options.exportEnv // Only need shell if exporting environment
    });
  });
} 
