# Chitin task runner. `just --list` shows recipes; Synthase has its own justfile in synthase/.

# Time interactive zsh startup with chitin loaded. See scripts/bench-startup.zsh --help.
bench *ARGS:
    scripts/bench-startup.zsh {{ARGS}}

# Syntax-check every shell file with zsh -n; run shellcheck when installed.
check:
    scripts/check.zsh

# Dump a fresh shell's observable state (CHI_* env, functions, aliases, PATH, fpath) to FILE.
# `just state-dump a.txt --cold` then `just state-dump b.txt` and `diff a.txt b.txt` is the
# parity check for loader and snapshot changes. See scripts/state-dump.zsh --help.
state-dump FILE *ARGS:
    scripts/state-dump.zsh {{FILE}} {{ARGS}}
