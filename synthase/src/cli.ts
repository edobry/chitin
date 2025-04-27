#!/usr/bin/env bun
import { createCLI } from './commands';

// Debug utility to show logs only when DEBUG environment variable is set
function debug(...args: any[]): void {
  if (process.env.DEBUG && process.env.DEBUG !== 'false' && process.env.DEBUG !== '0') {
    console.log('[DEBUG CLI]', ...args);
  }
}

debug("Starting CLI...");

// Create the CLI program
const program = createCLI();

debug("Created CLI program, parsing arguments...");

// Top-level error handling
(async () => {
  try {
    // Parse the command line arguments
    await program.parseAsync();
    debug("Parsed arguments, checking command...");
    // If no arguments provided, show help
    if (process.argv.length <= 2) {
      program.help();
    }
    debug("CLI execution completed.");
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (process.env.DEBUG && process.env.DEBUG !== 'false' && process.env.DEBUG !== '0') {
      console.error(error.stack || error.message);
    } else {
      console.error(error.message.split('\n')[0]);
    }
    process.exit(1);
  }
})();

// Global error handlers to suppress error dumps
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  if (process.env.DEBUG && process.env.DEBUG !== 'false' && process.env.DEBUG !== '0') {
    console.error(error.stack || error.message);
  } else {
    console.error(error.message.split('\n')[0]);
  }
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  if (process.env.DEBUG && process.env.DEBUG !== 'false' && process.env.DEBUG !== '0') {
    console.error(error.stack || error.message);
  } else {
    console.error(error.message.split('\n')[0]);
  }
  process.exit(1);
});
