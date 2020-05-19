#!/usr/bin/env bash

function loadDir() {
    for f in $1;
        do source $f;
    done
}

# load init scripts
loadDir helpers/init/*.sh

# load helpers
loadDir helpers/*.sh
