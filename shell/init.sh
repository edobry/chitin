#!/usr/bin/env bash

export DT_TOOLS_DIR=$PROJECT_DIR/dataeng-tools

function loadDir() {
    for f in $1;
        do source $f;
    done
}

# load init scripts
loadDir $DT_TOOLS_DIR/shell/helpers/init/*.sh

# load helpers
loadDir $DT_TOOLS_DIR/shell/helpers/*.sh
