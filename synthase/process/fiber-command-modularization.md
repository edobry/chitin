# Fiber Command Modularization Plan

## Overview

The current implementation of the `fibers` command and its subcommands is contained in a single large file (`index.ts`), making it difficult to maintain and extend. This document outlines a plan to modularize the command structure for better organization and maintainability.

## Current Issues

1. **Monolithic Structure**:
   - All subcommands are defined in a single file
   - Configuration loading and module discovery logic is mixed with command definitions
   - Utility functions are scattered throughout the file

2. **Limited Modularity**:
   - Difficult to add new subcommands without modifying the main file
   - Shared functionality is not easily reusable
   - Testing individual components is challenging

3. **Code Organization**:
   - No clear separation between different types of functionality
   - Large functions with multiple responsibilities
   - Mixed concerns between data loading, processing, and command definition

## Refactoring Goals

1. Create a clear, modular structure for the `fibers` command and its subcommands
2. Separate shared functionality into reusable modules
3. Improve code organization and maintainability
4. Make it easier to add new subcommands
5. Enable better testing of individual components

## Implementation Plan

### Step 1: Create Directory Structure

Create a new directory structure for the `fibers` command:

```
src/commands/fibers/
├── index.ts (main export only)
├── commands/
│   ├── list-command.ts
│   ├── config-command.ts
│   ├── deps-command.ts
│   └── get-command.ts
├── utils/
│   ├── module-utils.ts
│   └── config-loader.ts
└── types/
    └── index.ts
```

### Step 2: Extract Utility Functions

Move utility functions to appropriate modules:

1. Create `module-utils.ts`:
   - Move `findModuleById` and other module-related utilities
   - Add proper TypeScript types and documentation

2. Create `config-loader.ts`:
   - Extract `loadConfigAndModules` function
   - Split into smaller, focused functions
   - Add proper error handling and validation

### Step 3: Extract Command Definitions

Move each command to its own file:

1. Create `list-command.ts`:
   - Move `createListCommand` function
   - Add proper types for options and arguments
   - Include command-specific utilities

2. Create `config-command.ts`:
   - Move `createConfigCommand` function
   - Add proper types for options and arguments
   - Include command-specific utilities

### Step 4: Update Main Export

Simplify `index.ts` to only handle command composition:

```typescript
// src/commands/fibers/index.ts
import { Command } from 'commander';
import { createListCommand } from './commands/list-command';
import { createConfigCommand } from './commands/config-command';
import { createDepsCommand } from './commands/deps-command';
import { createGetCommand } from './commands/get-command';

export function createFibersCommand(): Command {
  const command = new Command('fibers')
    .description('Manage fibers and their modules')
    .addCommand(createListCommand())
    .addCommand(createConfigCommand())
    .addCommand(createDepsCommand())
    .addCommand(createGetCommand());

  // Make 'get' the default command when no subcommand is specified
  command.action(() => {
    command.help();
  });

  return command;
}
```

### Step 5: Add Types

Create a types file for shared interfaces and types:

```typescript
// src/commands/fibers/types/index.ts
export interface FiberCommandOptions {
  path?: string;
  baseDirs?: string[];
  available?: boolean;
  hideDisabled?: boolean;
  detailed?: boolean;
  json?: boolean;
}

// Other shared types...
```

### Step 6: Consolidate Display Constants

Consolidate display-related constants into a single location:

1. Create `src/utils/display.ts`:
   - Move all display constants from `constants.ts` and `ui.ts`
   - Organize emojis into logical categories
   - Add proper TypeScript types and documentation

```typescript
// src/utils/display.ts
export const DISPLAY = {
  EMOJIS: {
    // Entity types
    FIBER: '🧬',
    CHAIN: '⛓️',
    TOOL: '🔧',
    REFERENCE: '🔗',
    
    // Status indicators
    ENABLED: '🟢',
    DISABLED: '⚫',
    WARNING: '⚠️',
    ERROR: '❌',
    UNKNOWN: '⚪',
    
    // Relationships
    DEPENDS_ON: '⬆️',
    PROVIDES: '📦',
    
    // Actions
    CHECK: '🔍',
    INSTALL: '🏗️',
    
    // Properties
    PATH: '📂',
    ADDITIONAL_INFO: '📋'
  }
} as const;

// Add type definitions for better type safety
export type DisplayEmoji = typeof DISPLAY.EMOJIS[keyof typeof DISPLAY.EMOJIS];
```

2. Update imports in affected files:
   - Remove display constants from `constants.ts`
   - Remove display constants from `ui.ts`
   - Import from `display.ts` where needed

## Implementation Order

Follow this sequence to minimize disruption:

1. Create the new directory structure
2. Extract utility functions to their own modules
3. Move command definitions to their own files
4. Update imports and exports
5. Add proper types and documentation
6. Update tests to reflect the new structure

## Benefits

This modularization will:

1. Make the code more maintainable and easier to understand
2. Enable better testing of individual components
3. Make it easier to add new subcommands
4. Improve code organization and separation of concerns
5. Make shared functionality more reusable

## Future Extensions

Once this modularization is complete, you could:

1. Add new subcommands without modifying existing files
2. Create shared utilities for common operations
3. Add more sophisticated error handling
4. Implement better testing for individual components

## Example Usage After Refactoring

```typescript
// Adding a new subcommand
// src/commands/fibers/commands/new-command.ts
export function createNewCommand(): Command {
  return new Command('new')
    .description('Create a new fiber')
    .action(async (options) => {
      // Implementation
    });
}

// src/commands/fibers/index.ts
import { createNewCommand } from './commands/new-command';

export function createFibersCommand(): Command {
  const command = new Command('fibers')
    // ... existing commands ...
    .addCommand(createNewCommand());
  // ...
}
``` 
