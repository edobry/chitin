# Chitin task runner. `just --list` shows recipes; Synthase has its own justfile in synthase/.

# Time interactive zsh startup with chitin loaded. See scripts/bench-startup.zsh --help.
bench *ARGS:
    scripts/bench-startup.zsh {{ARGS}}

# Syntax-check every shell file with zsh -n; run shellcheck when installed.
check:
    scripts/check.zsh
