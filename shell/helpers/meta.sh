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
        dtLog "Installed DT version $installedVersion does not meet minimum of $minimumVersion!"
        return 1
    fi
}

function dtCheckEmbeddedVersion() {
    if [[ ! -d dataeng-tools ]]; then
        dtLog "No embedded dataeng-tools found!"
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

function dtModuleCheckEnabled() {
    requireArg "a module name or config" "$1" || return 1

    local config=$([[ "$2" == "loaded" ]] && echo "$1" || dtReadModuleConfig "$1")
    jsonCheckBool 'enabled' "$config"
}

function dtModuleCheckTools() {
    requireArg "a module name" "$1" || return 1

    local moduleDepConfig
    moduleDepConfig=$(jsonRead "$CA_DT_DEPS" '.modules[$x] // empty' --arg x "$1")
    if [[ $? -ne 0 ]]; then
        dtLog "No dependency configuration for module $1 found!"
        return 1
    fi

    jsonRead "$moduleDepConfig" '.dependencies[]' |\
    while read -r dep; do
        if ! dtToolCheckValid $dep; then
            dtLog "module $1 will not load, as tool dependency $dep is unmet!"
            return 1
        fi
    done
}

function dtModuleShouldLoad() {
    requireArg "a module name" "$1" || return 1

    local name=$1
    shift

    local returnConfig
    if [[ "$1" == "return-config" ]]; then
        returnConfig=true
        shift
    fi

    local moduleConfig
    moduleConfig=$(dtReadModuleConfig ${1:-$name})
    local moduleConfigLoadReturn=$?
    
    [[ ! -z "$returnConfig" ]] && echo "$moduleConfig"

    [[ $moduleConfigLoadReturn -eq 0 ]] || return 1
    dtModuleCheckEnabled "$moduleConfig" loaded || return 1
    dtModuleCheckTools "$name" || return 1
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
    dtLog "config updated, reinitializing..."
    reinitDT
}

function dtToolCheckVersions() {
    local json5DepFilePath="$CA_DT_DIR/shell/dependencies.json5"

    local depFilePath
    depFilePath=$(json5Convert "$json5DepFilePath")
    [[ $? -eq 0 ]] || return 1
    local toolStatus=()

    export CA_DT_DEPS=$(jsonReadFile "$depFilePath")
    
    jsonRead "$CA_DT_DEPS" '.tools|to_entries[]' | \
    while read -r dep; do
        local depName=$(jsonRead "$dep" '.key')
        local expectedVersion=$(jsonRead "$dep" '.value.version')
        local versionCommand=$(jsonRead "$dep" '.value.command')

        if ! checkCommand "$depName"; then
            dtLog "$depName not installed!"
            toolStatus+=(("$depName" $(jq -nc '{ installed: false }')))
        fi

        local currentVersion=$(eval "$versionCommand")
        if checkVersionAndFail "$depName" "$expectedVersion" "$currentVersion"; then
            toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: true, validVersion: true } }')")
        else
            toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: true, validVersion: false } }')")
        fi
    done

    export CA_DT_TOOL_STATUS=$(jq -sc 'add' <(for x in "${toolStatus[@]}" ; do echo "$x" ; done))
}

function dtToolCheckValid() {
    requireArg "a tool name" "$1" || return 1
    [[ -z "$CA_DT_TOOL_STATUS" ]] && return 1

    echo "$CA_DT_TOOL_STATUS" | jq -e ".\"$1\" | (.installed and .validVersion)" >/dev/null
}

function dtModuleLoadNested() {    
    for module in $(find $CA_DT_HELPERS_PATH -type d -maxdepth 1 -not -path $CA_DT_HELPERS_PATH); do
        local moduleName=$(basename $module)
        local moduleInitScriptPath="$module/$moduleName-init.sh"
        if [[ -f $moduleInitScriptPath ]]; then
            source $moduleInitScriptPath
            [[ $? -eq 0 ]] || continue
        fi

        dtLoadDir $(find $module -type f -name '*.sh' -not -path $moduleInitScriptPath)
    done
}
