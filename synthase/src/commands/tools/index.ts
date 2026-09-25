/**
 * Tools command for managing and displaying tool configurations.
 * Handlers live in ./handlers, shared setup in ./helpers.
 */
import { Command } from 'commander';
import { setupProcessCleanup } from '../../utils/process';
import { DEFAULT_TOOL_CONCURRENCY } from './constants';
import { handleToolsCommand, handleListCommand } from './handlers';

/**
 * Creates a tools command
 * @returns Configured Command object
 */
export function createToolsCommand(): Command {
  const cmd = new Command('tools')
    .description('Manage and display tool configurations')
    .addCommand(
      new Command('get')
        .description('Get information about configured tools')
        .argument('[toolNames...]', 'Optional tool name(s) to display')
        .option('-d, --detailed', 'Show detailed tool configuration')
        .option('--status', 'Check if tools are installed')
        .option('--missing', 'Only show tools that are not installed')
        .option('--filter-source <source>', 'Filter tools by source')
        .option('--filter-check <method>', 'Filter tools by check method')
        .option('--filter-install <method>', 'Filter tools by install method')
        .option('-y, --yes', 'Skip confirmation when checking many tools')
        .option('--json', 'Output in JSON format')
        .option('--yaml', 'Output in YAML format')
        .option('--concurrency <number>', `Number of tools to check in parallel`, String(DEFAULT_TOOL_CONCURRENCY))
        .option('--no-cache', 'Disable status check caching')
        .option('--cache-max-age <milliseconds>', 'Maximum age for cached status results in milliseconds')
        .option('--skip-tools <toolIds>', 'Comma-separated list of tool IDs to skip checking')
        .option('--debug', 'Show debug timing information')
        .option('--timeout <ms>', 'Timeout in milliseconds for each tool status check')
        .action(handleToolsCommand)
    )
    .addCommand(
      new Command('list')
        .description('List tool names for scripts')
        .option('--filter-source <source>', 'Filter tools by source')
        .option('--filter-check <method>', 'Filter tools by check method')
        .option('--filter-install <method>', 'Filter tools by install method')
        .action(handleListCommand)
    );
  
  // Display help when no subcommand is specified
  cmd.action(() => {
    cmd.help();
  });
  
  // Set up process cleanup
  setupProcessCleanup();
  
  return cmd;
}
