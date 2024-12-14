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
    jsonReadPath "$CHI_CONFIG_USER" $@
}

function chiConfigUserReadFile() {
    yamlFileToJson "$(chiConfigUserGetPath)"
}

function chiConfigUserLoad() {
    local configLocation="$(chiConfigUserGetDir)"
    local configFilePath="$(chiConfigUserGetPath)"

    if [[ ! -f "$configFilePath" ]]; then
        mkdir -p "$configLocation"
        cp "$CHI_DIR/$CHI_CONFIG_USER_FILE_NAME" "$configFilePath"

        chiLog "initialized config file at '$configFilePath'" "init"
        chiLog 'please complete setup by running `chiConfigUserModify`' "init"
    fi

    local configFile
    configFile="$(chiConfigUserReadFile)"
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

function chiModuleUserConfigMergeFromFile() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local moduleDir="$1"; shift
    local moduleName="$1"; shift

    local userConfig="$(yamlFileToJson "$moduleDir/$CHI_CONFIG_USER_FILE_NAME" 2>/dev/null)"
    [[ -z "$userConfig" ]] && return 1

    local moduleConfigPath=("$moduleName")

    while [[ $# -gt 0 ]]; do
        moduleConfigPath+=("moduleConfig" "$1")
        shift
    done

    local existingModuleConfig="$(yamlReadFilePath "$(chiConfigUserGetPath)" "${moduleConfigPath[@]}")"
    if [[ -z "$existingModuleConfig" ]]; then
        chiLog "initializing user config for module '$moduleName'" "meta:config"
        yamlFileSetFieldWrite "$(chiConfigUserGetPath)" "$userConfig" "${moduleConfigPath[@]}"
    fi
}

function chiConfigUserModify() {
    $EDITOR "$(chiConfigUserGetPath)"

    chiLog "updated user config, reinitializing..." "meta:config"
    chiShell

}

function chiConfigUserSet() {
    requireArg "a config value object" "$1" || return 1

    echo "$1" | prettyYaml > "$(chiConfigUserGetPath)"

    chiLog "updated user config, reinitializing..." "meta:config"
    chiShell
}

function chiConfigUserSetField() {
    requireArg "a field value" "$1" || return 1
    requireArg "a field path" "$2" || return 1

    local fieldValue="$1"; shift
    local newConfig="$(yamlFileSetField "$(chiConfigUserGetPath)" "$fieldValue" $*)"

    chiConfigUserSet "$newConfig"
}
