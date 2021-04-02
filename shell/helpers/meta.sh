function getDTVersion() {
    pushd $CA_PROJECT_DIR/dataeng-tools > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function getDTLocation() {
    echo $CA_PROJECT_DIR/dataeng-tools
}

function getReleasedDTVersion() {
    getDTVersion | cut -d '-' -f 1
}

function checkDTVersion() {
    requireArg "the minimum version" "$1" || return 1

    local minimumVersion="$1"
    local installedVersion=$(getDTVersion)

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

function getDTConfigLocation() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/dataeng-tools"
}

function showDTConfig() {
    cat $(getDTConfigLocation)/config.json | prettyJson
}

function showDTEnvvars() {
    env | grep "CA_"
}

function dtDebug() {
    echo -e "DT configuration\n"
    echo -e "DT version: $(getDTVersion)\n"
    showDTConfig

    echo -e "\nDT envvars:\n"
    showDTEnvvars
    echo
    hr
    echo -e "\n\nAWS configuration:\n"
    showAWSEnvvars
}

function dtReadConfig() {
    readJSON "$CA_DT_CONFIG" $@
}

function dtReadConfigFile() {
    readJSONFile $(getDTConfigLocation)/config.json $@
}

function dtReadModuleConfig() {
    requireArg "a module name" "$1" || return 1

    local moduleName="$1"
    shift
    local fieldPath="$1"
    [[ -z $fieldPath ]] || shift

    dtReadConfig ".modules[\$modName]$fieldPath" --arg modName $moduleName $@
}

function modifyDTConfig() {
    nano $(getDTConfigLocation)/config.json5
    echo "DT config updated, reinitializing..."
    reinitDT
}
