# 009: Refactor Fiber Dependency CLI Tests to Pure Function Unit Tests

## Objective

Replace CLI-level tests for `createDepsCommand` with robust unit tests for pure functions involved in fiber dependency logic. Improve test reliability, maintainability, and coverage by focusing on core logic and output formatting, and removing brittle CLI and mock-based tests.

---

## Task Breakdown

### 1. Identify Core Pure Functions
- [ ] List all pure functions involved in fiber dependency logic:
  - [ ] `buildFiberDependencyGraph`
  - [ ] `orderFibers`
  - [ ] Output formatting utilities (tree, flat, JSON, GraphViz)
  - [ ] Any display logic in `src/commands/fibers/utils/display.ts` that can be made pure

### 2. Extract/Isolate Formatting Logic
- [ ] Refactor formatting logic to pure functions that return strings (no direct `console.log`)
- [ ] Ensure all output modes (tree, flat, JSON, GraphViz) are covered

### 3. Write Unit Tests for Pure Functions
- [ ] Use test fixtures (e.g., `createBasicTestEnvironment`, `createComplexTestEnvironment`)
- [ ] Test:
  - [ ] Dependency graph structure (`buildFiberDependencyGraph`)
  - [ ] Fiber ordering (`orderFibers`)
  - [ ] Output formatting (assert on returned strings)
- [ ] Cover edge cases: disabled fibers, toolDeps, reverse mode, etc.

### 4. Minimize or Remove CLI Command Tests
- [ ] Remove or minimize tests that call `createDepsCommand().parseAsync()`
- [ ] Remove need to mock `loadConfigAndModules` for pure logic tests

### 5. Update Test Files and Documentation
- [ ] Move/rename test files to reflect focus on dependency logic, not CLI
- [ ] Add/expand tests for edge cases
- [ ] Update documentation and comments

### 6. Document the Change
- [ ] Update the CHANGELOG to reflect improved test coverage and removal of brittle CLI tests

---

## Verification
- [ ] All new and existing tests pass
- [ ] No CLI-level mocks remain for `loadConfigAndModules`
- [ ] Pure functions are well-tested and documented
- [ ] CHANGELOG.md updated if required
- [ ] PR references this task number 
