export CHI_CONFIG_USER_FILE_NAME="userConfig"
export CHI_CONFIG_FIBER_FILE_NAME="config"

function chiConfigUserGetDir() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/chitin"
}

function chiConfigUserGetPath() {
    echo "$(chiConfigUserGetDir)/$CHI_CONFIG_USER_FILE_NAME.yaml"
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

function chiConfigFindFilePath() {
    requireDirectoryArg "directory" "$1" || return 1
    requireArg "a config file name, sans extension" "$2" || return 1

    local json5DepFilePath="$1/$2.json5"
    local yamlDepFilePath="$1/$2.yaml"

    checkFileExists "$json5DepFilePath" >/dev/null && echo "$json5DepFilePath" && return 0
    checkFileExists "$yamlDepFilePath" >/dev/null && echo "$yamlDepFilePath" && return 0

    return 1
}

function chiConfigUserReadFile() {
    chiConfigConvertAndReadFile "$(chiConfigUserGetDir)" "$CHI_CONFIG_USER_FILE_NAME" $@
}

function chiConfigConvertAndReadFile() {
    requireDirectoryArg "directory" "$1" || return 1
    requireArg "a config file name, sans extension" "$2" || return 1

    local filePath
    filePath="$(chiConfigFindFilePath "$1" "$2")"
    [[ $? -eq 0 ]] || return 1

    local extension="$(fileGetExtension "$filePath")"
    local convertedFilePath
    
    # echo "filePath: $filePath" >&2

    case "$extension" in
        json5)
            convertedFilePath="$(json5Convert "$filePath")"
            ;;
        yaml)
            convertedFilePath="$(yamlConvert "$filePath")"
            ;;
        *)
            chiBail "unsupported extension '$extension'!"
            return 1
            ;;
    esac
    
    [[ $? -eq 0 ]] || return 1

    # echo "convertedFilePath: $convertedFilePath" >&2

    jsonReadFile "$convertedFilePath"
}

function chiConfigUserLoad() {
    local configLocation="$(chiConfigUserGetDir)"
    local configFileFullName="$CHI_CONFIG_USER_FILE_NAME.yaml"
    local configFilePath="$configLocation/$configFileFullName"

    if [[ ! -f "$configFilePath" ]]; then
        mkdir -p "$configLocation"
        cp "$CHI_DIR/$configFileFullName" "$configFilePath"

        chiLog "initialized config file at '$configFilePath'" "init"
        chiLog 'please complete setup by running `chiConfigUserModify`' "init"
    fi

    local configFile
    configFile="$(chiConfigUserReadFile "$configLocation" "$CHI_CONFIG_USER_FILE_NAME")"
    [[ $? -eq 0 ]] || return 1

    # echo "configFile: $configFile" >&2

    local inlineConfig="${1:-"{}"}"
    local mergedConfig="$(jsonMergeDeep "$configFile" "$inlineConfig")"
    export CHI_CONFIG_USER="$mergedConfig"
    local config="$mergedConfig"

    local projectDir="$(chiConfigUserRead projectDir)"
    if [[ -z "$projectDir" ]]; then
        chiLog "projectDir not set!" "meta:config"
        return 1
    fi

    export CHI_PROJECT_DIR="$(chiExpandPath "$projectDir")"

    local dotfilesDir="$(chiConfigUserRead dotfilesDir)"
    if [[ ! -z "$dotfilesDir" ]]; then
        export CHI_DOTFILES_DIR="$(chiExpandPath "$dotfilesDir")"
    fi

    # read module configs
    local moduleConfig="$(jsonReadPath "$config" moduleConfig)"
    [[ -n "$moduleConfig" ]] && chiConfigModuleMerge "$moduleConfig"

    # read chain configs (backwards compatibility)
    local chainConfig="$(jsonReadPath "$config" chainConfig)"
    [[ -n "$chainConfig" ]] && chiConfigModuleMerge "$chainConfig"
}

function chiConfigModify() {
    requireArg "a config path" "$1" || return 1
    requireArg "a config file name" "$2" || return 1

    $EDITOR "$(chiConfigFindFilePath "$1" "$2")"
    chiLog "updated, reinitializing..." "meta:config"
    chiReinit
}

function chiConfigSet() {
    requireArg "a config path" "$1" || return 1
    requireArg "a config file name" "$2" || return 1
    requireArg "a config value object" "$3" || return 1

    echo "$3" | prettyYaml > "$(chiConfigFindFilePath "$1" "$2")"
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

    chiConfigModify "$(chiModuleGetDynamicVariable "$CHI_FIBER_PATH_PREFIX" "$1")" "$CHI_CONFIG_FIBER_FILE_NAME"
}

function chiConfigChainRead() {
    requireArg "a chain name" "$1" || return 1

    local chainName="$1"; shift
    local fieldPath="$1"
    [[ -z $fieldPath ]] || shift

    local config="$(chiConfigUserRead moduleConfig "$chainName" $fieldPath $@)"
    if [[ "$config" == 'null' ]]; then
        chiLog "'$chainName' config section not initialized!" "$chainName"
        return 1
    fi

    echo "$config"
}

function chiConfigChainCheckBoolean() {
    requireArg "a chain name or config" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config="$([[ "$3" == "loaded" ]] && echo "$1" || chiConfigChainRead "$1")"
    jsonCheckBool "$2" "$config"
}

function chiChainCheckEnabled() {
    requireArg "a chain name or config" "$1" || return 1

    local config="$([[ "$2" == "loaded" ]] && echo "$1" || chiConfigChainRead "$1")"

    chiConfigChainCheckBoolean "$config" enabled "$2"
}

function chiConfigChainReadField() {
    requireArg "a chain name" "$1" || return 1
    requireArg "a field path" "$2" || return 1

    local chainName="$1"; shift

    local config="$(chiConfigChainRead "$chainName")"
    [[ -z "$config" ]] && return 1

    jsonReadPath "$config" $*
}

function chiModuleConfigReadFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents
    fileContents="$(chiConfigConvertAndReadFile "$1" "config")"
    [[ $? -eq 0 ]] || return 1

    [[ "$fileContents" == "null" ]] && return 0
    echo "$fileContents"
}

function chiModuleConfigMergeFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents="$(chiModuleConfigReadFromFile "$1" "$2")"
    [[ -z "$fileContents" ]] && return 1

    chiConfigMergeVariableValue "$2" "$fileContents"
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
