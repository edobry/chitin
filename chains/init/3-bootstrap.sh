BREWPATH="/opt/homebrew/bin/brew"
[[ -f "$BREWPATH" ]] && eval "$($BREWPATH shellenv)"

function chiInitBootstrapModule() {
    echo "init:bootstrap"
}

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
    requireArg "a message" "$1" || return 1
  
    local logLevel="$(chiLogGetLevel "${3:-INFO}")"
    local currentLogLevel="$(chiLogGetLevel "$CHI_LOG_LEVEL")"
    [[ "$logLevel" -le $currentLogLevel ]] || return 0

    local msg="chitin${2:+:}${2} - $1"

    if $CHI_LOG_IS_DEBUG; then
        local currentTime="$(gdate +%s%N)"
        local delta=$([[ -f "$CHI_LOG_TIME" ]] && echo $(( (currentTime - $(cat "$CHI_LOG_TIME")) / 1000000 )) || echo "0")
        echo "$currentTime" > "$CHI_LOG_TIME"
        
        msg="[$delta ms] $msg"
    fi

    echo "$msg" >&2
}

function chiLogDebug() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    chiLog "$1" "$2" DEBUG
}

function chiLogTrace() {
    requireArg "a message" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    chiLog "$1" "$2" TRACE
}

function chiBail() {
    chiLog "$(chiColorRed "${1:-"something went wrong"}!")"
    chiLog "$(chiColorRed "exiting!")"
    return 1
}

function chiInitBootstrapDeps() {
    # we need jq to bootstrap
    if ! checkCommand jq; then
        chiLog "dep 'jq' missing!" "$(chiInitBootstrapModule)"

        chiToolsInstallJqTemporary
    fi
    
    # we need yq to bootstrap
    if ! checkCommand yq; then
        chiLog "dep 'yq' missing!" "$(chiInitBootstrapModule)"

        chiToolsInstallYqTemporary
    fi

    # bring in json chain
    source "$CHI_DIR/chains/json.sh"
}

export CHI_SHARE="$(chiExpandPath "localshare/chitin")"
export CHI_TOOLS_BIN="$CHI_SHARE/bin"
export CHI_INIT_TEMP_DIR="/tmp/chitin-install"

function chiToolsInstallJqTemporary() {
    local jqVersion="1.7.1"
    local jqUrl="https://github.com/jqlang/jq/releases/download/jq-{{version}}/jq-macos-arm64"
    
    chiToolsInstallTemporary "jq" "$jqVersion" "$jqUrl"
}

function chiToolsInstallYqTemporary() {
    local yqVersion="4.44.3"
    local yqUrl="https://github.com/mikefarah/yq/releases/download/v{{version}}/yq_darwin_arm64"

    chiToolsInstallTemporary "yq" "$yqVersion" "$yqUrl"
}

function chiToolsInstallTemporary() {
    requireArg "a tool name" "$1" || return 1
    requireArg "a version" "$2" || return 1
    requireArg "a url" "$3" || return 1

    local toolName="$1"
    local version="$2"
    local url="$(chiUrlExpand "$2" "$3") "

    chiLog "installing '$toolName' temporarily..." "$(chiInitBootstrapModule)"
    chiToolsInstallExecutableFromUrl "$toolName" "$url" "$CHI_INIT_TEMP_DIR"
    
    if ! checkCommand "$toolName"; then
        chiBail "something went wrong installing '$toolName'" "$(chiInitBootstrapModule)"
        return 1
    fi
}

function chiToolsInstallFromUrl() {
    requireArg "a tool name" "$1" || return 1
    requireArg "an artifact url" "$2" || return 1
    requireArg "an install directory" "$3" || return 1

    local toolName="$1"
    local url="$2"
    local installDir="$3"
    local fileName="${4:-$toolName}"

    local installPath="$installDir/$fileName"

    GREEN="$(tput setaf 2)"
    NC="$(tput sgr0)"

    chiLog "${GREEN}==>${NC} Installing '$toolName' from '$url' to '$installPath'..." "$1"

    mkdir -p "$installDir"

    if [[ $(fileGetExtension "$url") == "zip" ]]; then
        local tempDir="$(tempFile)"
        mkdir -p "$tempDir"

        local archiveName="$(basename "$url")"
        curl -sLo "$tempDir/$archiveName" "$url"

        local archiveDir="$tempDir/${archiveName%.zip}"
        unzip -q "$tempDir/$archiveName" -d "$archiveDir"

        mv "$archiveDir/$toolName" "$installPath"
    else
        curl -sLo "$installPath" "$url"
    fi

    echo "$installPath"
}

function chiToolsInstallExecutableFromUrl() {
    requireArg "a tool name" "$1" || return 1
    requireArg "an artifact url" "$2" || return 1
    requireArg "an install directory" "$3" || return 1

    local installPath="$(chiToolsInstallFromUrl "$@")"
    chmod +x "$installPath"

    chiToolsAddDirToPath "$3"
}
