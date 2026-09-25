# Synthase

TypeScript/Bun port of the chitin bash framework, today a read-only introspection CLI: `config`,
`init` (environment-file export only), `fibers` (get, list, deps, config), `tools` (get, list,
with status checks). It cannot install tools, source chains, or bootstrap a shell; the bash
framework in the parent directory remains authoritative at runtime. Whether Synthase becomes the
runtime, a hybrid config producer for the bash fast path, or is shelved is Minsky task mt#5213.

Work is tracked in Minsky under umbrella task mt#5205; the project knowledge base (Synthase
state reconstruction, port-coverage matrix, audit) is the Notion page "Chitin":
https://app.notion.com/p/3ac937f03cb48197b951c24c9b2d1cae.

## Commands

- Run: `bun run src/cli.ts <command>`. `src/cli.ts` is the entry point; the root `index.ts` is a
  bun-init leftover.
- Test: `bun run test` (or `bun test`): 55 tests across 10 files.
- Types: `bunx tsc --noEmit`. 27 errors as of 2026-09-25 (73 before mt#5212 removed the
  `src/types.ts` and `src/constants.ts` files that shadowed the `types/` and `constants/`
  directories). The remaining ones are genuine: two competing `UserConfig` types in
  `commands/fibers/utils/config-loader.ts`, `unknown`-typed config reads, a union indexed in
  `fiber/dependency-graph.ts`, and test fixtures missing `ModuleDependency` fields.
- Build: `bun run build` (library bundle into `dist/`).

## State to know before editing

- `src/commands/tools/index.ts` is command registration only; handlers live in `handlers.ts`,
  shared setup in `helpers.ts` (task #021, finished by mt#5212 after sitting half-done from
  2025-05-01; the behavioural decisions are in that commit message and the CHANGELOG).
- Tasks live in Minsky, not in `process/tasks/`. That markdown backlog is being retired
  (mt#5214); `process/spec.md` and the round records remain the design corpus.
- The Cursor rules under `.cursor/rules/` predate Minsky. The compiled rules in
  `../.claude/rules/` take precedence where they overlap.
