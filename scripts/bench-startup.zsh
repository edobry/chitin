#!/usr/bin/env zsh
# bench-startup.zsh - measure interactive zsh startup with chitin loaded.
#
# Why this exists: ~/.zshenv sets LITE_MODE for any non-TTY or IDE shell and
# ~/.zshrc returns before chitin loads, so `time zsh -i -c exit` reports ~0.03s
# and hides the real cost. This script runs each shell under a pseudo-terminal
# with that guard bypassed, so the number is what a new terminal tab pays.
#
# Usage:
#   scripts/bench-startup.zsh [--runs N] [--init PATH] [--profile] [--trace] [--quiet]
#
#   --runs N     startups to time (default 3)
#   --init PATH  load this init.sh through a scratch ZDOTDIR instead of ~/.zshrc,
#                to measure a checkout other than ~/Projects/chitin (for example
#                a Minsky session clone). PATH setup still comes from ~/.zshenv.
#   --profile    one extra run printing zprof's top 25 functions by self time
#   --trace      one extra xtrace run printing the slowest call sites and a
#                count of external commands (needs python3)
#   --quiet      print only the summary line
#
# CHI_* variables inherited from the calling shell are stripped so every run is
# a genuine startup rather than a reload.

emulate -L zsh
setopt pipe_fail
zmodload zsh/datetime

typeset -i runs=3 do_profile=0 do_trace=0 quiet=0
typeset init_path=''

while (( $# )); do
  case $1 in
    --runs) runs=$2; shift 2 ;;
    --init) init_path=${2:A}; shift 2 ;;
    --profile) do_profile=1; shift ;;
    --trace) do_trace=1; shift ;;
    --quiet) quiet=1; shift ;;
    -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) print -u2 "unknown argument: $1"; exit 2 ;;
  esac
done
(( runs > 0 )) || { print -u2 "--runs must be positive"; exit 2 }

# Bypass the lite-mode guard and drop inherited chitin state. The guard in
# ~/.zshenv fires when stdin is not a TTY, when VSCODE_PID is set, or when
# TERM_PROGRAM is vscode, cursor or zed; a pty plus these overrides clears all
# three. env(1) stops parsing options at the first NAME=VALUE, so every -u must
# come before them.
typeset -a clean_env
clean_env=(env -u LITE_MODE -u VSCODE_PID)
typeset v
for v in ${(k)parameters[(I)CHI_*]}; do clean_env+=(-u "$v"); done
clean_env+=(TERM_PROGRAM=iTerm.app)

# With --init, a scratch ZDOTDIR whose .zshrc loads only that init.sh.
typeset zdotdir='' target_label='~/.zshrc'
if [[ -n $init_path ]]; then
  [[ -f $init_path ]] || { print -u2 "no such file: $init_path"; exit 2 }
  zdotdir=$(mktemp -d "${TMPDIR:-/tmp}/chitin-bench.XXXXXX")
  print -r -- '[[ -f ~/.zshenv ]] && source ~/.zshenv' > "$zdotdir/.zshenv"
  print -r -- 'zmodload zsh/zprof' > "$zdotdir/.zshrc"
  print -r -- "source ${(qq)init_path}" >> "$zdotdir/.zshrc"
  clean_env+=(ZDOTDIR="$zdotdir")
  target_label=$init_path
  trap 'rm -rf "$zdotdir"' EXIT
fi

# run_shell CMD - an interactive zsh under a pty running CMD; output on stdout.
# This is the BSD/macOS form of script(1); util-linux wants `script -q -c CMD /dev/null`.
run_shell() {
  "${clean_env[@]}" script -q /dev/null zsh -ic "$1" </dev/null 2>&1 | tr -d '\r'
}

