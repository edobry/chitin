#!/usr/bin/env bash

if [[ -z "$IS_DOCKER" ]]; then
    SOURCE_DIR=$(dirname -- "$0")

    if [[ "$0" = /* ]]; then
        SCRIPT_PATH="$0"
    elif [ ! -z ${BASH_SOURCE[0]} ]; then
        SCRIPT_PATH="${BASH_SOURCE[0]}"
    else
        SCRIPT_PATH="$SOURCE_DIR/init.sh"
    fi

    export CA_DT_DIR="$(dirname $SCRIPT_PATH)"
fi

function loadDir() {
    for f in "$@";
        do source $f;
    done
}

function checkDeps() {
    # we need at least jq to bootstrap
    if ! checkCommand jq; then
        echo "dataeng-tools - jq not installed!"
        return 1
    fi

    # bring in jq helpers
    source $CA_DT_DIR/helpers/json.sh

    local config=$(readJSONFile "$CA_DT_DIR/config.json")
    readJSON "$config" '.dependencies | to_entries[]' | \
    while read -r dep; do
        local depName=$(readJSON $dep '.key')
        local expectedVersion=$(readJSON $dep '.value.version')
        local versionCommand=$(readJSON $dep '.value.command')

        if ! checkCommand "$depName"; then
            echo "dataeng-tools - $depName not installed!"
            return 1
        fi

        local currentVersion=$(eval "$versionCommand")

        if ! checkVersion "$expectedVersion" "$currentVersion" ]]; then
            echo "dataeng-tools - invalid $depName version: >=$expectedVersion expected, $currentVersion found!"
            return 1
        fi
    done
}

function init() {
    # load init scripts
    loadDir $CA_DT_DIR/helpers/init/*.sh

    if [[ -z "$IS_DOCKER" ]] && ! checkDeps; then
        echo "dataeng-tools - exiting!"
        return 1
    fi

    export CA_DP_DIR=$CA_PROJECT_DIR/dataeng-pipeline

    # load helpers
    loadDir $CA_DT_DIR/helpers/*.sh

    # zsh completions only loaded on zsh shells
    if [ -n "$ZSH_VERSION" ]; then
        loadDir $CA_DT_DIR/helpers/*.zsh
    fi
}

init
