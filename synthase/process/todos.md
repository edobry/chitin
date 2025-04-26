# Synthase TODOs

## How to Use This File

This file tracks work items for the Synthase project. Each task follows this format:

```markdown
- [ ] Task Title [#123](tasks/123-task-title.md)
```

## Tasks

### Fiber Command Modularization

- [ ] Fix Test Dependencies [#001](tasks/001-fix-test-dependencies.md)
  - Update test imports after shared.ts removal
  - Fix mock implementations
  - Update test utilities

- [ ] Improve Type Safety [#002](tasks/002-improve-type-safety.md)
  - Remove any types from config-loader.ts
  - Add proper type definitions
  - Implement type guards where needed

- [ ] Enhance Error Handling [#003](tasks/003-enhance-error-handling.md)
  - Create custom error types
  - Implement consistent error handling
  - Add error recovery strategies

- [ ] Clean Up Import Paths [#004](tasks/004-clean-up-import-paths.md)
  - Implement path aliases
  - Update import statements
  - Document import conventions

- [ ] Improve Module Documentation [#005](tasks/005-improve-module-documentation.md)
  - Add comprehensive JSDoc comments
  - Document complex algorithms
  - Create module-level documentation

- [ ] Refactor Utility Organization [#006](tasks/006-refactor-utility-organization.md)
  - Extract shared functionality
  - Reduce command coupling
  - Improve utility reusability

- [ ] Implement Constants Management [#007](tasks/007-implement-constants-management.md)
  - Follow constants-management rule
  - Organize domain-specific constants
  - Update constant references

- [ ] Abstract and Refactor Module Ordering (Fibers & Chains) [#008](tasks/008-order-modules-abstraction.md)

- [ ] Refactor Fiber Dependency CLI Tests to Pure Function Unit Tests [#009](tasks/009-refactor-fiber-deps-tests.md)
  - Replace CLI-level tests for createDepsCommand with unit tests for pure functions
  - Extract/ensure pure formatting and graph logic
  - Write/expand tests for buildFiberDependencyGraph, orderFibers, and output formatting
  - Remove unnecessary mocks and CLI parsing from tests

- [ ] Remove --detailed flag from fibers deps command [#010](tasks/010-remove-detailed-flag.md)

- [ ] Fix --graphviz mode to avoid explicit 'core' dependency arrows from fibers with transitive paths to core [#011](tasks/011-fix-graphviz-core-arrows.md)

- [x] Modularize Fiber Command Structure [#012](tasks/012-fiber-command-modularization.md)
  - Broke up monolithic fibers command into modular subcommands and utilities
  - Created new directory structure and moved logic into domain-oriented modules
  - Consolidated display constants and improved maintainability

- [x] Refactor Fiber Command for Separation of Concerns [#013](tasks/013-fiber-command-refactoring.md)
  - Separated data loading, processing, and rendering for fibers get command
  - Introduced display models and pure processing functions
  - Enabled easier testing and future interface expansion

- [ ] Fix fiber order in `fibers get` to respect dependencies [#014](tasks/014-fix-fiber-order-in-fibers-get.md)

- [ ] Implement tool status checks in `fibers get` [#015](tasks/015-implement-tool-status-checks-in-fibers-get.md)
