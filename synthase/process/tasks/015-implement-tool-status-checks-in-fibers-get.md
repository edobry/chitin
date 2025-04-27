# Implement tool status checks in `fibers get`

## Overview
The `fibers get` command should determine whether an enabled fiber should be active based on the real status of its required tools, not just configuration. This should reuse the logic from `tools get --status` (see `checkToolStatuses` in `tools/status.ts`).

## Current Issues
- `fibers get` currently only checks config to determine if a fiber is active/enabled.
- Tool status (e.g., whether a required tool is actually available/working) is not checked, leading to inaccurate fiber activation display.

## Required Changes
- Integrate tool status checks into the `fibers get` command.
- Reuse the logic from `tools get --status` (specifically, `checkToolStatuses` in `tools/status.ts`).
- Ensure that fiber activation reflects real tool status, not just config.
- Update tests to cover tool status integration.

## Implementation Steps
- [ ] Review the current implementation of `fibers get` and how fiber activation is determined.
- [ ] Review `checkToolStatuses` in `tools/status.ts` and how it is used in `tools get --status`.
- [ ] Refactor or extract shared logic if needed to allow reuse in `fibers get`.
- [ ] Integrate tool status checks into the fiber activation logic in `fibers get`.
- [ ] Update or add tests to verify correct behavior when tools are missing, broken, or available.
- [ ] Update documentation if the user-facing behavior or options change.

## Verification
- [ ] Fibers are only shown as active if their required tools are actually available and working.
- [ ] Tests for `fibers get` cover tool status scenarios.
- [ ] Manual check: disabling or breaking a required tool causes the corresponding fiber to be shown as inactive.
- [ ] CHANGELOG.md updated with a summary of the change.

## Notes
- Coordinate with any ongoing refactors to tool or fiber status logic.
- If the fix requires changes to the CLI output or user documentation, ensure those are reviewed and approved. 
