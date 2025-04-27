# Task 010: Remove --detailed flag from fibers deps command

## Summary
Remove the `--detailed` flag and all related code from the `fibers deps` command, as it does not provide useful or actionable information for users.

## Steps
- Remove the `--detailed` option from the CLI definition in `createDepsCommand`.
- Remove all code paths, formatting, and logic related to the `--detailed` flag in the implementation.
- Update any documentation, help text, or tests that reference the `--detailed` flag.
- Ensure the command works as expected without the flag and that no references remain.
- Update the CHANGELOG.md to record the removal.

## Rationale
User feedback indicates that the `--detailed` output does not add value and clutters the command output. Removing it will simplify the CLI and reduce maintenance burden.

## Related Files
- `src/commands/fibers/commands/deps-command.ts`
- Documentation and tests referencing `--detailed`

## Acceptance Criteria
- The `fibers deps` command no longer accepts or documents a `--detailed` flag.
- No code or tests reference the flag or its output.
- CHANGELOG.md updated with a note about the removal. 
