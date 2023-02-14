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

    echo -e "\nDT tool status:"
    dtToolShowStatus

    echo -e "\nDT envvars:\n"
    dtShowEnvvars
    echo
    hr
    echo -e "\n\nAWS configuration:\n"
    awsShowEnvvars
}

function dtReadConfig() {
    jsonRead "$CA_DT_CONFIG" "$@"
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

function dtModuleCheckBoolean() {
    requireArg "a module name or config" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config=$([[ "$3" == "loaded" ]] && echo "$1" || dtReadModuleConfig "$1")
    jsonCheckBool "$2" "$config"
}

function dtModuleCheckEnabled() {
    requireArg "a module name or config" "$1" || return 1

    local config=$([[ "$2" == "loaded" ]] && echo "$1" || dtReadModuleConfig "$1")

    dtModuleCheckBoolean "$config" enabled "$2"
}

function dtToolCheckValid() {
    requireArg "a tool name" "$1" || return 1
    [[ -z "$CA_DT_TOOL_STATUS" ]] && return 1
    
    echo "$CA_DT_TOOL_STATUS" | jq -e --arg dep jq '.[$dep] | (.installed and .validVersion)' >/dev/null
}

function dtToolShowStatus() {
    jsonRead "$CA_DT_TOOL_STATUS" 'to_entries[] | "\(.key) - installed: \(.value.installed), valid: \(.value.validVersion)"'
}

function dtModuleCheckTools() {
    requireArg "a module name" "$1" || return 1

    isSet "$IS_DOCKER" && return 0

    local moduleDepConfig
    moduleDepConfig=$(jsonRead "$CA_DT_DEPS" '.modules[$x] // empty' --arg x "$1")
    if [[ $? -ne 0 ]]; then
        dtLog "No dependency configuration for module $1 found!"
        return 1
    fi

    jsonRead "$moduleDepConfig" '.dependencies[]' |\
    while read -r dep; do
        if ! dtToolCheckValid "$dep"; then
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
    
    isSet "$returnConfig" && echo "$moduleConfig"

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
    
    while read -r dep; do
        local depName=$(jsonRead "$dep" '.key')
        local expectedVersion=$(jsonRead "$dep" '.value.version')
        local versionCommand=$(jsonRead "$dep" '.value.command')

        if ! checkCommand "$depName"; then
            dtLog "$depName not installed!"
            toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: false } }')")
        else
            local currentVersion=$(eval "$versionCommand")
            
            if checkVersionAndFail "$depName" "$expectedVersion" "$currentVersion"; then
                toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: true, validVersion: true } }')")
            else
                toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: true, validVersion: false } }')")
            fi
        fi
    done < <(jsonRead "$CA_DT_DEPS" '.tools|to_entries[]')

    export CA_DT_TOOL_STATUS=$(jq -sc 'add' <(for x in "${toolStatus[@]}" ; do echo "$x" ; done))
}

function dtModuleLoadNested() {
    for module in $(find $CA_DT_HELPERS_PATH -maxdepth 1 -type d -not -path $CA_DT_HELPERS_PATH); do
        dtModuleLoad "$module"
    done
}

function dtModuleLoad() {
    requireArg "a module name" "$1" || return 1

    local moduleName=$(basename "$1")
    local moduleInitScriptPath="$1/$moduleName-init.sh"
    if [[ -f $moduleInitScriptPath ]]; then
        source $moduleInitScriptPath
        [[ $? -eq 0 ]] || return 0
    fi

    dtLoadDir $(find "$1" -type f -name '*.sh' -not -path $moduleInitScriptPath)
}
