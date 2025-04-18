import { Command } from 'commander';
import { createLoadConfigCommand } from './load-config';
import { createInitCommand } from './init';
import { createFibersCommand } from './fibers';

/**
 * Creates the root CLI program with all commands registered
 * @returns Configured Command object
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name('synthase')
    .description('Configuration and environment management system for shell environments')
    .version('0.1.0');

  // Register all commands
  program.addCommand(createLoadConfigCommand());
  program.addCommand(createInitCommand());
  program.addCommand(createFibersCommand());

  return program;
} 
