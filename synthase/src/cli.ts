#!/usr/bin/env bun
import { createCLI } from './commands';

console.log("Starting CLI...");

// Create the CLI program
const program = createCLI();

console.log("Created CLI program, parsing arguments...");

// Parse the command line arguments
program.parse();

console.log("Parsed arguments, checking command...");

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}

console.log("CLI execution completed."); 
