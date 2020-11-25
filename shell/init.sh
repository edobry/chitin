#!/usr/bin/env bash

[[ -z "$CA_DT_DEBUG" ]] || set -x

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

function dtLog() {
    echo "dataeng-tools - $1"
}

function loadDir() {
    for f in "$@";
        do source $f;
    done
}

function checkDep() {
    local depName=$(readJSON "$1" '.key')
    local expectedVersion=$(readJSON "$1" '.value.version')
    local versionCommand=$(readJSON "$1" '.value.command')

    if ! checkCommand "$depName"; then
        dtLog "$depName not installed!"
        return 1
    fi

    local currentVersion=$(eval "$versionCommand")

    if ! checkVersion "$expectedVersion" "$currentVersion" ]]; then
        dtLog "invalid $depName version: >=$expectedVersion expected, $currentVersion found!"
        return 1
    fi
}

function initJq() {
    # we need at least jq to bootstrap
    if ! checkCommand jq; then
        dtLog "jq not installed!"
        return 1
    fi

    # bring in jq helpers
    source $CA_DT_DIR/helpers/json.sh
}

export CA_DT_CONFIG_FILE="config.json"

function readConfig() {
    local json5FileName="${CA_DT_CONFIG_FILE}5"

    # if we have json5 use it to spit out json, otherwise, poor-mans
    if ! checkCommand json5; then
        sed '/\/\//d' $CA_DT_DIR/$json5FileName > $CA_DT_CONFIG_FILE
    else
        json5 -c $CA_DT_DIR/$json5FileName
    fi

    export CA_DT_CONFIG=$(readJSONFile $CA_DT_DIR/$CA_DT_CONFIG_FILE)

    local projectDir=$(readJSON "$CA_DT_CONFIG" '.projectDir')
    [[ -z $CA_PROJECT_DIR ]] && export CA_PROJECT_DIR=$projectDir

    local awsAuthEnabled=$(readJSON "$CA_DT_CONFIG" '.modules."aws-auth".enabled')
    [[ -z $CA_DT_AWS_AUTH_ENABLED ]] && export CA_DT_AWS_AUTH_ENABLED=$awsAuthEnabled

    local googleUsername=$(readJSON "$CA_DT_CONFIG" '.modules."aws-auth".googleUsername')
    [[ -z $CA_GOOGLE_USERNAME ]] && export CA_GOOGLE_USERNAME=$googleUsername

    local departmentRole=$(readJSON "$CA_DT_CONFIG" '.modules."aws-auth".departmentRole')
    [[ -z $CA_DEPT_ROLE ]] && export CA_DEPT_ROLE=$departmentRole

    local k8sEnvEnabled=$(readJSON "$CA_DT_CONFIG" '.modules."k8s-env".enabled')
    [[ -z $CA_DT_K8S_CONFIG_ENABLED ]] && export CA_DT_K8S_CONFIG_ENABLED=$k8sEnvEnabled
}

function checkDeps() {
    readJSON "$CA_DT_CONFIG" '.dependencies | to_entries[]' | \
    while read -r dep; do
        checkDep "$dep" || return 1
    done
}

function init() {
    # load init scripts
    loadDir $CA_DT_DIR/helpers/init/*.sh

    initJq
    readConfig

    if [[ -z "$IS_DOCKER" ]] && ! checkDeps; then
        dtLog "exiting!"
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
