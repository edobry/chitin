BREWPATH="/opt/homebrew/bin/brew"
[[ -f "$BREWPATH" ]] && eval "$($BREWPATH shellenv)"

function chiInitBootstrapModule() {
    echo "init:bootstrap"
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
    source $CHI_DIR/chains/json.sh
}

function chiToolsAddDirToPath() {
    requireDirectoryArg "directory" "$1" || return 1

    # check if the PATH already contains the dir
    [[ ":$PATH:" == *":$1:"* ]] && return 0

    export PATH="$1:$PATH"
}

function chiToolsRemoveDirFromPath() {
    requireDirectoryArg "directory" "$1" || return 1

    export PATH=$(showPath | grep -v "$1" | newlinesToChar ':')
}

export CHI_TOOLS_BIN="$(expandPath "localshare/chitin/bin")"
mkdir -p "$CHI_TOOLS_BIN"
chiToolsAddDirToPath "$CHI_TOOLS_BIN"

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
    local url=$(chiUrlExpand "$2" "$3") 

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

    mkdir -p "$installDir"
    local installPath="$installDir/$fileName"

    if [[ $(fileGetExtension "$url") == "zip" ]]; then
        local tempDir=$(tempFile)
        mkdir -p "$tempDir"

        local archiveName=$(basename "$url")
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

    local installPath=$(chiToolsInstallFromUrl "$@")
    chmod +x "$installPath"

    chiToolsAddDirToPath "$3"
}
