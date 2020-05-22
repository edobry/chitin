#!/usr/bin/env bash

SOURCE_DIR=$(dirname "$0")

if [[ "$0" = /* ]]; then
    SCRIPT_PATH="$0"
elif [ ! -z ${BASH_SOURCE[0]} ]; then
    SCRIPT_PATH="${BASH_SOURCE[0]}"
else
    SCRIPT_PATH="$SOURCE_DIR/init.sh"
fi

SOURCE_DIR="$(dirname $SCRIPT_PATH)"

function loadDir() {
    for f in "$@";
        do source $f;
    done
}

# load init scripts
loadDir $SOURCE_DIR/helpers/init/*.sh

# load helpers
loadDir $SOURCE_DIR/helpers/*.sh
