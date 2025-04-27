# Fix fiber order in `fibers get` to respect dependencies

## Overview
The current implementation of the `fibers get` command does not always respect fiber dependency order. For example, 'oplabs' may appear before 'cloud' even though it depends on 'cloud'. This task will ensure that the display order of fibers in `fibers get` matches their dependency relationships, so that no fiber appears before its dependencies.

## Current Issues
- Fibers that depend on others (e.g., 'oplabs' depends on 'cloud') may be displayed before their dependencies in the output of `fibers get`.
- The ordering logic in `orderFibers` does not always produce a correct topological order for display.

## Required Changes
- Analyze and update the `orderFibers` function to guarantee that all dependencies are displayed before their dependents in the output.
- Add or update tests to verify correct ordering for various dependency graphs.
- Update documentation if necessary to clarify the intended order.

## Implementation Steps
- [ ] Review the current implementation of `orderFibers` in `src/commands/fibers/utils/dependency-utils.ts`.
- [ ] Identify the cause of incorrect ordering (e.g., topological sort, special handling, or options).
- [ ] Refactor or fix the ordering logic to ensure correct dependency order.
- [ ] Add/expand unit tests for `orderFibers` to cover edge cases and real-world scenarios (e.g., oplabs/cloud).
- [ ] Manually verify the output of `fibers get` for known dependency structures.
- [ ] Update documentation if the user-facing behavior or options change.

## Verification
- [ ] All fibers in `fibers get` output appear after their dependencies (no dependent before its dependency).
- [ ] Tests for `orderFibers` pass and cover new/edge cases.
- [ ] Manual check: 'oplabs' does not appear before 'cloud' if it depends on 'cloud'.
- [ ] CHANGELOG.md updated with a summary of the fix.

## Notes
- Coordinate with any ongoing refactors to the fiber/chain ordering logic.
- If the fix requires changes to the CLI output or user documentation, ensure those are reviewed and approved. 
