# Refactor modules/discovery.ts into smaller, focused modules

## Overview
The current `src/modules/discovery.ts` file is large (466 lines) and mixes file system helpers, module creation, and orchestration logic. This task will split it into focused modules for clarity and maintainability.

## Current Issues
- Monolithic file with mixed responsibilities
- Difficult to extend and test
- File system helpers are not reusable

## Required Changes
- Identify and extract file system helpers to `modules/utils.ts`
- Move module creation/normalization logic to `modules/creation.ts`
- Keep orchestration and public API in `discovery.ts`
- Update all imports and usages
- Ensure all tests pass

## Implementation Steps
- [ ] Identify file system helpers and move to `utils.ts`
- [ ] Move module creation/normalization to `creation.ts`
- [ ] Refactor `discovery.ts` to use new helpers
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new modules
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No references to old helper logic in `discovery.ts`
- [ ] Code is organized by responsibility
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
