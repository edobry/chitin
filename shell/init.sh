#!/usr/bin/env bash

SOURCE_DIR=$(dirname "$0")

if [[ "$0" = /* ]]; then
    SCRIPT_PATH="$0"
elif [ ! -z ${BASH_SOURCE[0]} ]; then
    SCRIPT_PATH="${BASH_SOURCE[0]}"
else
    SCRIPT_PATH="$SOURCE_DIR/init.sh"
fi

export DT_DIR="$(dirname $SCRIPT_PATH)"

function loadDir() {
    for f in "$@";
        do source $f;
    done
}

function checkDeps() {
    local expectedYqVersion="3.3.0"
    if [[ $(yq --version | awk '{ print $3 }') != $expectedYqVersion ]]; then
        echo "dataeng-tools - incorrect yq version, '$expectedYqVersion' expected!"
        return 1
    fi

    local expectedJqVersion="1.6"
    if [[ $(jq --version | awk -F '-' '{ print $2 }') != $expectedJqVersion ]]; then
        echo "dataeng-tools - incorrect jq version, '$expectedJqVersion' expected!"
        return 1
    fi
}

if ! checkDeps; then
    echo "dataeng-tools - exiting!"
    return 1
fi


# load init scripts
loadDir $DT_DIR/helpers/init/*.sh

# load helpers
loadDir $DT_DIR/helpers/*.sh

# zsh completions only loaded on zsh shells
if [ -n "$ZSH_VERSION" ]; then
    loadDir $DT_DIR/helpers/*.zsh
fi

