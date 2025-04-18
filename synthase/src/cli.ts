#!/usr/bin/env bun
import { createCLI } from './commands';

// Create the CLI program
const program = createCLI();

// Parse the command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
} 
