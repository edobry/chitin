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

    chiDependenciesToolsGetRequired $(chiConfigGetVariableValue "$1") "$2"
}

function chiFiberLoad() {
    requireDirectoryArg "fiber directory" "$1" || return 1

    local fiberName=${2:-${$(basename "$1")#chitin-}}
    local fiberLoadedVariablePrefix="CHI_FIBER_LOADED"

    # if already loaded, return
    if [[ -n $(chiModuleGetDynamicVariable "$fiberLoadedVariablePrefix" "$fiberName") ]]; then
        # echo "fiber "$fiberName" already loaded!"
        return 0
    fi

    chiModuleConfigRead "$1" "$fiberName"
    local deps=$(chiConfigGetVariableValue "$fiberName")

    # if not all fiber dependencies have been loaded, retry
    echo "$deps" | jq -r '(.fiberDeps // [])[]' | \
    while IFS= read -r fiberDep; do
        # chiLog "checking fiber dep '$fiberDep'" "$fiberName"
        [[ -z $(chiModuleGetDynamicVariable "$fiberLoadedVariablePrefix" "$fiberDep") ]] && return 1
    done


    chiDependenciesCheckModuleTools "$fiberName"
    if ! chiDependenciesCheckModuleToolsMet "$fiberName"; then
        chiLog "tool dependencies unmet, not loading!" "$fiberName"
        return 1
    fi

    chiLoadDir "$1"/chains/*.sh
    chiChainLoadNested "$fiberName" "$1"/chains

    # zsh helpers only loaded on zsh shells
    if [[ -n "$ZSH_VERSION" ]]; then
        chiLoadDir "$1"/**/*.zsh(N)
    fi

    chiModuleSetDynamicVariable "$fiberLoadedVariablePrefix" "$fiberName" true
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
    local chainLoadedVariablePrefix="CHI_FIBER_CHAIN_LOADED"

    # if already loaded, return
    if [[ -n $(chiModuleGetDynamicVariable "$chainLoadedVariablePrefix" "$moduleName") ]]; then
        # echo "chain $2 already loaded!"
        return 0
    fi

    # if the chain doesnt have its own config file, look for a `chainConfig` in the fiber config
    if ! chiModuleConfigRead "$2" "$moduleName"; then
        local chainConfig=$(chiModuleConfigReadVariablePath "$1" chainConfig "$chainName")

        if [[ -n "$chainConfig" ]]; then
            chiConfigSetVariableValue "$moduleName" "$chainConfig"
        fi
    fi

    local enabledValue
    enabledValue=$(chiModuleConfigReadVariablePath "$moduleName" enabled)

    if [[ $? -eq 0 ]] && [[ "$enabledValue" == "false" ]]; then
        # chiLog "chain disabled, not loading!" "$moduleName"
        return 1
    fi

    chiDependenciesCheckModuleTools "$moduleName"
    if ! chiDependenciesCheckModuleToolsMet "$moduleName"; then
        chiLog "missing tool dependencies, not loading!" "$moduleName"
        return 1
    fi

    local chainInitScriptPath="$2/$chainName-init.sh"
    if [[ -f "$chainInitScriptPath" ]]; then
        source "$chainInitScriptPath"
        [[ $? -eq 0 ]] || return 0
    fi

    chiLoadDir $(find "$2" -type f -name '*.sh' -not -path "$chainInitScriptPath")

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
    
    isSet "$returnConfig" && echo "$chainConfig"

    [[ $chainConfigLoadReturn -eq 0 ]] || return 1
    chiChainCheckEnabled "$chainConfig" loaded || return 1
    chiFiberDepdenciesChainCheckTools "$fiberName" "$chainName" || return 1
}

function chiDotfilesDependenciesCheckTools() {
    chiDependenciesCheckModuleTools "$CHI_DOTFILES_DIR" dotfiles
}
