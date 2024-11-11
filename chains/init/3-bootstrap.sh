checkCommand brew && eval "$(/opt/homebrew/bin/brew shellenv)"

function chiInitBootstrapDeps() {
    # we need jq to bootstrap
    if ! checkCommand jq; then
        chiLog "dep 'jq' missing!" "init:bootstrap"

        chiToolsInstallJqTemporary
    fi
    
    # we need yq to bootstrap
    if ! checkCommand yq; then
        chiLog "dep 'yq' missing!" "init:bootstrap"

        chiToolsInstallYqTemporary
    fi

    # bring in json chain
    source $CHI_DIR/chains/json.sh
}

function chiToolsAddDirToPath() {
    requireDirectoryArg "temporary directory" "$1" || return 1

    export PATH="$1:$PATH"
}

function chiToolsRemoveDirFromPath() {
    requireDirectoryArg "temporary directory" "$1" || return 1

    export PATH=$(echo "$PATH" | splitOnChar ':' | grep -v "$1" | newlinesToChar ':')
}

export CHITIN_INIT_TEMP_DIR="/tmp/chitin-install"

function chiToolsInstallJqTemporary() {
    local jqVersion="1.6"
    local jqUrl="https://github.com/stedolan/jq/releases/download/jq-$jqVersion/jq-osx-amd64"

    chiToolsInstallTemporary "$jqUrl" "jq"
}

function chiToolsInstallYqTemporary() {
    local yqVersion="4.44.3"
    local yqUrl="https://github.com/mikefarah/yq/releases/download/v$yqVersion/yq_darwin_amd64"

    chiToolsInstallTemporary "$yqUrl" "yq"
}

function chiToolsInstallTemporary() {
    requireArg "a url" "$1" || return 1
    requireArg "a tool name" "$2" || return 1

    chiLog "installing '$2' temporarily" "init:bootstrap"

    mkdir -p "$CHITIN_INIT_TEMP_DIR"

    chiToolsInstallFromUrl "$CHITIN_INIT_TEMP_DIR" "$1" "$2"
}

function chiToolsInstallFromUrl() {
    requireDirectoryArg "an installation" "$1" || return 1
    requireArg "an artifact url" "$2" || return 1
    requireArg "a tool name" "$3" || return 1

    local installDir="$1"
    local url="$2"
    local name="$3"

    local installPath="$installDir/$name"

    curl -sL "$url" -o "$installPath"
    chmod +x "$installPath"

    chiToolsAddDirToPath "$installDir"

    if ! checkCommand "$name"; then
        chiBail "something went wrong installing '$name'!" "init"
        return 1
    fi
}
