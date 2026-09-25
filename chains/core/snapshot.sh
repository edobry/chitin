# Startup snapshot cache.
#
# Loading fibers costs ~20 seconds per shell, almost all of it forks spent
# merging YAML config into CHI_* variables and wiring tool environments. That
# work is a pure function of a small set of files that rarely change, so after
# a full ("cold") load we persist its results and replay them on the next
# startup when none of its inputs changed. See README "Startup performance".
#
# Layout under $CHI_CACHE/snapshot/<encoded CHI_DIR>/:
#   stamp       one "kind|path|state" line per input, compared byte-for-byte
#               with a fresh computation on startup. kind f: mtime and size
#               matter (config files, directories whose listing matters);
#               kind e: only existence matters (files that get re-sourced
#               anyway, so their content is always fresh)
#   env.zsh     export lines for every CHI_* variable the cold load produced
#   replay.zsh  what the cold load did after the config step, in order: files
#               sourced, PATH dirs added, tool env exported, evalCommands run
#
# Escape hatches: CHI_SNAPSHOT_DISABLED=true forces a cold load and writes
# nothing; chiSnapshotClear deletes the snapshot; chiShellRebuild clears and
# reloads; chiSnapshotStatus says whether the snapshot is valid and, if not,
# which input changed.
#
# Known limits: replay re-sources chain files without the positional
# parameters chiLoadDir happened to have, and a new file inside a nested chain
# subdirectory is not detected until something else changes (run
# chiShellRebuild). zsh only: under bash every load is cold.

if [[ -n "$ZSH_VERSION" ]]; then
    zmodload -F zsh/stat b:zstat
    zmodload -F zsh/files b:zf_mkdir b:zf_mv b:zf_rm
    typeset -ga CHI_SNAPSHOT_INPUTS
fi

function chiSnapshotEnabled() {
    [[ -n "$ZSH_VERSION" ]] || return 1
    [[ "$CHI_SNAPSHOT_DISABLED" != "true" ]] || return 1
    return 0
}

# CHI_DIR is encoded into the path so two checkouts (~/Projects/chitin and a
# Minsky session clone, say) never share a snapshot
function chiSnapshotSetDir() {
    CHI_SNAPSHOT_DIR="$CHI_CACHE/snapshot/${CHI_DIR//\//_}"
}

# args: "kind|path" entries; result in REPLY, one line per entry, no trailing newline
function chiSnapshotStamp() {
    local entry kind path out=""
    local -A st

    for entry in "$@"; do
        kind="${entry%%|*}"
        path="${entry#*|}"

        if [[ "$kind" == "e" ]]; then
            if [[ -e "$path" ]]; then
                out+="e|$path|present"$'\n'
            else
                out+="e|$path|absent"$'\n'
            fi
        elif zstat -H st -- "$path" 2>/dev/null; then
            out+="f|$path|${st[mtime]}.${st[size]}"$'\n'
        else
            out+="f|$path|absent"$'\n'
        fi
    done

    REPLY="${out%$'\n'}"
}

# succeeds when a complete snapshot exists and every recorded input is unchanged.
# Sets CHI_SNAPSHOT_STATE to valid|stale|missing|disabled and, when stale,
# CHI_SNAPSHOT_STALE_PATH to the first input that changed.
function chiSnapshotIsValid() {
    CHI_SNAPSHOT_STATE="disabled"
    CHI_SNAPSHOT_STALE_PATH=""
    chiSnapshotEnabled || return 1

    chiSnapshotSetDir
    CHI_SNAPSHOT_STATE="missing"
    [[ -f "$CHI_SNAPSHOT_DIR/stamp" && -f "$CHI_SNAPSHOT_DIR/env.zsh" && -f "$CHI_SNAPSHOT_DIR/replay.zsh" ]] || return 1

    local stored="$(<"$CHI_SNAPSHOT_DIR/stamp")"
    [[ -n "$stored" ]] || return 1

    local -a inputs before after
    local line rest
    before=("${(@f)stored}")
    for line in "${before[@]}"; do
        rest="${line#*|}"
        inputs+=("${line%%|*}|${rest%%|*}")
    done

    chiSnapshotStamp "${inputs[@]}"
    if [[ "$REPLY" == "$stored" ]]; then
        CHI_SNAPSHOT_STATE="valid"
        return 0
    fi

    CHI_SNAPSHOT_STATE="stale"
    after=("${(@f)REPLY}")
    local i
    for (( i = 1; i <= ${#before}; i++ )); do
        if [[ "${before[i]}" != "${after[i]}" ]]; then
            rest="${after[i]#*|}"
            CHI_SNAPSHOT_STALE_PATH="${rest%%|*}"
            break
        fi
    done
    return 1
}

function chiSnapshotRestore() {
    source "$CHI_SNAPSHOT_DIR/env.zsh"
}

function chiSnapshotReplay() {
    source "$CHI_SNAPSHOT_DIR/replay.zsh"
}

# --- recording, active only during a cold load ---------------------------------

function chiSnapshotRecordBegin() {
    chiSnapshotEnabled || return 0

    chiSnapshotSetDir
    zf_mkdir -p "$CHI_SNAPSHOT_DIR" || return 0

    CHI_SNAPSHOT_INPUTS=()
    CHI_SNAPSHOT_RECORDING="$CHI_SNAPSHOT_DIR/replay.zsh.tmp"
    : > "$CHI_SNAPSHOT_RECORDING"

    chiSnapshotRecordInput f "$(chiConfigUserGetPath)"
    chiSnapshotRecordInput f "$CHI_CACHE_TOOLS"
}

# args: kind (f|e), path
function chiSnapshotRecordInput() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0

    local entry="$1|$2"
    (( ${CHI_SNAPSHOT_INPUTS[(Ie)$entry]} )) && return 0
    CHI_SNAPSHOT_INPUTS+=("$entry")
}

function chiSnapshotRecordLine() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0
    print -r -- "$1" >> "$CHI_SNAPSHOT_RECORDING"
}

# args: file [args passed to source]
function chiSnapshotRecordSource() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0
    chiSnapshotRecordInput e "$1"
    chiSnapshotRecordLine "source ${(qq)@}"
}

