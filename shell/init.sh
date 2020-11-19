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

function checkDep() {
    local depName=$(readJSON "$1" '.key')
    local expectedVersion=$(readJSON "$1" '.value.version')
    local versionCommand=$(readJSON "$1" '.value.command')

    if ! checkCommand "$depName"; then
        echo "dataeng-tools - $depName not installed!"
        return 1
    fi

    local currentVersion=$(eval "$versionCommand")

    if ! checkVersion "$expectedVersion" "$currentVersion" ]]; then
        echo "dataeng-tools - invalid $depName version: >=$expectedVersion expected, $currentVersion found!"
        return 1
    fi
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
        checkDep "$dep" || return 1
    done
}

function readConfig() {
    local jsonFileName="config.json"
    local json5FileName="${jsonFileName}5"

    # if we have json5 use it to spit out json, otherwise, poor-mans
    if ! checkCommand json5; then
        sed '/\/\//d' $CA_DT_DIR/$json5FileName > $jsonFileName
    else
        json5 -c $CA_DT_DIR/$json5FileName
    fi

    local config=$(readJSONFile $CA_DT_DIR/$jsonFileName)

    local projectDir=$(readJSON "$config" '.projectDir')
    [[ -z $CA_PROJECT_DIR ]] && export CA_PROJECT_DIR=$projectDir

    local awsAuthEnabled=$(readJSON "$config" '.modules."aws-auth".enabled')
    [[ -z $CA_DT_AWS_AUTH_ENABLED ]] && export CA_DT_AWS_AUTH_ENABLED=$awsAuthEnabled

    local googleUsername=$(readJSON "$config" '.modules."aws-auth".googleUsername')
    [[ -z $CA_GOOGLE_USERNAME ]] && export CA_GOOGLE_USERNAME=$googleUsername

    local departmentRole=$(readJSON "$config" '.modules."aws-auth".departmentRole')
    [[ -z $CA_DEPT_ROLE ]] && export CA_DEPT_ROLE=$departmentRole

    local k8sEnvEnabled=$(readJSON "$config" '.modules."k8s-env".enabled')
    [[ -z $CA_DT_K8S_CONFIG_ENABLED ]] && export CA_DT_K8S_CONFIG_ENABLED=$k8sEnvEnabled
}

function init() {
    # load init scripts
    loadDir $CA_DT_DIR/helpers/init/*.sh

    if [[ -z "$IS_DOCKER" ]] && ! checkDeps; then
        echo "dataeng-tools - exiting!"
        return 1
    fi

    readConfig

    export CA_DP_DIR=$CA_PROJECT_DIR/dataeng-pipeline

    # load helpers
    loadDir $CA_DT_DIR/helpers/*.sh

    # zsh completions only loaded on zsh shells
    if [ -n "$ZSH_VERSION" ]; then
        loadDir $CA_DT_DIR/helpers/*.zsh
    fi
}

init
