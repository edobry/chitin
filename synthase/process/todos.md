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
  - Extract and centralize constants per domain (merged from #023)

- [ ] Refactor utils/tools.ts into domain-oriented modules [#016](tasks/016-refactor-utils-tools.md)
- [ ] Refactor modules/discovery.ts into smaller, focused modules [#017](tasks/017-refactor-modules-discovery.md)
- [ ] Refactor utils/shell-pool.ts for clarity and maintainability [#018](tasks/018-refactor-utils-shell-pool.md)
- [ ] Modularize utils/homebrew.ts before further growth [#019](tasks/019-modularize-utils-homebrew.md)
- [ ] Refactor fiber/manager.ts by responsibility [#020](tasks/020-refactor-fiber-manager.md)
- [ ] Refactor commands/tools/index.ts for CLI maintainability [#021](tasks/021-refactor-commands-tools-index.md)
- [ ] Audit and reorganize modules by domain [#022](tasks/022-audit-reorganize-modules-domain.md)

- [ ] Add lint/CI checks for file size [#024](tasks/024-add-lint-ci-file-size-checks.md)

### Fiber/Chain Ordering and Dependency

- [ ] Remove --detailed flag from fibers deps command [#010](tasks/010-remove-detailed-flag.md)
- [ ] Fix --graphviz mode to avoid explicit 'core' dependency arrows from fibers with transitive paths to core [#011](tasks/011-fix-graphviz-core-arrows.md)
- [ ] Fix fiber order in `fibers get` to respect dependencies [#014](tasks/014-fix-fiber-order-in-fibers-get.md)
- [ ] Abstract and Refactor Module Ordering (Fibers & Chains) [#008](tasks/008-order-modules-abstraction.md)
- [ ] Refactor Fiber Dependency CLI Tests to Pure Function Unit Tests [#009](tasks/009-refactor-fiber-deps-tests.md)
  - Replace CLI-level tests for createDepsCommand with unit tests for pure functions
  - Extract/ensure pure formatting and graph logic
  - Write/expand tests for buildFiberDependencyGraph, orderFibers, and output formatting
  - Remove unnecessary mocks and CLI parsing from tests

### Post-Refactor Testing and Documentation

- [ ] Add/update tests and documentation for refactored modules [#025](tasks/025-update-tests-docs-refactor.md)
- [ ] Update project documentation for new structure [#026](tasks/026-update-project-docs-structure.md)

### Other Improvements

- [x] Modularize Fiber Command Structure [#012](tasks/012-fiber-command-modularization.md)
  - Broke up monolithic fibers command into modular subcommands and utilities
  - Created new directory structure and moved logic into domain-oriented modules
  - Consolidated display constants and improved maintainability

- [x] Refactor Fiber Command for Separation of Concerns [#013](tasks/013-fiber-command-refactoring.md)
  - Separated data loading, processing, and rendering for fibers get command
  - Introduced display models and pure processing functions
  - Enabled easier testing and future interface expansion

- [ ] Implement tool status checks in `fibers get` [#015](tasks/015-implement-tool-status-checks.md)
