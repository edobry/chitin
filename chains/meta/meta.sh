function chiGetVersion() {
    pushd $CHI_PROJECT_DIR/chitin > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function chiGetLocation() {
    echo $CHI_PROJECT_DIR/chitin
}

function chiGetReleasedVersion() {
    chiGetVersion | cut -d '-' -f 1
}

function chiCheckVersion() {
    requireArg "the minimum version" "$1" || return 1

    local minimumVersion="$1"
    local installedVersion=$(chiGetVersion)

    if ! checkVersion $minimumVersion $installedVersion; then
        chiLog "Installed chitin version $installedVersion does not meet minimum of $minimumVersion!"
        return 1
    fi
}

function chiCheckEmbeddedVersion() {
    if [[ ! -d chitin ]]; then
        chiLog "No embedded chitin found!"
        return 1
    fi

    pushd chitin > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function chiGetConfigLocation() {
    echo "${XDG_CONFIG_HOME:-$HOME/.config}/chitin"
}

function chiShowConfig() {
    cat $(chiGetConfigLocation)/config.json | prettyJson
}

function chiShowEnvvars() {
    env | grep "CHI_"
}

function chiDebug() {
    chiLog "configuration"
    chiLog "version: $(chiGetVersion)"
    chiShowConfig

    chiLog "tool status:"
    chiDependenciesShowToolStatus

    chiLog "envvars:"
    chiShowEnvvars
    
    echo
    hr

    chiLog "configuration:" "aws"
    awsShowEnvvars
}

function chiReadConfig() {
    jsonRead "$CHI_CONFIG" "$@"
}

function chiReadConfigFile() {
    jsonReadFile $(chiGetConfigLocation)/config.json $@
}

function chiReadChainConfig() {
    requireArg "a chain name" "$1" || return 1

    local chainName="$1"
    shift
    local fieldPath="$1"
    [[ -z $fieldPath ]] || shift

    local config=$(chiReadConfig ".chains[\$chainName]$fieldPath" --arg chainName $chainName $@)
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

function chiModifyConfig() {
    ${EDITOR:-nano} "$(chiGetConfigLocation)/config.json5"
    chiLog "config updated, reinitializing..."
    chiReinit
}

function chiRegisterCompletion() {
    requireArg "\$0" "$1" || return 1

    checkCommand compdef && return 0

    export fpath=($(dirname "$1") $fpath)
    return 1
}
