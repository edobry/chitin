import { Command } from 'commander';
import { exportEnvironmentToBash } from '../shell';
import { loadAndValidateConfig, createEnvironmentVariables } from './utils';

/**
 * Create and configure the init command
 * @returns Configured Command object
 */
export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize the Chitin environment')
    .option('-c, --config <path>', 'Path to user config file')
    .option('-n, --no-tools', 'Skip tool dependency checking')
    .action(async (options) => {
      try {
        // Load and validate configuration
        const { config } = await loadAndValidateConfig({
          userConfigPath: options.config,
          exitOnError: true
        });
        
        // Export configuration as environment variables
        const env = createEnvironmentVariables(config, { tools: options.tools });
        
        const exportPath = await exportEnvironmentToBash(env);
        console.log(`Configuration loaded and environment exported to ${exportPath}`);
        console.log('Environment initialized. To apply settings to your current shell:');
        console.log(`source ${exportPath}`);
      } catch (error) {
        console.error('Initialization error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
} 
