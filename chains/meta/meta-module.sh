function chiModuleGetDynamicVariable() {
    requireArg "a variable prefix" "$1" || return 1
    requireArg "a module name" "$2" || return 1
    
    echo $(chiReadDynamicVariable "$(chiModuleMakeDynamicVariableName "$1" "$2")")
}

function chiModuleSetDynamicVariable() {
    requireArg "a variable prefix" "$1" || return 1
    requireArg "a module name" "$2" || return 1
    requireArg "a variable value" "$3" || return 1
    
    export "$(chiModuleMakeDynamicVariableName "$1" "$2")=$3"
}

function chiModuleNameToVariableName() {
    requireArg "a module name" "$1" || return 1

    sed 's/[:\-]/_/g' <<< "$1"
}

function chiModuleMakeDynamicVariableName() {
    requireArg "a variable prefix" "$1" || return 1
    requireArg "a module name" "$2" || return 1
    
    echo "${1}_$(chiModuleNameToVariableName "$2")"
}

function chiModuleDependenciesGetRequiredTools() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool type" "$2" || return 1

    chiModulesGetRequiredTools $(chiConfigGetVariableValue "$1") "$2"
}

function chiFiberLoadExternal() {
    IFS=$'\n' fibers=($(find "$CHI_PROJECT_DIR" -maxdepth 1 -type d -not -path "$CHI_PROJECT_DIR" -name 'chitin-*'))

    # echo "${fibers[@]}"

    if [[ ${#fibers[@]} -gt 0 ]]; then
        chiFiberLoadExternalLoop "${fibers[@]}"
    fi
}

function chiFiberLoadExternalLoop() {
    requireArg "at least one fiber" "$1" || return 1

    local fibers=("$@")
    local retryList=()

    for fiber in "${fibers[@]}"; do
        # echo "loading fiber: $fiber"
        if ! chiFiberLoad "$fiber"; then
        # echo "loading fiber failed, retrying"
            retryList+=("$fiber")
        else
            # echo "fiber loaded: $fiber"
        fi
    done

    # if not all fibers loaded, retry
    if [[ ${#retryList[@]} -gt 0 ]]; then
        # echo "retrying: ${retryList[@]}"
        chiFiberLoadExternalLoop "${retryList[@]}"
    fi
}

export CHI_FIBER_PREFIX="CHI_FIBER"
export CHI_FIBER_PATH_PREFIX="${CHI_FIBER_PREFIX}_PATH"

function chiFiberLoad() {
    requireDirectoryArg "fiber directory" "$1" || return 1

    local fiberName=${2:-${$(basename "$1")#chitin-}}
    local fiberLoadedPrefix="${CHI_FIBER_PREFIX}_LOADED"

    # if already loaded, return
    [[ -n $(chiModuleGetDynamicVariable "$fiberLoadedPrefix" "$fiberName") ]] && return 0

    chiModuleConfigReadAndSet "$1" "$fiberName"
    local config=$(chiConfigGetVariableValue "$fiberName")

    # if not all fiber dependencies have been loaded, retry
    while IFS= read -r fiberDep; do
        [[ -z $(chiModuleGetDynamicVariable "$fiberLoadedPrefix" "$fiberDep") ]] && return 1
    done <<< "$(jsonRead "$config" '(.fiberDeps // [])[]')"

    # read chain configs
    while IFS= read -r chainConfig; do
        [[ -z "$chainConfig" ]] && continue

        local chainName=$(jsonReadPath "$chainConfig" key)
        local chainConfigValue=$(jsonReadPath "$chainConfig" value)

        chiConfigSetVariableValue "$fiberName:$chainName" "$chainConfigValue"
    done <<< "$(jsonRead "$config" '(.chainConfig // []) | to_entries[]')"

    chiModuleLoadToolConfigs "$fiberName"
    chiModuleCheckToolStatus "$fiberName"
    if ! chiModuleCheckToolDepsMet "$fiberName"; then
        chiLog "tool dependencies unmet, not loading!" "$fiberName"
        return 1
    fi

    chiLoadDir "$1"/chains/*.sh
    chiChainLoadNested "$fiberName" "$1"/chains

    # zsh helpers only loaded on zsh shells
    if [[ -n "$ZSH_VERSION" ]]; then
        chiLoadDir "$1"/**/*.zsh(N)
    fi
    
    chiModuleSetDynamicVariable "$CHI_FIBER_PATH_PREFIX" "$fiberName" "$1"
    chiModuleSetDynamicVariable "$fiberLoadedPrefix" "$fiberName" true
}

function chiChainLoadNested() {
    requireArg "a fiber name" "$1" || return 1
    requireDirectoryArg "chain directory" "$2" || return 1

    for chain in $(find "$2" -maxdepth 1 -type d -not -path "$2"); do
        chiChainLoad "$1" "$chain"
    done
}

function chiChainLoad() {
    requireArg "a fiber name" "$1" || return 1
    requireDirectoryArg "chain directory" "$2" || return 1

    local chainName=$(basename "$2")
    local moduleName="$1:$chainName"
    local chainLoadedVariablePrefix="${CHI_FIBER_PREFIX}_CHAIN_LOADED"

    # if already loaded, return
    [[ -n $(chiModuleGetDynamicVariable "$chainLoadedVariablePrefix" "$moduleName") ]] && return 0

    local chainConfig=$(chiModuleConfigRead "$2" "$moduleName")

    # merge inherited config with own
    local inheritedConfig="$(chiConfigGetVariableValue "$moduleName")"
    local mergedConfig=$(jsonMergeDeep "${chainConfig:-"{}"}" "${inheritedConfig:-"{}"}")
    chiConfigSetVariableValue "$moduleName" "$mergedConfig"

    # only load if not disabled
    local enabledValue
    enabledValue=$(chiModuleConfigReadVariablePath "$moduleName" enabled)

    if [[ $? -eq 0 ]] && [[ "$enabledValue" == "false" ]]; then
        # chiLog "chain disabled, not loading!" "$moduleName"
        return 1
    fi

    chiModuleLoadToolConfigs "$moduleName"
    chiModuleCheckToolStatus "$moduleName"
    if ! chiModuleCheckToolDepsMet "$moduleName"; then
        chiLog "missing tool dependencies, not loading!" "$moduleName"
        return 1
    fi

    local chainInitScriptPath="$2/$chainName-init.sh"
    if [[ -f "$chainInitScriptPath" ]]; then
        source "$chainInitScriptPath"
        [[ $? -eq 0 ]] || return 0
    fi

    chiLoadDir $(find "$2" -type f -name '*.sh' -not -path "$chainInitScriptPath")

    chiModuleSetDynamicVariable "$CHI_FIBER_PATH_PREFIX" "$moduleName" "$2"
    chiModuleSetDynamicVariable "$chainLoadedVariablePrefix" "$moduleName" true
}

function chiChainShouldLoad() {
    requireArg "a fiber name" "$1" || return 1
    requireArg "a chain name" "$2" || return 1

    local fiberName=$1
    local chainName=$2
    shift; shift

    local returnConfig
    if [[ "$1" == "return-config" ]]; then
        returnConfig=true
        shift
    fi

    local chainConfig
    chainConfig=$(chiConfigChainRead ${2:-$chainName})
    local chainConfigLoadReturn=$?

    # merge inherited config with own
    local inheritedConfig="$(chiConfigGetVariableValue "$fiberName:$chainName")"
    local mergedConfig=$(jsonMergeDeep "$chainConfig" "$inheritedConfig")
    
    isSet "$returnConfig" && echo "$mergedConfig"

    [[ $chainConfigLoadReturn -eq 0 ]] || return 1
    chiChainCheckEnabled "$mergedConfig" loaded || return 1
    chiFiberDepdenciesChainCheckTools "$fiberName" "$chainName" || return 1
}

function chiDotfilesDependenciesCheckToolStatus() {
    chiModuleCheckToolStatus "$CHI_DOTFILES_DIR" dotfiles
}
