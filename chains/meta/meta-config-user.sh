export CHI_CONFIG_USER_FILE_NAME="userConfig.yaml"

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
    requireArg "at least one field name" "$1" || return 1

    jsonReadPath "$CHI_CONFIG_USER" $@
}

function chiConfigUserReadModule() {
    requireArg "a fiber name" "$1" || return 1
    requireArg "a chain name" "$2" || return 1

    local fiberName="$1"; shift
    local chainName="$1"; shift

    chiConfigUserRead "$fiberName" "$CHI_CONFIG_MODULE_FIELD_NAME" "$chainName" $@
}

function chiConfigUserReadFile() {
    yamlFileToJson "$(chiConfigUserGetPath)"
}

export CHI_SHARE_INIT="$CHI_SHARE/init"
export CHI_CONFIG_USER_PROJECT_DIR_FIELD_NAME="projectDir"

function chiConfigUserLoad() {
    local configLocation="$(chiConfigUserGetDir)"
    local configFilePath="$(chiConfigUserGetPath)"

    if [[ ! -f "$configFilePath" ]]; then
        mkdir -p "$configLocation"
        mkdir -p "$CHI_SHARE_INIT"
        cp "$CHI_DIR/$CHI_CONFIG_USER_FILE_NAME" "$configFilePath"

        chiLogInfo "initialized user config file at '$configFilePath'" meta config user
        chiLogInfo 'please complete setup by running `chiConfigUserModify`' meta config user
    fi

    local configFile
    configFile="$(chiConfigUserReadFile)"
    [[ $? -eq 0 ]] || return 1

    local inlineConfig="${1:-"{}"}"
    local mergedConfig="$(jsonMergeDeep "$configFile" "$inlineConfig")"
    export CHI_CONFIG_USER="$mergedConfig"
    local config="$mergedConfig"

    local projectDir="$(chiConfigUserRead core "$CHI_CONFIG_USER_PROJECT_DIR_FIELD_NAME")"
    if [[ -z "$projectDir" ]]; then
        chiLogInfo "'$CHI_CONFIG_USER_PROJECT_DIR_FIELD_NAME' not set!" meta config user
        return 1
    fi

    export CHI_PROJECT_DIR="$(chiExpandPath "$projectDir")"

    local dotfilesDir="$(chiConfigUserRead core dotfilesDir)"
    if [[ ! -z "$dotfilesDir" ]]; then
        export CHI_DOTFILES_DIR="$(chiExpandPath "$dotfilesDir")"
    fi

    chiConfigChainMerge "$config"
}

function chiModuleUserConfigMergeFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local moduleDir="$1"; shift
    local moduleName="$1"; shift

    local moduleConfigPath=("$moduleName")

    while [[ $# -gt 0 ]]; do
        moduleName="$moduleName:$1"
        moduleConfigPath+=("$CHI_CONFIG_MODULE_FIELD_NAME" "$1")
        shift
    done

    local userConfigPath="$(chiConfigUserGetPath)"

    local moduleDefaultUserConfigFile="$moduleDir/$CHI_CONFIG_USER_FILE_NAME"
    local existingModuleConfig="$(yamlReadFilePath "$userConfigPath" "${moduleConfigPath[@]}")"
    if [[ -f "$moduleDefaultUserConfigFile" ]] && [[ -z "$existingModuleConfig" ]]; then
        local userConfig="$(yamlFileToJson "$moduleDefaultUserConfigFile" 2>/dev/null)"
        [[ -z "$userConfig" ]] && return 1
        
        chiLogInfo "initializing user config for module '$moduleName'" meta config user

        jq -nc --argjson config "$userConfig" 'setpath($ARGS.positional; $config)' \
            --args "${moduleConfigPath[@]}" > "$CHI_SHARE_INIT/$CHI_CONFIG_USER_FILE_NAME-diff-$moduleName"
    fi
}

function chiConfigUserModify() {
    $EDITOR "$(chiConfigUserGetPath)"

    chiLogInfo "updated user config, reinitializing..." meta config user
    chiShell
}

function chiConfigUserSet() {
    requireArg "a config value object" "$1" || return 1

    echo "$1" | prettyYaml > "$(chiConfigUserGetPath)"

    chiLogInfo "updated user config, reinitializing..." meta config user
    chiShell
}

function chiConfigUserSetField() {
    requireArg "a field value" "$1" || return 1
    requireArg "a field path" "$2" || return 1

    local fieldValue="$1"; shift
    local newConfig="$(yamlFileSetField "$(chiConfigUserGetPath)" "$fieldValue" $*)"

    chiConfigUserSet "$newConfig"
}

function chiConfigUserSetModuleField() {
    requireArg "a field value" "$1" || return 1
    requireArg "a fiber name" "$2" || return 1
    requireArg "a chain name" "$3" || return 1
    requireArg "a field path" "$4" || return 1

    local fieldValue="$1"; shift
    local fiberName="$1"; shift
    local chainName="$1"; shift

    chiConfigUserSetField "$fieldValue" "$fiberName" "$CHI_CONFIG_MODULE_FIELD_NAME" "$chainName" $@
}
