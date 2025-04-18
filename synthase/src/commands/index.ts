import { Command } from 'commander';
import { createConfigCommand } from './config';
import { createInitCommand } from './init';
import { createFibersCommand } from './fibers';
import { createToolsCommand } from './tools';

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
  program.addCommand(createConfigCommand());
  program.addCommand(createInitCommand());
  program.addCommand(createFibersCommand());
  program.addCommand(createToolsCommand());

  return program;
} 
