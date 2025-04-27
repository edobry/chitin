# Extract and centralize constants per domain

## Overview
Constants (strings, numbers, config) are currently scattered throughout the codebase. This task will extract and centralize them in dedicated files per domain, improving maintainability and reducing duplication.

## Current Issues
- Magic strings/numbers in logic files
- Duplicated constants
- Hard to update or audit configuration

## Required Changes
- Identify repeated strings/numbers in each large file
- Create or update `constants/` modules for each domain (e.g., `tools/constants.ts`, `fiber/constants.ts`)
- Replace in-line values with named constants
- Update all usages
- Test for regressions

## Implementation Steps
- [ ] Identify repeated constants in each domain
- [ ] Create/update constants files per domain
- [ ] Replace in-line values with named constants
- [ ] Update imports in all affected files
- [ ] Add/adjust tests for new constants
- [ ] Update documentation if needed

## Verification
- [ ] All tests pass
- [ ] No magic strings/numbers in logic files
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
