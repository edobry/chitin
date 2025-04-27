# Refactor fiber/manager.ts by responsibility

## Overview
The current `src/fiber/manager.ts` file is large (381 lines) and contains many related but distinct functions for fiber and chain management. This task will split it by responsibility for clarity and maintainability.

## Current Issues
- Mixed responsibilities in a single file
- Difficult to extend and test
- Fiber and chain logic are not clearly separated

## Required Changes
- Move fiber ID/extraction logic to `fiber/ids.ts`
- Move enablement/dependency logic to `fiber/dependencies.ts`
- Move chain management/ordering to `fiber/chains.ts`
- Update all imports and usages
- Test fiber and chain management features

## Implementation Steps
- [ ] Move ID/extraction logic to `ids.ts`
- [ ] Move enablement/dependency logic to `dependencies.ts`
- [ ] Move chain management/ordering to `chains.ts`
- [ ] Refactor `manager.ts` to use new helpers
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new modules
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No references to old logic in `manager.ts`
- [ ] Code is organized by responsibility
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
