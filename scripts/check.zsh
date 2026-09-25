#!/usr/bin/env zsh
# check.zsh - syntax gate for the bash framework.
#
# Runs `zsh -n` on init.sh and every *.sh / *.zsh under chains/ and scripts/.
# `bash -n` is deliberately not used: chains/core/module.sh has a comment-only
# `else` branch (audit defect B1) and the framework is zsh-only in practice.
# shellcheck runs when installed (`brew install shellcheck`), configured by
# .shellcheckrc at the repo root.

emulate -L zsh
cd "${0:A:h:h}" || exit 1

typeset -i failed=0
typeset -a files
files=(init.sh chains/**/*.sh(N) chains/**/*.zsh(N) scripts/*.zsh(N))

local f err
for f in $files; do
  if ! err=$(zsh -n "$f" 2>&1); then
    print -u2 "zsh -n FAILED: $f"
    print -u2 -r -- "$err"
    failed=1
  fi
done
(( failed )) || print "zsh -n: ${#files} files OK"

if command -v shellcheck >/dev/null; then
  shellcheck init.sh chains/**/*.sh(N) || failed=1
else
  print "shellcheck: not installed, skipped (brew install shellcheck)"
fi

exit $failed
