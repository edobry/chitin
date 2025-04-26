# Audit and reorganize modules by domain

## Overview
Many modules are currently organized by technical category rather than domain. This task will audit and reorganize modules to group related logic by what they operate on, improving maintainability and clarity.

## Current Issues
- Cross-domain logic in utility files
- Domain-specific utilities not co-located
- Increased risk of import cycles and confusion

## Required Changes
- Review all `utils/`, `commands/`, and `modules/` files for cross-domain logic
- Move domain-specific utilities into relevant submodules
- Update documentation to reflect new structure
- Update imports and usages

## Implementation Steps
- [ ] Audit all modules for domain boundaries
- [ ] Move domain-specific utilities to relevant submodules
- [ ] Update imports in all affected files
- [ ] Update documentation for new structure

## Verification
- [ ] All tests pass
- [ ] No cross-domain logic remains in utility files
- [ ] Documentation is updated
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
