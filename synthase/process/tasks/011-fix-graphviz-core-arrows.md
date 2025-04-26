# Task 011: Fix --graphviz mode to avoid explicit 'core' dependency arrows from fibers with transitive paths to core

## Summary
Update the `--graphviz` output of the `fibers deps` command so that it does not include explicit dependency arrows to 'core' from fibers that already have a transitive dependency path to core. This will make the graph less cluttered and more accurate.

## Steps
- Analyze the current logic for generating dependency arrows in GraphViz mode.
- Update the implementation to check for transitive paths to 'core' before adding a direct arrow.
- Ensure that only direct (non-redundant) dependencies to 'core' are shown.
- Add or update tests to verify the new behavior.
- Update documentation or help text if needed.
- Update the CHANGELOG.md to record the fix.

## Rationale
Currently, the GraphViz output can be cluttered and misleading due to redundant arrows to 'core' from fibers that already depend on core transitively. Removing these explicit arrows will improve clarity and correctness.

## Related Files
- `src/commands/fibers/commands/deps-command.ts`
- `src/fiber/graph.ts` (or wherever GraphViz output is generated)
- Tests and documentation referencing GraphViz output

## Acceptance Criteria
- The `--graphviz` output no longer includes explicit arrows to 'core' from fibers with transitive paths to core.
- Tests verify that only direct dependencies to 'core' are shown.
- CHANGELOG.md updated with a note about the fix. 
