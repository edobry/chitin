#!/usr/bin/env bash

if [[ -z "$IS_DOCKER" ]]; then
    SOURCE_DIR="$(dirname -- "$0")"
    # echo "source dir: $SOURCE_DIR"
    # echo "0: $0"
    # echo "bash source: $BASH_SOURCE"

    if [ ! -z ${BASH_SOURCE[0]} ]; then
        SCRIPT_PATH="${BASH_SOURCE[0]}"
    else
        SCRIPT_PATH="$SOURCE_DIR/init.sh"
    fi

    export CHI_DIR="$(dirname $SCRIPT_PATH)"
fi

function chiLoadDir() {
    for file in "$@"; do
        source "$file"
    done
}

function autoinitChi() {
    if [[ ! -z "$CHI_FAIL_ON_ERROR" ]]; then
        set -e
    fi

    if [[ -z "$ZSH_VERSION" ]]; then
        shopt -s globstar
    else
        setopt ksh_glob
        setopt shwordsplit
    fi
    set -o pipefail

    [[ "$CHI_AUTOINIT_DISABLED" = "true" ]] || chiShell
}

function chiShell() {
    local startTime=$(date +%s)
    # reset envvars if reloading, besides CHI_DIR and CHI_LOG_LEVEL
    if [[ ! -z "$CHI_ENV_INITIALIZED" ]]; then
        local chiDir=$CHI_DIR
        local chiLogLevel=$CHI_LOG_LEVEL
        unset $(env | grep "^CHI_" | sed 's/=.*//')
        export CHI_DIR=$chiDir
        export CHI_LOG_LEVEL=$chiLogLevel
    fi

    # load init chain
    chiLoadDir $CHI_DIR/chains/init/**/*.sh
    chiLogInfo "initializing chitin..." init

    # load meta chain
    chiLoadDir $CHI_DIR/chains/meta/**/*.sh
    chiConfigUserLoad "$1"

    if [[ -z "$IS_DOCKER" ]]; then
        local checkTools="$(chiConfigUserRead core checkTools)"

        if [[ "$checkTools" != "false" ]]; then
            export CHI_TOOLS_CHECK_ENABLED="true"

            if ! chiToolsLoadFromCache; then
                chiLogInfo "tools status cache not found, rebuilding..." meta tools
                export CHI_CACHE_TOOLS_REBUILD=true
            fi
        fi
    fi

    # load core chains
    chiFiberLoad "$CHI_DIR" "core" "$isNoCheck"

    # load dotfiles
    if [[ -n "$CHI_DOTFILES_DIR" ]]; then
        chiFiberLoad "$CHI_DOTFILES_DIR" dotfiles "$isNoCheck"
    fi
    
    chiFiberLoadExternal "$isNoCheck"
    
    export CHI_ENV_INITIALIZED=true
    unset CHI_CACHE_TOOLS_REBUILD

    if [[ -z "$CHI_FAIL_ON_ERROR" ]]; then
        set +e
    fi

    chiRunInitCommand

    if [[ -d "$CHI_INIT_TEMP_DIR" ]]; then
        chiLogInfo "cleaning up bootstrap deps" init
        
        chiToolsRemoveDirFromPath "$CHI_INIT_TEMP_DIR"
        rm -rf "$CHI_INIT_TEMP_DIR"
    fi

    local endTime=$(gdate +%s)
    local duration=$((endTime - startTime))
    chiLogGreen "initialized in $duration seconds" init

    if [[ -f "$CHI_LOG_TIME" ]]; then
        rm "$CHI_LOG_TIME"
    fi
}

function chiShellDebug() {
    CHI_LOG_LEVEL=DEBUG chiShell
}

function chiRunInitCommand() {
    local initCommand
    initCommand="$(chiConfigUserRead core init command)"
    if [[ $? -eq 0 ]]; then
        $initCommand
    fi

    # echo "initcommand: $initCommand"
    # [[ -z "$initCommand" ]] && return 0
}

autoinitChi
