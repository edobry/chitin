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

function initJq() {
    # we need at least jq to bootstrap
    if ! checkCommand jq; then
        chiBail "jq not installed!" && return 1
    fi

    # bring in jq chains
    source $CHI_DIR/chains/json.sh
}

function chiLoadConfig() {
    # load meta chain
    source $CHI_DIR/chains/meta.sh

    local configLocation=$(chiGetConfigLocation)

    local json5ConfigFileName="config.json5"
    local json5ConfigFilePath="$configLocation/$json5ConfigFileName"

    if [[ ! -f $json5ConfigFilePath ]]; then
        chiLog "initializing config file at '$json5ConfigFilePath'"
        mkdir -p $configLocation
        cp $CHI_DIR/$json5ConfigFileName $json5ConfigFilePath
        chiLog "please complete the initialization by running chiModifyConfig"
    fi

    local configFile
    configFile=$(json5Convert $json5ConfigFilePath)
    [[ $? -eq 0 ]] || return 1

    local configFileContents=$(chiReadConfigFile)
    local inlineConfig=$([[ -z "$1" ]] && echo '{}' || echo "$1")

    # echo "file config: $configFileContents"
    # echo "inline config: $inlineConfig"

    local mergedConfig=$(jsonMergeDeep "$configFileContents" "$inlineConfig")
    # echo "merged config: $mergedConfig"

    export CHI_CONFIG="$mergedConfig"

    local dotfilesDir=$(chiReadConfig '.dotfilesDir // empty')
    export CHI_DOTFILES_DIR=$dotfilesDir

    local projectDir=$(chiReadConfig '.projectDir // empty')
    export CHI_PROJECT_DIR=$projectDir
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

    initJq
    chiLoadConfig "$1"

    # set -x
    if [[ -z "$IS_DOCKER" ]]; then
        chiFiberReadDependencies $CHI_DIR core
        chiFiberCheckDependencies $CHI_DIR core
        chiChainCheckTools core init || (chiBail; return 1)
    fi
    # set +x
    # set -x

    # load chains
    chiFiberLoad $CHI_DIR

    # load dotfiles
    if [[ ! -z "$CHI_DOTFILES_DIR" ]]; then
        chiFiberLoad $CHI_DOTFILES_DIR dotfiles
    fi

    chiFiberLoadExternal

    export CHI_ENV_INITIALIZED=true

    if [[ -z "$CHI_FAIL_ON_ERROR" ]]; then
        set +e
    fi

    chiRunInitCommand
}

function chiRunInitCommand() {
    local initCommand
    initCommand=$(chiReadChainConfigField init command)
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
