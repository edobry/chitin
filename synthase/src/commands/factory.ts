import { Command } from 'commander';
import { setupProcessCleanup } from '../utils/process';
import { withConfig, ConfigContext } from './utils';

/**
 * Options for subcommand creation
 */
export interface SubcommandOptions {
  name: string;
  description: string;
  // Callback function that handles the command action
  action: (context: ConfigContext) => Promise<void>;
  // Array of command arguments [name, description, default?]
  arguments?: [string, string, any?][];
  // Array of command options [flags, description, default?]
  options?: [string, string, any?][];
  // Whether to use shell resources (defaults to true)
  useShell?: boolean;
  // Whether to discover modules (defaults to true)
  discoverModules?: boolean;
  // Additional options parser
  parseOptions?: (program: Command) => Command;
}

/**
 * Options for command creation
 */
export interface CommandOptions {
  name: string;
  description: string;
  subcommands?: SubcommandOptions[];
  defaultSubcommand?: string;
  // Command-level options
  options?: [string, string, any?][];
  // Whether the command needs process cleanup
  needsProcessCleanup?: boolean;
}

/**
 * Create a standard subcommand
 * @param program Base command
 * @param options Subcommand options
 * @returns Configured subcommand
 */
function createSubcommand(program: Command, options: SubcommandOptions): Command {
  let subcommand = new Command(options.name)
    .description(options.description);
  
  // Add arguments
  (options.arguments || []).forEach(([name, description, defaultValue]) => {
    if (defaultValue !== undefined) {
      subcommand = subcommand.argument(name, description, defaultValue);
    } else {
      subcommand = subcommand.argument(name, description);
    }
  });
  
  // Add options
  (options.options || []).forEach(([flags, description, defaultValue]) => {
    if (defaultValue !== undefined) {
      subcommand = subcommand.option(flags, description, defaultValue);
    } else {
      subcommand = subcommand.option(flags, description);
    }
  });
  
  // Apply custom options parser if provided
  if (options.parseOptions) {
    subcommand = options.parseOptions(subcommand);
  }
  
  // Set command action
  subcommand.action(async (args, cmdOptions) => {
    const mergedOptions = { ...cmdOptions };
    
    // Add useShell and discoverModules flags
    mergedOptions.useShell = options.useShell !== false;
    mergedOptions.discoverModules = options.discoverModules !== false;
    
    // Call withConfig with the action
    await withConfig(options.action, mergedOptions);
  });
  
  return subcommand;
}

/**
 * Create a command with standardized structure and error handling
 * @param options Command options
 * @returns Configured Command object
 */
export function createCommand(options: CommandOptions): Command {
  const command = new Command(options.name)
    .description(options.description);
  
  // Add command-level options
  (options.options || []).forEach(([flags, description, defaultValue]) => {
    if (defaultValue !== undefined) {
      command.option(flags, description, defaultValue);
    } else {
      command.option(flags, description);
    }
  });
  
  // Add subcommands
  const subcommands = options.subcommands || [];
  subcommands.forEach(subOptions => {
    command.addCommand(createSubcommand(command, subOptions));
  });
  
  // Set up default subcommand if specified
  if (options.defaultSubcommand) {
    const defaultSubcommand = subcommands.find(sub => sub.name === options.defaultSubcommand);
    if (defaultSubcommand) {
      command.action(async (cmdOptions) => {
        const mergedOptions = { ...cmdOptions };
        
        // Add useShell and discoverModules flags
        mergedOptions.useShell = defaultSubcommand.useShell !== false;
        mergedOptions.discoverModules = defaultSubcommand.discoverModules !== false;
        
        // Call withConfig with the action
        await withConfig(defaultSubcommand.action, mergedOptions);
      });
    }
  }
  
  // Set up process cleanup if needed
  if (options.needsProcessCleanup !== false) {
    setupProcessCleanup();
  }
  
  return command;
} 
