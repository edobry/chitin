# Refactor utils/tools.ts into domain-oriented modules

## Overview
The current `src/utils/tools.ts` file is monolithic (776 lines) and mixes tool status, config, display, and batch logic. This task will split it into focused, domain-oriented modules to improve maintainability and testability.

## Current Issues
- Single-responsibility principle is violated
- Difficult to test and maintain
- High risk of merge conflicts

## Required Changes
- Analyze and categorize all code in `tools.ts`
- Create a `src/utils/tools/` subdirectory
- Move:
  - Tool status/result types and enums → `status.ts`
  - Tool status checking logic → `status.ts`
  - Tool config extraction/normalization → `config.ts`
  - Display helpers → `display.ts`
  - Batch operations → `batch.ts`
- Update all imports throughout the codebase
- Add index file for re-exports if needed
- Run and update all tests

## Implementation Steps
- [ ] Categorize all code in `tools.ts`
- [ ] Create new files in `src/utils/tools/`
- [ ] Move code to new files by domain
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new modules
- [ ] Remove old monolithic file
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No references to old `tools.ts` remain
- [ ] Code is organized by domain
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts
- Announce breaking import changes to the team 
