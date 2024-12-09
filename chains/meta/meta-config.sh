export CHI_CONFIG_USER_FILE_NAME="userConfig.yaml"
export CHI_CONFIG_MODULE_FILE_NAME="config.yaml"

function chiConfigUserGetDir() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/chitin"
}

function chiConfigUserGetPath() {
    echo "$(chiConfigUserGetDir)/$CHI_CONFIG_USER_FILE_NAME"
}

function chiConfigUserCd() {
    cd $(chiConfigUserGetDir)
}

function chiConfigUserShow() {
    cat "$(chiConfigUserGetPath)" | prettyYaml
}

function chiConfigUserRead() {
    jsonReadPath "$CHI_CONFIG_USER" $@
}

function chiConfigUserReadFile() {
    yamlFileToJson "$(chiConfigUserGetDir)/$CHI_CONFIG_USER_FILE_NAME"
}

function chiConfigUserLoad() {
    local configLocation="$(chiConfigUserGetDir)"
    local configFilePath="$configLocation/$CHI_CONFIG_USER_FILE_NAME"

    if [[ ! -f "$configFilePath" ]]; then
        mkdir -p "$configLocation"
        cp "$CHI_DIR/$CHI_CONFIG_USER_FILE_NAME" "$configFilePath"

        chiLog "initialized config file at '$configFilePath'" "init"
        chiLog 'please complete setup by running `chiConfigUserModify`' "init"
    fi

    local configFile
    configFile="$(chiConfigUserReadFile "$configLocation" "$CHI_CONFIG_USER_FILE_NAME")"
    [[ $? -eq 0 ]] || return 1

    local inlineConfig="${1:-"{}"}"
    local mergedConfig="$(jsonMergeDeep "$configFile" "$inlineConfig")"
    export CHI_CONFIG_USER="$mergedConfig"
    local config="$mergedConfig"

    local projectDir="$(chiConfigUserRead core projectDir)"
    if [[ -z "$projectDir" ]]; then
        chiLog "projectDir not set!" "meta:config"
        return 1
    fi

    export CHI_PROJECT_DIR="$(chiExpandPath "$projectDir")"

    local dotfilesDir="$(chiConfigUserRead core dotfilesDir)"
    if [[ ! -z "$dotfilesDir" ]]; then
        export CHI_DOTFILES_DIR="$(chiExpandPath "$dotfilesDir")"
    fi

    local moduleConfig="$(jsonReadPath "$config" moduleConfig)"
    [[ -n "$moduleConfig" ]] && chiConfigModuleMerge "$moduleConfig"
}

function chiConfigModify() {
    requireArg "a config path" "$1" || return 1
    requireArg "a config file name" "$2" || return 1

    $EDITOR "$1/$2"
    chiLog "updated, reinitializing..." "meta:config"
    chiReinit
}

function chiConfigSet() {
    requireArg "a config path" "$1" || return 1
    requireArg "a config file name" "$2" || return 1
    requireArg "a config value object" "$3" || return 1

    echo "$3" | prettyYaml > "$1/$2"
    chiLog "updated, reinitializing..." "meta:config"
    chiReinit
}

function chiConfigUserModify() {
    chiConfigModify "$(chiConfigUserGetDir)" "$CHI_CONFIG_USER_FILE_NAME"
}

function chiConfigUserSet() {
    requireArg "a config value object" "$1" || return 1

    chiConfigSet "$(chiConfigUserGetDir)" "$CHI_CONFIG_USER_FILE_NAME" "$1"
}

function chiConfigUserSetField() {
    requireArg "a field value" "$1" || return 1
    requireArg "a field path" "$2" || return 1

    local fieldValue="$1"; shift
    local newConfig="$(yamlFileSetField "$(chiConfigUserGetPath)" "$fieldValue" $*)"

    chiConfigUserSet "$newConfig"
}

function chiConfigFiberModify() {
    requireArg "a fiber name" "$1" || return 1

    chiConfigModify "$(chiModuleGetDynamicVariable "$CHI_FIBER_PATH_PREFIX" "$1")" "$CHI_CONFIG_MODULE_FILE_NAME"
}

function chiModuleConfigReadFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1

    yamlFileToJson "$1/$CHI_CONFIG_MODULE_FILE_NAME"
}

function chiModuleConfigMergeFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents="$(chiModuleConfigReadFromFile "$1" "$2")"
    [[ -z "$fileContents" ]] && return 1

    chiConfigMergeVariableValue "$2" "$fileContents"
}

function chiModuleUserConfigMergeFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local moduleDir="$1"; shift
    local moduleName="$1"; shift

    local userConfig="$(yamlFileToJson "$moduleDir/$CHI_CONFIG_USER_FILE_NAME" 2>/dev/null)"
    [[ -z "$userConfig" ]] && return 1

    local moduleConfigPath=("$moduleName" "moduleConfig" "$@")

    local existingModuleConfig="$(yamlReadFilePath "$(chiConfigUserGetPath)" "${moduleConfigPath[@]}")"
    if [[ -z "$existingModuleConfig" ]]; then
        chiLog "initializing user config for module '$moduleName'" "meta:config"
        yamlFileSetFieldWrite "$(chiConfigUserGetPath)" "$userConfig" "${moduleConfigPath[@]}"
    fi
}

export CHI_CONFIG_VARIABLE_PREFIX="CHI_CONFIG"

function chiConfigGetVariableValue() {
    requireArg "a module name" "$1" || return 1

    chiModuleGetDynamicVariable "$CHI_CONFIG_VARIABLE_PREFIX" "$1"
}

function chiModuleConfigReadVariablePath() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift;

    local config="$(chiConfigGetVariableValue "$moduleName")"
    [[ -z "$config" ]] && return 1

    jsonReadPath "$config" $*
}

function chiConfigSetVariableValue() {
    requireArg "a module name" "$1" || return 1
    requireArg "a config JSON string" "$2" || return 1

    chiModuleSetDynamicVariable "$CHI_CONFIG_VARIABLE_PREFIX" "$1" "$2"
}

function chiConfigMergeVariableValue() {
    requireArg "a module name" "$1" || return 1
    requireJsonArg "containing a config" "$2" || return 1

    # echo "merging configs for module $1" >&2
    local currentConfig="$(chiConfigGetVariableValue "$1")"
    # echo "currentConfig: $currentConfig" >&2
    
    # merge the configs, with the current config overriding
    local mergedConfig="$(jsonMergeDeep "$2" "${currentConfig:-"{}"}")"
    # echo "mergedConfig: $mergedConfig" >&2

    chiConfigSetVariableValue "$1" "$mergedConfig"
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
