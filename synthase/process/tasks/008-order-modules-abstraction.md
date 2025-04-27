# 008: Abstract and Refactor Module Ordering (Fibers & Chains)

## Objective

Unify and refactor the logic for ordering fibers and chains by dependencies into a generic, reusable utility. Ensure robust test coverage, error handling, and documentation.

---

## Task Breakdown

### 1. Full Test Coverage for Existing Functions
- [ ] Expand unit tests for `orderFibers` to cover all options and edge cases:
  - [ ] prioritizeConfigured
  - [ ] sortAlphabetically
  - [ ] handleSpecialFibers
  - [ ] specialDependentSorting
  - [ ] includeDiscovered
  - [ ] hideDisabled
  - [ ] reverse
  - [ ] Edge cases: empty input, single fiber, circular/cyclic dependencies, missing dependencies, disabled fibers, discovered vs. configured fibers, special handling for `core` and `dotfiles`, mixed metadata/config, missing fields
- [ ] Add integration tests for `orderFibers` simulating real config/module discovery and ordering
- [ ] Create or expand tests for `orderChainsByDependencies`:
  - [ ] Simple and complex dependency graphs
  - [ ] Chains with no dependencies, multiple dependencies, circular dependencies
  - [ ] Chains not in input but referenced as dependencies
  - [ ] Chains with dependencies on non-existent chains
  - [ ] Order stability (input order preserved when possible)

### 2. Create Tests for a Generic `orderModules` Utility
- [ ] Design a new test file (e.g., `order-modules.test.ts`) with:
  - [ ] Generic test cases: nodes with dependencies, cycles, missing nodes
  - [ ] Configurable options: special-case handling, filtering, prioritization, custom dependency extraction
  - [ ] Behavioral parity: ensure new function can replicate all behaviors of both `orderFibers` and `orderChainsByDependencies`
  - [ ] Regression tests: copy over key scenarios from existing fiber and chain tests

### 3. Implement the New `orderModules` Function
- [ ] Create a generic utility (e.g., `orderModules<T>`) that:
  - [ ] Accepts a list of nodes, a dependency extraction function, and an options object
  - [ ] Performs a topological sort (using a graph or DFS as appropriate)
  - [ ] Supports hooks/options for always-first/always-last nodes, filtering, prioritization, custom sorting, cycle detection/handling
  - [ ] Is type-safe and well-documented
- [ ] Refactor `orderFibers` and `orderChainsByDependencies` to use this utility
- [ ] Ensure all existing and new tests pass

### 4. Documentation
- [ ] Update or add doc comments for the new utility and its options
- [ ] Add migration notes for future maintainers (e.g., "all module ordering should use `orderModules`")

### 5. Code Cleanup
- [ ] Remove any now-redundant code in `orderFibers` and `orderChainsByDependencies`
- [ ] Ensure all imports/exports are correct and there is no dead code

### 6. Error Handling
- [ ] Ensure the new utility provides clear errors/warnings for cycles or invalid input
- [ ] Add tests for error scenarios (e.g., cycles, missing dependencies)

---

## Verification
- [ ] All new and existing tests pass
- [ ] No dead or redundant code remains
- [ ] Documentation is up to date
- [ ] CHANGELOG.md updated if required
- [ ] PR references this task number 
