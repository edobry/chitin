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

export CHI_CONFIG_USER_PROJECT_DIR_FIELD_NAME="projectDir"

function chiConfigUserLoad() {
    local configLocation="$(chiConfigUserGetDir)"
    local configFilePath="$(chiConfigUserGetPath)"

    if [[ ! -f "$configFilePath" ]]; then
        mkdir -p "$configLocation"
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

    local userConfig="$(yamlFileToJson "$moduleDir/$CHI_CONFIG_USER_FILE_NAME" 2>/dev/null)"
    [[ -z "$userConfig" ]] && return 1

    local moduleConfigPath=("$moduleName")

    while [[ $# -gt 0 ]]; do
        moduleName="$moduleName:$1"
        moduleConfigPath+=("$CHI_CONFIG_MODULE_FIELD_NAME" "$1")
        shift
    done

    # a module's userConfig.yaml is a template of defaults. When the user's config has no
    # section for the module, apply the defaults in memory: under the user's config, so
    # chiConfigUserRead sees them, and into the module's own config variable. Startup used
    # to write the template into ~/.config/chitin/userConfig.yaml and reload everything;
    # starting a shell must never modify the user's files (audit risk #7)
    local existingModuleConfig="$(jsonReadPath "$CHI_CONFIG_USER" "${moduleConfigPath[@]}" 2>/dev/null)"
    [[ -n "$existingModuleConfig" && "$existingModuleConfig" != "null" ]] && return 0

    chiLogDebug "applying default user config for module '$moduleName'" meta config user

    local defaults="$(jq -nc --argjson config "$userConfig" 'setpath($ARGS.positional; $config)' --args "${moduleConfigPath[@]}")"
    export CHI_CONFIG_USER="$(jsonMergeDeep "$defaults" "$CHI_CONFIG_USER")"
    chiConfigMergeVariableValue "$moduleName" "$userConfig"
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
