# Refactor commands/tools/index.ts for CLI maintainability

## Overview
The current `src/commands/tools/index.ts` file is large (384 lines) and contains command setup, argument parsing, and action handlers. This task will split it for maintainability and extensibility.

## Current Issues
- Mixed responsibilities in a single file
- Difficult to extend and test
- Action handlers and helpers are not clearly separated

## Required Changes
- Move command setup/registration to `index.ts`
- Move action handlers to `handlers.ts`
- Move shared helpers to `helpers.ts`
- Update all imports and usages
- Test CLI commands for tools

## Implementation Steps
- [ ] Move action handlers to `handlers.ts`
- [ ] Move shared helpers to `helpers.ts`
- [ ] Refactor `index.ts` to use new modules
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new modules
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No references to old logic in `index.ts`
- [ ] Code is organized by responsibility
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