# args: already-expanded directory
function chiSnapshotRecordPath() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0
    chiSnapshotRecordLine "chiAddToPathVar PATH ${(qq)1}"
}

# args: name, value
function chiSnapshotRecordExport() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0
    chiSnapshotRecordLine "export ${1}=${(qq)2}"
}

# args: the evalCommand string as configured
function chiSnapshotRecordEval() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0
    chiSnapshotRecordLine "chiSnapshotEval ${(qq)1}"
}

# mirrors chiToolsLoad's `eval "$(eval $evalCommand)"`
function chiSnapshotEval() {
    eval "$(eval $1)"
}

function chiSnapshotRecordEnd() {
    [[ -n "$CHI_SNAPSHOT_RECORDING" ]] || return 0

    local recording="$CHI_SNAPSHOT_RECORDING"
    unset CHI_SNAPSHOT_RECORDING

    # every exported CHI_* variable except the ones that describe this shell
    # rather than the loaded configuration
    local name out=""
    local -a names
    for name in "${(@k)parameters}"; do
        [[ "$name" == CHI_* ]] || continue
        [[ "${parameters[$name]}" == *export* ]] || continue
        names+=("$name")
    done
    for name in "${(@o)names}"; do
        case "$name" in
            CHI_DIR|CHI_LOG_LEVEL|CHI_LOG_IS_DEBUG|CHI_LOG_TIME|CHI_ENV_INITIALIZED|\
            CHI_FAIL_ON_ERROR|CHI_AUTOINIT_DISABLED|CHI_TOOL_STATUS|CHI_TOOLS_CHECK_ENABLED|\
            CHI_CACHE_TOOLS_REBUILD|CHI_SNAPSHOT_*)
                continue ;;
        esac
        out+="export ${name}=${(qq)${(P)name}}"$'\n'
    done
    print -rn -- "$out" > "$CHI_SNAPSHOT_DIR/env.zsh.tmp"

    chiSnapshotStamp "${CHI_SNAPSHOT_INPUTS[@]}"
    print -rn -- "$REPLY" > "$CHI_SNAPSHOT_DIR/stamp.tmp"

    # stamp last, so a partial write can never validate
    zf_mv -f "$CHI_SNAPSHOT_DIR/env.zsh.tmp" "$CHI_SNAPSHOT_DIR/env.zsh"
    zf_mv -f "$recording" "$CHI_SNAPSHOT_DIR/replay.zsh"
    zf_mv -f "$CHI_SNAPSHOT_DIR/stamp.tmp" "$CHI_SNAPSHOT_DIR/stamp"

    CHI_SNAPSHOT_INPUTS=()
}

# --- user-facing ----------------------------------------------------------------

function chiSnapshotClear() {
    [[ -n "$ZSH_VERSION" ]] || return 0

    chiSnapshotSetDir
    [[ -d "$CHI_SNAPSHOT_DIR" ]] && zf_rm -rf "$CHI_SNAPSHOT_DIR"
    chiLogInfo "snapshot cleared" init snapshot
}

function chiShellRebuild() {
    chiSnapshotClear
    chiShell
}

function chiSnapshotStatus() {
    if [[ -z "$ZSH_VERSION" ]]; then
        echo "snapshot: unavailable under bash"
        return 1
    fi

    chiSnapshotSetDir
    echo "snapshot dir: $CHI_SNAPSHOT_DIR"

    chiSnapshotIsValid
    case "$CHI_SNAPSHOT_STATE" in
        disabled) echo "disabled via CHI_SNAPSHOT_DISABLED"; return 1 ;;
        missing) echo "no snapshot recorded yet; the next shell does a full load"; return 1 ;;
        stale) echo "stale: '$CHI_SNAPSHOT_STALE_PATH' changed; the next shell does a full load"; return 1 ;;
        valid) echo "valid: $(wc -l < "$CHI_SNAPSHOT_DIR/stamp" | tr -d ' ') inputs unchanged" ;;
    esac
}
