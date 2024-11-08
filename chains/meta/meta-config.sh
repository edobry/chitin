function chiConfigGetLocation() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/chitin"
}

function chiConfigCd() {
    cd $(chiConfigGetLocation)
}

function chiConfigShow() {
    cat $(chiConfigGetLocation)/config.json | prettyJson
}

function chiConfigRead() {
    jsonRead "$CHI_CONFIG" "$@"
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

function chiConfigReadFile() {
    chiConfigConvertAndReadFile "$(chiConfigGetLocation)" "config" $@
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

function chiConfigLoad() {
    local configFileName="config"
    local configLocation=$(chiConfigGetLocation)
    local configFileFullName="$configFileName.yaml"
    local configFilePath="$configLocation/$configFileFullName"

    if [[ ! -f $configFilePath ]]; then
        mkdir -p $configLocation
        cp $CHI_DIR/$configFileFullName $configFilePath

        chiLog "initialized config file at '$configFilePath'" "init"
        chiLog "please complete setup by running `chiConfigModify`" "init"
    fi

    local configFile
    configFile=$(chiConfigReadFile "$configLocation" "$configFileName")
    [[ $? -eq 0 ]] || return 1

    local inlineConfig="${1:-{}}"

    # echo "file config: $configFile"
    # echo "inline config: $inlineConfig"
    local mergedConfig=$(jsonMergeDeep "$configFile" "$inlineConfig")
    # echo "merged config: $mergedConfig"

    export CHI_CONFIG="$mergedConfig"

    local dotfilesDir=$(chiConfigRead '.dotfilesDir // empty')
    export CHI_DOTFILES_DIR="$dotfilesDir"

    local projectDir=$(chiConfigRead '.projectDir // empty')
    export CHI_PROJECT_DIR="$projectDir"
}

function chiConfigModify() {
    ${EDITOR:-nano} "$(chiConfigFindFilePath "$(chiConfigGetLocation)" "config")"
    chiLog "config updated, reinitializing..." "meta:config"
    chiReinit
}

function chiReadChainConfig() {
    requireArg "a chain name" "$1" || return 1

    local chainName="$1"
    shift
    local fieldPath="$1"
    [[ -z $fieldPath ]] || shift

    local config=$(chiConfigRead ".chains[\$chainName]$fieldPath" --arg chainName $chainName $@)
    if [[ "$config" == 'null' ]]; then
        chiLog "'$chainName' config section not initialized!" "$chainName"
        return 1
    fi

    echo $config
}

function chiChainCheckBoolean() {
    requireArg "a chain name or config" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config=$([[ "$3" == "loaded" ]] && echo "$1" || chiReadChainConfig "$1")
    jsonCheckBool "$2" "$config"
}

function chiChainCheckEnabled() {
    requireArg "a chain name or config" "$1" || return 1

    local config=$([[ "$2" == "loaded" ]] && echo "$1" || chiReadChainConfig "$1")

    chiChainCheckBoolean "$config" enabled "$2"
}

function chiReadChainConfigField() {
    requireArg "a chain name" "$1" || return 1
    requireArg "a field name" "$2" || return 1

    local config
    config=$(chiReadChainConfig "$1")
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
