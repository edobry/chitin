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

    export CA_DT_DIR="$(dirname $(dirname $SCRIPT_PATH))"
fi

function dtLog() {
    echo "dataeng-tools - $1"
}

function dtBail() {
    dtLog "${1:-"something went wrong"}!"
    dtLog "exiting!"
    return 1
}

function loadDTDir() {
    for f in "$@"; do
        source $f;
    done
}

function checkDTDep() {
    local depName=$(jsonRead "$1" '.key')
    local expectedVersion=$(jsonRead "$1" '.value.version')
    local versionCommand=$(jsonRead "$1" '.value.command')

    if ! checkCommand "$depName"; then
        dtLog "$depName not installed!"
        return 1
    fi

    local currentVersion=$(eval "$versionCommand")

    checkVersionAndFail "$depName" "$expectedVersion" "$currentVersion" || return 1
}

function initJq() {
    # we need at least jq to bootstrap
    if ! checkCommand jq; then
        dtBail "jq not installed!" && return 1
    fi

    # bring in jq helpers
    source $CA_DT_DIR/shell/helpers/json.sh
}

function dtLoadConfig() {
    # load meta module
    source $CA_DT_DIR/shell/helpers/meta.sh

    local configLocation=$(dtGetConfigLocation)

    local json5ConfigFileName="config.json5"
    local json5ConfigFilePath="$configLocation/$json5ConfigFileName"

    if [[ ! -f $json5ConfigFilePath ]]; then
        dtLog "initializing config file at '$json5ConfigFilePath'"
        mkdir -p $configLocation
        cp $CA_DT_DIR/shell/$json5ConfigFileName $json5ConfigFilePath
        dtLog "please complete the initialization by running dtModifyConfig"
    fi

    local configFile
    configFile=$(json5Convert $json5ConfigFilePath)
    [[ $? -eq 0 ]] || return 1

    local configFileContents=$(dtReadConfigFile)
    local inlineConfig=$([[ -z "$1" ]] && echo '{}' || echo "$1")

    # echo "file config: $configFileContents"
    # echo "inline config: $inlineConfig"

    local mergedConfig=$(jsonMergeDeep "$configFileContents" "$inlineConfig")
    # echo "merged config: $mergedConfig"

    export CA_DT_CONFIG="$mergedConfig"

    local projectDir=$(jsonRead "$CA_DT_CONFIG" '.projectDir // empty')
    export CA_PROJECT_DIR=$projectDir

    local awsAuthEnabled=$(jsonRead "$CA_DT_CONFIG" '.modules."aws-auth".enabled // empty')
    export CA_DT_AWS_AUTH_ENABLED=$awsAuthEnabled

    local googleUsername=$(jsonRead "$CA_DT_CONFIG" '.modules."aws-auth".googleUsername // empty')
    export CA_GOOGLE_USERNAME=$googleUsername

    local departmentRole=$(jsonRead "$CA_DT_CONFIG" '.modules."aws-auth".departmentRole // empty')
    export CA_DEPT_ROLE=$departmentRole
}

function checkDTDeps() {
    local json5DepFilePath="$CA_DT_DIR/shell/dependencies.json5"

    local depFilePath
    depFilePath=$(json5Convert "$json5DepFilePath")
    [[ $? -eq 0 ]] || return 1

    jsonReadFile "$depFilePath" '.dependencies|to_entries[]' | \
    while read -r dep; do
        checkDTDep "$dep" || return 1
    done
}

function autoinitDT() {
    if [[ ! -z "$CA_FAIL_ON_ERROR" ]]; then
        set -e
    fi

    if [[ -z "$ZSH_VERSION" ]]; then
        shopt -s globstar
    else
        setopt ksh_glob
        setopt shwordsplit
    fi
    set -o pipefail

    [[ "$CA_DT_AUTOINIT_DISABLED" = "true" ]] || initDT
}

alias dtShell=initDT
function initDT() {
    # load init scripts
    loadDTDir $CA_DT_DIR/shell/helpers/init/**/*.sh

    initJq
    dtLoadConfig "$1"

    ([[ -z "$IS_DOCKER" ]] && ! checkDTDeps) && (dtBail; return 1)

    export CA_DP_DIR=$CA_PROJECT_DIR/dataeng-pipeline

    # load helpers
    loadDTDir $(ls $CA_DT_DIR/shell/helpers/**/*.sh | grep -v "/init")

    # zsh completions only loaded on zsh shells
    if [ -n "$ZSH_VERSION" ]; then
        loadDTDir $CA_DT_DIR/shell/helpers/**/*.zsh
    fi

    export CA_DT_ENV_INITIALIZED=true

    if [[ -z "$CA_FAIL_ON_ERROR" ]]; then
        set +e
    fi

    dtRunInitCommand
}

function dtRunInitCommand() {
    local initCommand
    initCommand=$(dtReadModuleConfigField init command)
    if [[ $? -eq 0 ]]; then
        $initCommand
    fi

    # echo "initcommand: $initCommand"
    # [[ -z "$initCommand" ]] && return 0
}

alias dtReinit=reinitDT
function reinitDT() {
    source $CA_DT_DIR/shell/init.sh
}

function dtShellAuth() {
    local authConfig=$(jq -nc --arg profile "$1" '{
        modules: {
            "aws-auth": { automaticAuth: true },
            init: { command: "initAutoAwsAuth" }
        }
    } | (
        if $profile != "" then
            (.modules["aws-auth"] += {"defaultProfile": $profile})
        else .
        end
    )')
    
    dtShell "$authConfig"
}

autoinitDT
