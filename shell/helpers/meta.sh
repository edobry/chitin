function dtGetVersion() {
    pushd $CA_PROJECT_DIR/dataeng-tools > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function dtGetLocation() {
    echo $CA_PROJECT_DIR/dataeng-tools
}

function dtGetReleasedVersion() {
    dtGetVersion | cut -d '-' -f 1
}

function dtCheckVersion() {
    requireArg "the minimum version" "$1" || return 1

    local minimumVersion="$1"
    local installedVersion=$(dtGetVersion)

    if ! checkVersion $minimumVersion $installedVersion; then
        echo "Installed DT version $installedVersion does not meet minimum of $minimumVersion!"
        return 1
    fi
}

function dtCheckEmbeddedVersion() {
    if [[ ! -d dataeng-tools ]]; then
        echo "No embedded dataeng-tools found!"
        return 1
    fi

    pushd dataeng-tools > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function dtGetConfigLocation() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/dataeng-tools"
}

function dtShowConfig() {
    cat $(dtGetConfigLocation)/config.json | prettyJson
}

function dtShowEnvvars() {
    env | grep "CA_"
}

function dtDebug() {
    echo -e "DT configuration\n"
    echo -e "DT version: $(dtGetVersion)\n"
    dtShowConfig

    echo -e "\nDT envvars:\n"
    dtShowEnvvars
    echo
    hr
    echo -e "\n\nAWS configuration:\n"
    awsShowEnvvars
}

function dtReadConfig() {
    jsonRead "$CA_DT_CONFIG" $@
}

function dtReadConfigFile() {
    jsonReadFile $(dtGetConfigLocation)/config.json $@
}

function dtReadModuleConfig() {
    requireArg "a module name" "$1" || return 1

    local moduleName="$1"
    shift
    local fieldPath="$1"
    [[ -z $fieldPath ]] || shift

    local config=$(dtReadConfig ".modules[\$modName]$fieldPath" --arg modName $moduleName $@)
    if [[ "$config" == 'null' ]]; then
        dtLog "'$moduleName' config section not initialized!"
        return 1
    fi

    echo $config
}

function dtReadModuleConfigField() {
    requireArg "a module name" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config
    config=$(dtReadModuleConfig "$1")
    if [[ $? -ne 0 ]]; then
        echo "$config"
        return 1
    fi

    jsonRead "$config" ".$2 // empty"
}

function dtModifyConfig() {
    nano $(dtGetConfigLocation)/config.json5
    echo "DT config updated, reinitializing..."
    reinitDT
}
