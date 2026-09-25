# Synthase

TypeScript/Bun port of the chitin bash framework, today a read-only introspection CLI: `config`,
`init` (environment-file export only), `fibers` (get, list, deps, config), `tools` (get, list,
with status checks). It cannot install tools, source chains, or bootstrap a shell; the bash
framework in the parent directory remains authoritative at runtime. Whether Synthase becomes the
runtime, a hybrid config producer for the bash fast path, or is shelved is Minsky task mt#5213.

## Commands

- Run: `bun run src/cli.ts <command>`. `src/cli.ts` is the entry point; the root `index.ts` is a
  bun-init leftover.
- Test: `bun test` (55 tests across 10 files). `bun run test` is a hardcoded `exit 1` stub until
  mt#5212 lands.
- Types: `bunx tsc --noEmit`. 73 errors as of 2026-09-25; about 40 of them come from
  `src/types.ts` shadowing `src/types/index.ts` and `src/constants.ts` shadowing
  `src/constants/index.ts`.
- Build: `bun run build` (library bundle into `dist/`).

## State to know before editing

- Task #021 (refactor `src/commands/tools/index.ts`) was frozen mid-step on 2025-05-01 with its
  work-in-progress uncommitted in the main checkout: `handlers.ts` and `helpers.ts` exist, but the
  duplicate code at `index.ts:84-349` was never deleted. `handlers.ts` is a semantic superset, not
  a copy; finishing requires a behavioural diff review (mt#5212).
- Tasks live in Minsky, not in `process/tasks/`. That markdown backlog is being retired
  (mt#5214); `process/spec.md` and the round records remain the design corpus.
- The Cursor rules under `.cursor/rules/` predate Minsky. The compiled rules in
  `../.claude/rules/` take precedence where they overlap.
- `dotenv` is imported but missing from `package.json`.
