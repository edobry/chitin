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

function chiFiberGetPath() {
    requireArg "a fiber name" "$1" || return 1

    chiModuleGetDynamicVariable "$CHI_FIBER_PATH_PREFIX" "$1"
}

function chiShellReload() {
    requireArg "at least one fiber name" "$1" || return 1

    local fibers=("$@")
    for fiber in "${fibers[@]}"; do
        local fiberPath="$(chiFiberGetPath "$fiber")"
        [[ -z "$fiberPath" ]] && continue

        unset "$(chiModuleMakeDynamicVariableName "$CHI_FIBER_LOADED_PREFIX" "$fiber")"
        for var in $(env | grep "^${CHI_FIBER_CHAIN_LOADED_PREFIX}_${fiber}_" | cut -d= -f1); do
            unset "$var"
        done
        
        chiFiberLoad "$fiberPath" "$fiber" "nocheck"
    done
}

export CHI_FIBER_PREFIX="CHI_FIBER"
export CHI_FIBER_PATH_PREFIX="${CHI_FIBER_PREFIX}_PATH"

function chiFiberLoad() {
    requireDirectoryArg "fiber directory" "$1" || return 1

    local fiberName="${2:-$(chiFiberPathToName "$1")}"

    # echo "loading fiber $fiberName from $1" >&2

    # if already loaded, return
    [[ -n $(chiModuleGetDynamicVariable "$CHI_FIBER_LOADED_PREFIX" "$fiberName") ]] && return 0

    chiModuleConfigMergeFromFile "$1" "$fiberName"
    local config=$(chiConfigGetVariableValue "$fiberName")

    chiModuleLoadToolConfigs "$fiberName"

    # echo "fiber config: $config" >&2

    local fiberDeps="$(jsonRead "$config" '(.fiberDeps // [])[]')"

    # if not all fiber dependencies have been loaded, retry
    if [[ -n "$fiberDeps" ]]; then
        while IFS= read -r fiberDep; do
            # echo "fiberDep: $fiberDep" >&2
            [[ -z $(chiModuleGetDynamicVariable "$CHI_FIBER_LOADED_PREFIX" "$fiberDep") ]] && return 1
        done <<< "$fiberDeps"
    fi

    # read chain configs
    local chainConfig="$(jsonReadPath "$config" chainConfig)"
    [[ -n "$chainConfig" ]] && chiConfigMergeChain "$chainConfig" "$fiberName"

    if [[ "$3" != "nocheck" ]]; then
        if ! chiModuleCheckToolStatusAndDepsMet "$fiberName"; then
            chiLog "missing tool dependencies, not loading!" "$fiberName"
            return 1
        fi
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

    local chainConfig=$(chiModuleConfigReadFromFile "$2" "$moduleName")
    if [[ -n "$chainConfig" ]]; then
        chiConfigMergeVariableValue "$moduleName" "$chainConfig"
    fi

    chiModuleLoadToolConfigs "$moduleName"

    # only load if not disabled
    local enabledValue
    enabledValue=$(chiModuleConfigReadVariablePath "$moduleName" enabled)

    if [[ $? -eq 0 ]] && [[ "$enabledValue" == "false" ]]; then
        # chiLog "chain disabled, not loading!" "$moduleName"
        return 1
    fi

    chiModuleLoadToolConfigs "$moduleName"
    if ! chiModuleCheckToolStatusAndDepsMet "$moduleName"; then
        chiLog "missing tool dependencies, not loading!" "$moduleName"
        return 1
    fi

    local chainInitScriptPath="$2/$chainName-init.sh"
    if [[ -f "$chainInitScriptPath" ]]; then
        source "$chainInitScriptPath" "$moduleName"
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

function chiDotfilesCheckToolStatus() {
    chiModuleCheckToolStatus dotfiles
}
