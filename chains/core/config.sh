export CHI_CONFIG_MODULE_FILE_NAME="config.yaml"

function chiConfigModuleReadFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1

    yamlFileToJson "$1/$CHI_CONFIG_MODULE_FILE_NAME"
}

function chiConfigReloadModuleConfig() {
    requireArg "a module name" "$1" || return 1

    local moduleDir="$(chiModuleGetPath "$1")"
    chiConfigModuleMergeFromFile "$moduleDir" "$1"
}

function chiConfigModuleMergeFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents="$(chiConfigModuleReadFromFile "$1")"
    [[ -z "$fileContents" ]] && return 1

    chiConfigMergeVariableValue "$2" "$fileContents"
}

export CHI_CONFIG_VARIABLE_PREFIX="CHI_CONFIG"

function chiConfigGetVariableValue() {
    requireArg "a module name" "$1" || return 1

    chiReadDynamicVariable "$(chiMakeDynamicVariableName "$CHI_CONFIG_VARIABLE_PREFIX" "$1")"
}

function chiModuleConfigReadVariablePath() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift;

    local config="$(chiConfigGetVariableValue "$moduleName")"
    [[ -z "$config" ]] && return 1

    jsonReadPath "$config" $*
}

function chiConfigMergeVariableValue() {
    requireArg "a module name" "$1" || return 1
    requireJsonArg "containing a config" "$2" || return 1

    local currentConfig="$(chiConfigGetVariableValue "$1")"
    
    # merge the configs, with the current config overriding
    local mergedConfig="$(jsonMergeDeep "$2" "${currentConfig:-"{}"}")"

    chiConfigSetVariableValue "$1" "$mergedConfig"
}

function chiConfigSetVariableValue() {
    requireArg "a module name" "$1" || return 1
    requireArg "a config JSON string" "$2" || return 1

    chiSetDynamicVariable "$2" "$CHI_CONFIG_VARIABLE_PREFIX" "$1"
}

function chiConfigModuleMerge() {
    requireArg "a module config json string" "$1" || return 1

    local moduleNamePrefix="$2"

    # read fiber configs
    while IFS= read -r moduleConfig; do
        [[ -z "$moduleConfig" ]] && continue

        local moduleName="$(jsonReadPath "$moduleConfig" key)"
        local configValue="$(jsonReadPath "$moduleConfig" value)"
        
        if [[ -n "$configValue" ]]; then
            chiConfigMergeVariableValue "${moduleNamePrefix}${moduleNamePrefix:+:}$moduleName" "$configValue"
        fi
    done <<< "$(jsonRead "$1" '(. // []) | to_entries[]')"
}

export CHI_CONFIG_MODULE_FIELD_NAME="moduleConfig"

function chiConfigChainMerge() {
    requireArg "a fiber config json string" "$1" || return 1

    local fiberName="$2"

    local moduleConfig="$(jsonReadPath "$1" "$CHI_CONFIG_MODULE_FIELD_NAME")"
    [[ -n "$moduleConfig" ]] && chiConfigModuleMerge "$moduleConfig" "$fiberName"
}
