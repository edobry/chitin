# Chitin

Modular shell framework: helpers group into chains, chains into fibers (`chitin-*` sibling repos
discovered under `core.projectDir`). Two generations live here with zero runtime linkage. The
**bash framework** (`init.sh`, `chains/`) is what every interactive shell actually runs.
**Synthase** (`synthase/`) is a TypeScript/Bun read-only introspection CLI and a partial port.
Bash is authoritative at runtime until the endpoint decision in Minsky task mt#5213 says otherwise.

The working knowledge base (architecture, audit with 23 confirmed defects, fiber ecosystem,
Synthase state, roadmap) is the Notion page "Chitin":
https://app.notion.com/p/3ac937f03cb48197b951c24c9b2d1cae. Work is tracked in Minsky under
umbrella task mt#5205; follow the session workflow in `.claude/rules/`.

## Working on the bash framework

- **It is zsh-only in practice.** Test in zsh. `just check` (root justfile, from mt#5207) runs
  `zsh -n` over every shell file.
  `bash -n` fails on `chains/core/module.sh` for a pre-existing reason (audit defect B1).
- `export CHI_AUTOINIT_DISABLED=true` while developing, then load deliberately with `chiShell`
  (`chiShellDebug` adds per-line timings). It is also the recovery path when the loader breaks:
  set it, open a shell, fix, unset.
- Point `XDG_CONFIG_HOME` at a scratch directory before testing module loading, so experiments
  never touch the real `~/.config/chitin/userConfig.yaml`.
- Real behaviour needs real fibers: `chitin-*` siblings in `~/Projects` and a populated
  userConfig. A bare clone exercises about a third of the loader. Some meta functions assume the
  checkout is named `chitin` (defect B15).
- Measure, never guess: `just bench` (README, "Startup performance"). A non-TTY shell trips the
  lite-mode guard in `~/.zshenv` and skips chitin entirely, so `time zsh -i -c exit` lies.
- To test a checkout other than `~/Projects/chitin`, such as a Minsky session clone, use
  `just bench --init <clone>/init.sh`. The startup snapshot cache is keyed by checkout path, so
  clones never share cached state with the live checkout.

## Traps that produce silent wrong behaviour

- `local x=$(cmd)` discards the exit code of `cmd`; a following `[[ $? ]]` always passes (B11).
- A `while read` fed by a pipe runs in a subshell under bash and loses its exports (B6). zsh runs
  the last pipeline stage in the current shell, which is the only reason it works today.
- `return $(cmd)` returns the command's stdout, not its status.
- `chains/init` and `chains/core` are sourced twice per startup: once by `chiShell`, once again
  as nested chains. Source-time side effects run twice, the second pass in `find` order.
- `chiFiberLoadExternalLoop` retries until every fiber loads; a misspelled or disabled
  `fiberDeps` entry hangs login (audit risk #1, addressed by mt#5209).

## Invariants when changing the loader

1. The framework's state is its `CHI_*` variables: `CHI_CONFIG_<module>`,
   `CHI_MODULE_{NAME,PATH,LOADED,TOOLS}_<module>`, `CHI_TOOLS`. Anything that produces them
   during fiber loading must be visible to the snapshot cache (`chains/core/snapshot.sh`): record
   an input when you read a new file, a replay line when you cause a side effect the fast path
   must reproduce.
2. Module names are `fiber:chain`; their variable names replace `:` and `-` with `_`.
3. Module `config.yaml` values merge under the user's `userConfig.yaml`; user values win.
4. A chain whose `toolDeps` are unmet is not loaded. With `core.checkTools: false`, no tool is
   ever checked and every dependency counts as met.
5. Every function opens with `requireArg ... || return 1` guards. Keep the discipline.

## Synthase

See `synthase/CLAUDE.md`.
