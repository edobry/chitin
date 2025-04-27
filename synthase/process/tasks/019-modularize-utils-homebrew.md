# Modularize utils/homebrew.ts before further growth

## Overview
The current `src/utils/homebrew.ts` file is approaching 400 lines and mixes environment setup, caching, and package query logic. This task will modularize it to prevent future bloat and clarify responsibilities.

## Current Issues
- Mixed responsibilities in a single file
- Difficult to maintain as it grows
- Caching and environment logic are not reusable

## Required Changes
- Move Homebrew environment/config logic to `homebrew-env.ts`
- Move caching logic to `homebrew-cache.ts`
- Keep package query/check logic in `homebrew.ts`
- Update imports and usages
- Test Homebrew-related features

## Implementation Steps
- [ ] Move environment/config logic to `homebrew-env.ts`
- [ ] Move caching logic to `homebrew-cache.ts`
- [ ] Refactor `homebrew.ts` to use new helpers
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new modules
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No references to old logic in `homebrew.ts`
- [ ] Code is organized by responsibility
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
