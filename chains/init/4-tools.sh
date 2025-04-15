BREWPATH="/opt/homebrew/bin/brew"
[[ -f "$BREWPATH" ]] && eval "$($BREWPATH shellenv)"

export CHI_SHARE="$(chiExpandPath "localshare/chitin")"
export CHI_TOOLS_BIN="$CHI_SHARE/bin"
export CHI_INIT_TEMP_DIR="/tmp/chitin-install"

function chiToolsInstallTemporary() {
    requireArg "a tool name" "$1" || return 1
    requireArg "a version" "$2" || return 1
    requireArg "a url" "$3" || return 1

    local toolName="$1"
    local version="$2"
    local url="$(chiUrlExpand "$2" "$3") "

    chiLogInfo "installing '$toolName' temporarily..." init tools
    chiToolsInstallExecutableFromUrl "$toolName" "$url" "$CHI_INIT_TEMP_DIR"
    
    if ! checkCommand "$toolName"; then
        chiBail "something went wrong installing '$toolName'" init tools
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

    chiLogGreen "Installing '$toolName' from '$url' to '$installPath'..." init tools

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
