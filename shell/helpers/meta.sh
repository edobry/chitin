function getDTVersion() {
    pushd $CA_PROJECT_DIR/dataeng-tools > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function checkDTVersion() {
    requireArg "the minimum version" "$1" || return 1

    local minimumVersion="$1"
    local installedVersion=$(getDTVersion | sed 's/v//')
    
    if ! checkVersion $minimumVersion $installedVersion; then
        echo "Installed DT version $installedVersion does not meet minimum of $minimumVersion!"
        return 1
    fi
}

function checkEmbeddedDTVersion() {
    if [[ ! -d dataeng-tools ]]; then
        echo "No embedded dataeng-tools found!"
        return 1
    fi

    pushd dataeng-tools > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function modifyDTConfig() {
    nano $(getDTConfigLocation)/config.json5
    echo "DT config updated, reinitializing..."
    reinitDT
}
