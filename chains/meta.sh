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
    echo -e "chitin configuration\n"
    echo -e "chitin version: $(chiGetVersion)\n"
    chiShowConfig

    echo -e "\nchitin tool status:"
    chiToolShowStatus

    echo -e "\nchitin envvars:\n"
    chiShowEnvvars
    echo
    hr
    echo -e "\n\nAWS configuration:\n"
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
        chiLog "'$chainName' config section not initialized!"
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

function chiToolCheckValid() {
    requireArg "a tool name" "$1" || return 1
    [[ -z "$CHI_TOOL_STATUS" ]] && return 1
    
    echo "$CHI_TOOL_STATUS" | jq -e --arg dep jq '.[$dep] | (.installed and .validVersion)' >/dev/null
}

function chiToolShowStatus() {
    jsonRead "$CHI_TOOL_STATUS" 'to_entries[] | "\(.key) - installed: \(.value.installed), valid: \(.value.validVersion)"'
}

function chiChainCheckTools() {
    requireArg "a chain name" "$1" || return 1

    isSet "$IS_DOCKER" && return 0

    local chainDepConfig
    chainDepConfig=$(jsonRead "$CHI_DEPS" '.chainDeps[$x] // empty' --arg x "$1")
    if [[ $? -ne 0 ]]; then
        chiLog "No dependency configuration for chain $1 found!"
        return 1
    fi

    jsonRead "$chainDepConfig" '.dependencies[]' |\
    while read -r dep; do
        if ! chiToolCheckValid "$dep"; then
            chiLog "chain $1 will not load, as tool dependency $dep is unmet!"
            return 1
        fi
    done
}

function chiChainShouldLoad() {
    requireArg "a chain name" "$1" || return 1

    local name=$1
    shift

    local returnConfig
    if [[ "$1" == "return-config" ]]; then
        returnConfig=true
        shift
    fi

    local chainConfig
    chainConfig=$(chiReadChainConfig ${1:-$name})
    local chainConfigLoadReturn=$?
    
    isSet "$returnConfig" && echo "$chainConfig"

    [[ $chainConfigLoadReturn -eq 0 ]] || return 1
    chiChainCheckEnabled "$chainConfig" loaded || return 1
    chiChainCheckTools "$name" || return 1
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

function chiToolCheckVersions() {
    local json5DepFilePath="$CHI_DIR/dependencies.json5"

    local depFilePath
    depFilePath=$(json5Convert "$json5DepFilePath")
    [[ $? -eq 0 ]] || return 1
    local toolStatus=()

    export CHI_DEPS=$(jsonReadFile "$depFilePath")
    
    while read -r dep; do
        local depName=$(jsonRead "$dep" '.key')
        local expectedVersion=$(jsonRead "$dep" '.value.version')
        local versionCommand=$(jsonRead "$dep" '.value.command')

        if ! checkCommand "$depName"; then
            chiLog "$depName not installed!"
            toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: false } }')")
        else
            local currentVersion=$(eval "$versionCommand")
            
            if checkVersionAndFail "$depName" "$expectedVersion" "$currentVersion"; then
                toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: true, validVersion: true } }')")
            else
                toolStatus+=("$(jq -nc --arg depName "$depName" '{ ($depName): { installed: true, validVersion: false } }')")
            fi
        fi
    done < <(jsonRead "$CHI_DEPS" '.tools|to_entries[]')

    export CHI_TOOL_STATUS=$(jq -sc 'add' <(for x in "${toolStatus[@]}" ; do echo "$x" ; done))
}

function chiChainLoadNested() {
    requireArg "a directory name" "$1" || return 1

    for chain in $(find $1 -maxdepth 1 -type d -not -path $1); do
        chiChainLoad "$chain"
    done
}

function chiFiberLoadExternal() {
    for fiber in $(find $CHI_PROJECT_DIR -maxdepth 1 -type d -not -path $CHI_PROJECT_DIR -name "chitin-*"); do
        chiChainLoad "$chain"
    done
}

function chiChainLoad() {
    requireArg "a chain name" "$1" || return 1

    local chainName=$(basename "$1")
    local chainInitScriptPath="$1/$chainName-init.sh"
    if [[ -f $chainInitScriptPath ]]; then
        source $chainInitScriptPath
        [[ $? -eq 0 ]] || return 0
    fi

    chiLoadDir $(find "$1" -type f -name '*.sh' -not -path $chainInitScriptPath)
}