typeset -a samples
typeset -F start elapsed
typeset first_output=''
typeset i
for (( i = 1; i <= runs; i++ )); do
  start=$EPOCHREALTIME
  if (( i == 1 )); then
    first_output=$(run_shell exit)
  else
    run_shell exit >/dev/null
  fi
  elapsed=$(( EPOCHREALTIME - start ))
  if (( i == 1 && elapsed < 0.05 )); then
    print -u2 "run finished in ${elapsed}s: the shell did not start. Output was:"
    print -u2 -r -- "$first_output"
    exit 1
  fi
  samples+=("$elapsed")
  (( quiet )) || printf 'run %d: %.2fs\n' "$i" "$elapsed"
done

typeset -a sorted
sorted=(${(on)samples})
typeset -F mn=${sorted[1]} mx=${sorted[-1]} md
if (( runs % 2 )); then
  md=${sorted[(runs + 1) / 2]}
else
  md=$(( (sorted[runs / 2] + sorted[runs / 2 + 1]) / 2.0 ))
fi
printf 'chitin startup: min %.2fs  median %.2fs  max %.2fs  (%d runs, target %s)\n' \
  "$mn" "$md" "$mx" "$runs" "$target_label"

if (( ! quiet )); then
  typeset reported
  reported=$(print -r -- "$first_output" | grep -o 'initialized in [0-9]* seconds' | tail -1)
  [[ -n $reported ]] && print "chitin reported: $reported"
fi

if (( do_profile )); then
  print
  print '=== zprof: top 20 by self time (ms) ==='
  run_shell zprof | sed -n '/^num  calls/,$p' | head -22
fi

if (( do_trace )); then
  command -v python3 >/dev/null || { print -u2 "--trace needs python3"; exit 1 }
  typeset tracefile
  tracefile=$(mktemp "${TMPDIR:-/tmp}/chitin-trace.XXXXXX")
  "${clean_env[@]}" PS4='+%D{%s.%.} %N:%i> ' script -q /dev/null zsh -xic exit </dev/null >"$tracefile" 2>&1
  print
  print '=== xtrace: slowest call sites and external commands ==='
  python3 - "$tracefile" <<'PY'
import collections, re, sys
pat = re.compile(r'^\++(\d+\.\d+) (\S+?):(\d+)> (.*)')
events = []
for line in open(sys.argv[1], errors='replace'):
    m = pat.match(line.rstrip('\n').replace('\r', ''))
    if m:
        events.append((float(m.group(1)), m.group(2), m.group(3), m.group(4)[:80]))
if len(events) < 2:
    print('no trace events parsed'); sys.exit(0)
print(f'{len(events)} traced commands over {events[-1][0] - events[0][0]:.2f}s')
gaps = [(events[i + 1][0] - events[i][0], events[i]) for i in range(len(events) - 1)]
by_site = collections.Counter(); calls = collections.Counter()
for g, e in gaps:
    key = (e[1], e[2], e[3][:60]); by_site[key] += g; calls[key] += 1
print('\ntop 15 call sites by cumulative time:')
for k, t in by_site.most_common(15):
    print(f'  {t:6.2f}s  x{calls[k]:<5} {k[0]}:{k[1]}  {k[2]}')
by_fn = collections.Counter()
for g, e in gaps:
    by_fn[e[1]] += g
print('\ntop 10 functions by cumulative time:')
for k, t in by_fn.most_common(10):
    print(f'  {t:6.2f}s  {k}')
external = ('sed', 'jq', 'yq', 'envsubst', 'paste', 'find', 'basename', 'dirname', 'cat',
            'grep', 'cut', 'tr', 'awk', 'date', 'gdate', 'mktemp', 'git', 'brew', 'env')
counts = collections.Counter()
for _, _, _, cmd in events:
    w = cmd.split()
    if w and w[0] in external:
        counts[w[0]] += 1
print(f'\nexternal commands ({sum(counts.values())} total):')
for k, n in counts.most_common(12):
    print(f'  {n:5}  {k}')
PY
  rm -f "$tracefile"
fi
