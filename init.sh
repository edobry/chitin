#!/usr/bin/env bash

if [[ -z "$IS_DOCKER" ]]; then
    SOURCE_DIR=$(dirname -- "$0")
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

function chiLog() {
    requireArg "a message" "$1" || return 1

    echo "chitin${2:+:}${2} - $1"
}

function chiBail() {
    chiLog "${1:-"something went wrong"}!"
    chiLog "exiting!"
    return 1
}

function chiLoadDir() {
    for file in "$@"; do
        source $file;
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
    # reset envvars if reloading, besides $CHI_DIR
    if [[ ! -z "$CHI_ENV_INITIALIZED" ]]; then
        local chiDir=$CHI_DIR
        unset $(env | grep "^CHI_" | sed 's/=.*//')
        export CHI_DIR=$chiDir
    fi

    # load init scripts
    chiLoadDir $CHI_DIR/chains/init/**/*.sh

    chiInitBootstrapDeps

    # load meta chain
    chiLoadDir $CHI_DIR/chains/meta/**/*.sh
    chiConfigUserLoad "$1"
    chiColorInit

    if [[ -z "$IS_DOCKER" ]]; then
        chiModuleConfigRead "$CHI_DIR" "core"
        chiDependenciesCheckModuleTools "core"
    fi

    # load chains
    chiFiberLoad "$CHI_DIR"

    # load dotfiles
    if [[ ! -z "$CHI_DOTFILES_DIR" ]]; then
        chiFiberLoad "$CHI_DOTFILES_DIR" dotfiles
    fi
    
    chiFiberLoadExternal
    
    export CHI_ENV_INITIALIZED=true

    if [[ -z "$CHI_FAIL_ON_ERROR" ]]; then
        set +e
    fi

    chiRunInitCommand

    if [[ -d "$CHITIN_INIT_TEMP_DIR" ]]; then
        chiLog "cleaning up bootstrap deps" "init"
        
        chiToolsRemoveDirFromPath "$CHITIN_INIT_TEMP_DIR"
        rm -rf "$CHITIN_INIT_TEMP_DIR"
    fi
}

function chiRunInitCommand() {
    local initCommand
    initCommand=$(chiConfigChainReadField init command)
    if [[ $? -eq 0 ]]; then
        $initCommand
    fi

    # echo "initcommand: $initCommand"
    # [[ -z "$initCommand" ]] && return 0
}

function chiReinit() {
    source $CHI_DIR/init.sh
}

autoinitChi
