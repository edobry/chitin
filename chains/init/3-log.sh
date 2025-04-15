if [[ -z "$CHI_LOG_LEVEL" ]]; then
    export CHI_LOG_LEVEL=INFO
fi
export CHI_LOG_LEVEL_INFO=1
export CHI_LOG_LEVEL_DEBUG=2
export CHI_LOG_LEVEL_TRACE=3

function chiLogGetLevel() {
    # requireArgOptions "a known log level" "$1" INFO DEBUG TRACE || return 1

    chiReadDynamicVariable "CHI_LOG_LEVEL_${1}"
}

export CHI_LOG_IS_DEBUG=$([[ "$(chiLogGetLevel "$CHI_LOG_LEVEL")" -ge "$CHI_LOG_LEVEL_DEBUG" ]] && echo true || echo false)

export CHI_LOG_TIME="/tmp/chitin-prev-time-$(randomString 10)"
function chiLog() {
    requireArg "a log level" "$1" || return 1
    requireArg "a message" "$2" || return 1

    local logLevel="$(chiLogGetLevel "$1")"; shift
    local message="$1"; shift
  
    local currentLogLevel="$(chiLogGetLevel "$CHI_LOG_LEVEL")"
    [[ "$logLevel" -le $currentLogLevel ]] || return 0

    local msg="$(joinWith ':' chitin $@) - $message"

    if $CHI_LOG_IS_DEBUG; then
        local currentTime="$(gdate +%s%N)"
        local delta=$([[ -f "$CHI_LOG_TIME" ]] && echo $(( (currentTime - $(cat "$CHI_LOG_TIME")) / 1000000 )) || echo "0")
        echo "$currentTime" > "$CHI_LOG_TIME"
        
        msg="[$delta ms] $msg"
    fi

    echo "$msg" >&2
}

function chiLogInfo() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local message="$1"; shift

    chiLog INFO "$message" $@
}

function chiLogGreen() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local message="$1"; shift

    chiLogInfo "$(chiColorGreen "$message")" $@
}

function chiLogDebug() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local message="$1"; shift

    chiLog DEBUG "$message" $@
}

function chiLogTrace() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local message="$1"; shift

    chiLog TRACE "$message" $@
}

function chiLogError() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local message="$1"; shift

    chiLogInfo "$(chiColorRed "$message")" $@
}

function chiBail() {
    chiLogError "${1:-"something went wrong"}!"
    chiLogError "exiting!"

    return 1
}
