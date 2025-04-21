#!/usr/bin/env bun
import { createCLI } from './commands';

// Debug utility to show logs only when DEBUG environment variable is set
const DEBUG = process.env.DEBUG === 'true';
function debug(...args: any[]): void {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

debug("Starting CLI...");

// Create the CLI program
const program = createCLI();

debug("Created CLI program, parsing arguments...");

// Parse the command line arguments
program.parse();

debug("Parsed arguments, checking command...");

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}

debug("CLI execution completed."); 
