import { Command } from 'commander';
import { loadConfigAndModules } from '../utils/config-loader';
import { isFiberEnabled } from '../utils';
import { FiberCommandOptions } from '../types';

/**
 * Create the 'list' subcommand for listing fiber names
 * @returns Configured Command object
 */
export function createListCommand(): Command {
  return new Command('list')
    .description('List available fiber names')
    .option('-a, --available', 'List only available fibers (enabled with satisfied dependencies)')
    .option('-H, --hide-disabled', 'Hide disabled fibers')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .action(async (options: FiberCommandOptions) => {
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
