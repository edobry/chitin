import { Command } from 'commander';
import { createListCommand } from './commands/list-command';
import { createConfigCommand } from './commands/config-command';
import { createDepsCommand } from './commands/deps-command';
import { createGetCommand } from './commands/get-command';

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

// Re-export utility functions
export * from './utils';
export * from './display';
export * from './organization';
export * from './processor';
export * from './renderer';
export * from './types';
export * from './models'; 
