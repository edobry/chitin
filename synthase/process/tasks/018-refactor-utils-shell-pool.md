# Refactor utils/shell-pool.ts for clarity and maintainability

## Overview
The current `src/utils/shell-pool.ts` file is large (480 lines) and contains a single class with many responsibilities. This task will decompose the file for clarity and maintainability.

## Current Issues
- Large class with many methods
- Environment setup and error handling are mixed with pool logic
- Difficult to test and extend

## Required Changes
- Extract shell environment setup logic to `shell-env.ts`
- Move error handling utilities to `shell-errors.ts`
- Keep pool management and command execution in `shell-pool.ts`
- Update all imports and usages
- Test shell pool initialization and command execution

## Implementation Steps
- [ ] Extract environment setup to `shell-env.ts`
- [ ] Move error handling to `shell-errors.ts`
- [ ] Refactor `shell-pool.ts` to use new helpers
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new modules
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No references to old logic in `shell-pool.ts`
- [ ] Code is organized by responsibility
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
