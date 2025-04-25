/**
 * @file get-command.ts
 * @description Implementation of the 'get' subcommand for the fibers command.
 * This command is responsible for displaying detailed information about fibers
 * and their associated modules.
 */

import { Command } from 'commander';
import { loadConfigAndModules } from './shared';
import { processFibers } from './processor';
import { renderFibers } from './renderer';
import { FiberCommandOptions } from './models';
import { areFiberDependenciesSatisfied } from '../../fiber';

/**
 * Create the 'get' subcommand for displaying fibers
 * @returns Configured Command object
 */
export function createGetCommand(): Command {
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
        // Load environment data
        const environment = await loadConfigAndModules(options);
        
        // If checking dependencies, handle that separately
        if (options.checkDependencies) {
          console.log('Dependency status for fibers:');
          for (const fiberId of environment.allFibers) {
            const satisfied = areFiberDependenciesSatisfied(
              fiberId, 
              environment.config,
              environment.dependencyChecker
            );
            console.log(`- ${fiberId}${fiberId === 'core' ? ' (core)' : ''}: ${satisfied ? 'Dependencies satisfied' : 'Missing dependencies'}`);
          }
          return;
        }

        // Process the data
        const processedData = processFibers(environment, { 
          name, 
          available: options.available,
          hideDisabled: options.hideDisabled,
          detailed: options.detailed,
          allModules: options.allModules
        });
        
        // Render the output
        if (options.json) {
          console.log(renderFibers(processedData, { format: 'json' }));
        } else if (options.yaml) {
          console.log(renderFibers(processedData, { format: 'yaml' }));
        } else {
          renderFibers(processedData, { 
            format: 'console',
            detailed: options.detailed
          });
        }
      } catch (error) {
        console.error('Error processing fibers:', error);
        process.exit(1);
      }
    });
} 
