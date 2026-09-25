#!/usr/bin/env zsh
# state-dump.zsh - dump the observable state of a fresh interactive shell with chitin loaded.
#
# Two dumps of the same configuration should be byte-identical whether the shell
# took the cold path or replayed a snapshot, and whoever produced that snapshot.
# This is the acceptance instrument for loader changes and for the Synthase
# snapshot producer (mt#5213): dump a cold shell, dump a shell restored from the
# candidate snapshot, diff.
#
# Usage:
#   scripts/state-dump.zsh OUT_FILE [--init PATH] [--cold] [ENV=VALUE ...]
#
#   OUT_FILE     where to write the dump
#   --init PATH  load this init.sh through a scratch ZDOTDIR instead of ~/.zshrc
#   --cold       force a full load (CHI_SNAPSHOT_DISABLED=true)
#   ENV=VALUE    extra environment for the shell (e.g. XDG_CONFIG_HOME=/tmp/cfg)
#
# The dump holds, in order: exported CHI_* variables (minus the volatile ones),
# function names, aliases, PATH entries (minus fnm's per-process directories),
# and fpath. Session-random syntax-highlighting widget names are normalised and
# the checkout path is replaced by @ROOT@ so dumps from different checkouts of
# the same tree compare equal.

emulate -L zsh
setopt pipe_fail

typeset out='' init_path='' cold=0
typeset -a extra_env
while (( $# )); do
  case $1 in
    --init) init_path=${2:A}; shift 2 ;;
    --cold) cold=1; shift ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *=*) extra_env+=("$1"); shift ;;
    *) if [[ -z $out ]]; then out=$1; shift; else print -u2 "unexpected argument: $1"; exit 2; fi ;;
  esac
done
[[ -n $out ]] || { print -u2 "usage: state-dump.zsh OUT_FILE [--init PATH] [--cold] [ENV=VALUE ...]"; exit 2 }
(( cold )) && extra_env+=(CHI_SNAPSHOT_DISABLED=true)

typeset -a clean_env
clean_env=(env -u LITE_MODE -u VSCODE_PID)
typeset v
for v in ${(k)parameters[(I)CHI_*]}; do clean_env+=(-u "$v"); done
clean_env+=(TERM_PROGRAM=iTerm.app)

typeset zdotdir root_marker
zdotdir=$(mktemp -d "${TMPDIR:-/tmp}/chitin-dump.XXXXXX")
trap 'rm -rf "$zdotdir"' EXIT
print -r -- '[[ -f ~/.zshenv ]] && source ~/.zshenv' > "$zdotdir/.zshenv"
if [[ -n $init_path ]]; then
  [[ -f $init_path ]] || { print -u2 "no such file: $init_path"; exit 2 }
  print -r -- "source ${(qq)init_path}" > "$zdotdir/.zshrc"
  root_marker=${init_path:h}
else
  print -r -- '[[ -f ~/.zshrc ]] && source ~/.zshrc' > "$zdotdir/.zshrc"
  root_marker=${HOME}/Projects/chitin
fi
cat >> "$zdotdir/.zshrc" <<RC
{
  env | grep '^CHI_' | grep -v -E '^CHI_(LOG_TIME|SNAPSHOT_[A-Z_]*|ENV_INITIALIZED|TOOL_STATUS|TOOLS_CHECK_ENABLED|CACHE_TOOLS_REBUILD)=' | sort
  echo '---FUNCTIONS---'; print -l \${(ok)functions} | sed -E 's/_zsh_highlight_widget_orig-s000-r[0-9]+-/_zsh_highlight_widget_orig-sXXX-rNNN-/'
  echo '---ALIASES---'; alias | sort
  echo '---PATH---'; echo "\$PATH" | tr ':' '\n' | grep -v fnm_multishells
  echo '---FPATH---'; print -l \$fpath
} | sed "s#${root_marker}#@ROOT@#g" > ${(qq)out}
RC
"${clean_env[@]}" "${extra_env[@]}" ZDOTDIR="$zdotdir" script -q /dev/null zsh -ic exit </dev/null 2>&1 \
  | tr -d '\r' | sed -E 's/\x1b\[[0-9;]*m//g; s/\x1b\]1337;[^\x07\x1b]*//g' | grep -a 'chitin:' | grep -v 'initializing chitin'
print "state written to $out ($(wc -l < "$out" | tr -d ' ') lines)"
