function chiConfigUserGetLocation() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/chitin"
}

function chiConfigUserCd() {
    cd $(chiConfigUserGetLocation)
}

export CHI_CONFIG_USER_FILE_NAME="userConfig"
export CHI_CONFIG_FIBER_FILE_NAME="config"

function chiConfigUserShow() {
    cat $(chiConfigUserGetLocation)/$CHI_CONFIG_USER_FILE_NAME.yaml | prettyYaml
}

function chiConfigUserRead() {
    jsonRead "$CHI_CONFIG_USER" "$@"
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
    chiConfigConvertAndReadFile "$(chiConfigUserGetLocation)" "$CHI_CONFIG_USER_FILE_NAME" $@
}

function chiConfigConvertAndReadFile() {
    requireDirectoryArg "directory" "$1" || return 1
    requireArg "a config file name, sans extension" "$2" || return 1

    local filePath
    filePath=$(chiConfigFindFilePath "$1" "$2")
    [[ $? -eq 0 ]] || return 1

    local extension=$(fileGetExtension "$filePath")
    local convertedFilePath
    
    case "$extension" in
        json5)
            convertedFilePath=$(json5Convert "$filePath")
            ;;
        yaml)
            convertedFilePath=$(yamlConvert "$filePath")
            ;;
        *)
            chiBail "unsupported extension '$extension'!"
            return 1
            ;;
    esac
    
    [[ $? -eq 0 ]] || return 1

    jsonReadFile "$convertedFilePath"
}

function chiConfigUserLoad() {
    local configLocation=$(chiConfigUserGetLocation)
    local configFileFullName="$CHI_CONFIG_USER_FILE_NAME.yaml"
    local configFilePath="$configLocation/$configFileFullName"

    if [[ ! -f $configFilePath ]]; then
        mkdir -p $configLocation
        cp $CHI_DIR/$configFileFullName $configFilePath

        chiLog "initialized config file at '$configFilePath'" "init"
        chiLog 'please complete setup by running `chiConfigUserModify`' "init"
    fi

    local configFile
    configFile=$(chiConfigUserReadFile "$configLocation" "$CHI_CONFIG_USER_FILE_NAME")
    [[ $? -eq 0 ]] || return 1

    local inlineConfig="${1:-{}}"
    local mergedConfig=$(jsonMergeDeep "$configFile" "$inlineConfig")
    export CHI_CONFIG_USER="$mergedConfig"

    local projectDir=$(chiConfigUserRead '.projectDir // empty')
    if [[ -z "$projectDir" ]]; then
        chiLog "projectDir not set!" "meta:config"
        return 1
    fi

    export CHI_PROJECT_DIR="$(expandPath "$projectDir")"

    local dotfilesDir=$(chiConfigUserRead '.dotfilesDir // empty')
    if [[ ! -z "$dotfilesDir" ]]; then
        export CHI_DOTFILES_DIR="$(expandPath "$dotfilesDir")"
    fi
}

function chiConfigModify() {
    requireArg "a config path" "$1" || return 1
    requireArg "a config file name" "$2" || return 1

    ${EDITOR:-nano} "$(chiConfigFindFilePath "$1" "$2")"
    chiLog "updated, reinitializing..." "meta:config"
    chiReinit
}

function chiConfigUserModify() {
    chiConfigModify "$(chiConfigUserGetLocation)" "$CHI_CONFIG_USER_FILE_NAME"
}

function chiConfigFiberModify() {
    requireArg "a fiber name" "$1" || return 1

    chiConfigModify "$(chiModuleGetDynamicVariable "$CHI_FIBER_PATH_PREFIX" "$1")" "$CHI_CONFIG_FIBER_FILE_NAME"
}

function chiConfigChainRead() {
    requireArg "a chain name" "$1" || return 1

    local chainName="$1"
    shift
    local fieldPath="$1"
    [[ -z $fieldPath ]] || shift

    local config=$(chiConfigUserRead ".chains[\$chainName]$fieldPath" --arg chainName $chainName $@)
    if [[ "$config" == 'null' ]]; then
        chiLog "'$chainName' config section not initialized!" "$chainName"
        return 1
    fi

    echo $config
}

function chiConfigChainCheckBoolean() {
    requireArg "a chain name or config" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config=$([[ "$3" == "loaded" ]] && echo "$1" || chiConfigChainRead "$1")
    jsonCheckBool "$2" "$config"
}

function chiChainCheckEnabled() {
    requireArg "a chain name or config" "$1" || return 1

    local config=$([[ "$2" == "loaded" ]] && echo "$1" || chiConfigChainRead "$1")

    chiConfigChainCheckBoolean "$config" enabled "$2"
}

function chiConfigChainReadField() {
    requireArg "a chain name" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config
    config=$(chiConfigChainRead "$1")
    if [[ $? -ne 0 ]]; then
        echo "$config"
        return 1
    fi

    jsonRead "$config" ".$2 // empty"
}

function chiModuleConfigRead() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents
    fileContents=$(chiConfigConvertAndReadFile "$1" "config")
    [[ $? -eq 0 ]] || return 1

    [[ "$fileContents" == "null" ]] && return 0
    echo "$fileContents"
}

function chiModuleConfigReadAndSet() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents=$(chiModuleConfigRead "$1" "$2")
    # echo "$fileContents"
    [[ -z "$fileContents" ]] && return 1

    chiConfigSetVariableValue "$2" "$fileContents"
}

export CHI_CONFIG_VARIABLE_PREFIX="CHI_CONFIG"

function chiConfigGetVariableValue() {
    requireArg "a module name" "$1" || return 1

    chiModuleGetDynamicVariable "$CHI_CONFIG_VARIABLE_PREFIX" "$1"
}

function chiModuleConfigReadVariablePath() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift;

    jsonReadPath "$(chiConfigGetVariableValue "$moduleName")" $*
}

function chiConfigSetVariableValue() {
    requireArg "a module name" "$1" || return 1
    requireArg "a config JSON string" "$2" || return 1

    chiModuleSetDynamicVariable "$CHI_CONFIG_VARIABLE_PREFIX" "$1" "$2"
}
