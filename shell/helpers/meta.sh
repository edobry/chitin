function checkDTVersion() {
    pushd $CA_PROJECT_DIR/dataeng-tools > /dev/null
    git describe HEAD --tags
    popd > /dev/null
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
