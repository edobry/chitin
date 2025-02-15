export CHI_MODULE_PREFIX="CHI_MODULE"
export CHI_MODULE_PATH_PREFIX="${CHI_MODULE_PREFIX}_PATH"
export CHI_MODULE_LOADED_PREFIX="${CHI_MODULE_PREFIX}_LOADED"

function chiModuleGetDynamicVariable() {
    requireArg "a variable prefix" "$1" || return 1
    requireArg "a module name" "$2" || return 1
    
    chiReadDynamicVariable "$(chiMakeDynamicVariableName "$1" "$2")"
}

function chiModuleMakeModuleNameVariableName() {
    requireArg "at least one module name segment" "$1" || return 1

    chiMakeDynamicVariableName "$CHI_MODULE_NAME_PREFIX" $@
}

function chiModuleVariableNameToName() {
    requireArg "a module variable name" "$1" || return 1

    sed 's/_/-/g' <<< "$1"
}

function chiModuleDependenciesGetRequiredTools() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool type" "$2" || return 1

    chiModulesGetRequiredTools $(chiConfigGetVariableValue "$1") "$2"
}

function chiModuleGetPath() {
    requireArg "a module name" "$1" || return 1

    chiModuleGetDynamicVariable "$CHI_MODULE_PATH_PREFIX" "$1"
}

function chiFiberPathToName() {
    requireArg "a fiber path" "$1" || return 1

    if [[ "$1" == "$CHI_DIR" ]]; then
        echo "core"
    elif [[ "$1" == "$CHI_DOTFILES_DIR" ]]; then
        echo "dotfiles"
    else
        echo "${$(basename "$1")#chitin-}"
    fi
}

function chiFiberLoadExternal() {
    IFS=$'\n' fibers=($(find "$CHI_PROJECT_DIR" -maxdepth 1 -type d -not -path "$CHI_PROJECT_DIR" -name 'chitin-*'))
    [[ ${#fibers[@]} -gt 0 ]] || return 0
    
    chiFiberLoadExternalLoop $*"${fibers[@]}"
}

function chiFiberLoadExternalLoop() {
    local isNoCheck=''
    if [[ "$1" == "nocheck" ]]; then
        isNoCheck="$1"; shift
    fi

    requireArg "at least one fiber" "$1" || return 1

    local fibers=("$@")
    local retryList=()

    for fiber in "${fibers[@]}"; do
        # echo "loading fiber: $fiber"
        if ! chiFiberLoad "$fiber" "$isNoCheck"; then
        # echo "loading fiber failed, retrying"
            retryList+=("$fiber")
        else
            # echo "fiber loaded: $fiber"
        fi
    done

    # if not all fibers loaded, retry
    if [[ ${#retryList[@]} -gt 0 ]]; then
        # echo "retrying: ${retryList[@]}"
        chiFiberLoadExternalLoop "$isNoCheck${retryList[@]}"
    fi
}

function chiShellReload() {
    requireArg "at least one fiber name" "$1" || return 1

    local fibers=("$@")
    for fiber in "${fibers[@]}"; do
        local fiberPath="$(chiModuleGetPath "$fiber")"
        [[ -z "$fiberPath" ]] && continue

        unset "$(chiMakeDynamicVariableName "$CHI_MODULE_LOADED_PREFIX" "$fiber")"
        for var in $(env | grep "^${CHI_MODULE_LOADED_PREFIX}_${fiber}_" | cut -d= -f1); do
            unset "$var"
        done
        
        chiFiberLoad "$fiberPath" "$fiber" "nocheck"
    done
}

export CHI_MODULE_NAME_PREFIX="CHI_MODULE_NAME"

function chiFiberLoad() {
    requireDirectoryArg "fiber directory" "$1" || return 1

    local fiberName="${2:-$(chiFiberPathToName "$1")}"

    chiLogDebug "loading fiber..." "$fiberName"

    chiSetDynamicVariable "$fiberName" "$CHI_MODULE_NAME_PREFIX" "$fiberName"

    # if already loaded, return
    [[ -n $(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "$fiberName") ]] && return 0

    chiModuleUserConfigMergeFromFile "$1" "$fiberName"

    chiConfigModuleMergeFromFile "$1" "$fiberName"
    local config="$(chiConfigGetVariableValue "$fiberName")"

    local enabledValue
    enabledValue="$(chiConfigUserRead "$fiberName" enabled)"

    if [[ $? -eq 0 ]] && [[ "$enabledValue" == "false" ]]; then
        return 0
    fi

    chiModuleLoadToolConfigs "$fiberName"

    local fiberDeps="$(jsonRead "$config" '(.fiberDeps // [])[]')"

    # if not all fiber dependencies have been loaded, retry
    if [[ -n "$fiberDeps" ]]; then
        while IFS= read -r fiberDep; do
            [[ -z $(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "$fiberDep") ]] && return 1
        done <<< "$fiberDeps"
    fi

    chiConfigChainMerge "$config" "$fiberName"

    if [[ "$3" != "nocheck" ]]; then
        if ! chiModuleCheckTools "$fiberName"; then
            chiLogError "missing tool dependencies, not loading!" "$fiberName"
            return 1
        fi
    fi

    chiChainLoadNested "$fiberName" "$1"/chains
    
    chiSetDynamicVariable "$1" "$CHI_MODULE_PATH_PREFIX" "$fiberName"
    chiSetDynamicVariable true "$CHI_MODULE_LOADED_PREFIX" "$fiberName"
}

function chiChainLoadNested() {
    requireArg "a fiber name" "$1" || return 1
    requireDirectoryArg "chain directory" "$2" || return 1

    for chainPath in $(find "$2" -maxdepth 1 -type f -not -path "$2"); do
        chiChainLoad "$1" "$chainPath" false
    done

    for chainPath in $(find "$2" -maxdepth 1 -type d -not -path "$2"); do
        chiChainLoad "$1" "$chainPath" true
    done
}

function chiChainLoad() {
    requireArg "a fiber name" "$1" || return 1
    requireFileArg "chain path" "$2" || return 1
    requireArg "a boolean indicating whether this is a nested chain" "$3" || return 1

    local fiberName="$1"
    local chainPath="$2"
    local isNestedChain=$3

    local chainName="$($isNestedChain && basename "$chainPath" || fileStripExtension $(basename "$2"))"
    local moduleName="$fiberName:$chainName"

    chiLogDebug "loading chain..." "$moduleName"

    chiSetDynamicVariable "$moduleName" "$CHI_MODULE_NAME_PREFIX" "$fiberName" "$chainName"

    # if already loaded, return
    [[ -n $(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "$moduleName") ]] && return 0

    if $isNestedChain; then
        chiModuleUserConfigMergeFromFile "$(dirname $chainPath)" "$fiberName" "$chainName"
    fi

    local chainConfig="$($isNested && chiConfigModuleReadFromFile "$chainPath" 2>/dev/null || echo "{}")"
    if [[ -n "$chainConfig" ]]; then
        chiConfigMergeVariableValue "$moduleName" "$chainConfig"
    fi

    chiModuleLoadToolConfigs "$moduleName"

    # only load if not disabled
    local enabledValue
    enabledValue="$(chiConfigUserReadModule "$fiberName" "$chainName" enabled)"

    if [[ $? -eq 0 ]] && [[ "$enabledValue" == "false" ]]; then
        chiLogDebug "chain disabled, not loading!" "$moduleName"
        return 1
    fi

    if ! chiModuleCheckTools "$moduleName"; then
        chiLogError "missing tool dependencies, not loading!" "$moduleName"
        return 1
    fi

    if $isNestedChain; then
        local chainInitScriptPath="$chainPath/$chainName-init.sh"
        if [[ -f "$chainInitScriptPath" ]]; then
            source "$chainInitScriptPath" "$moduleName"
            [[ $? -eq 0 ]] || return 0
        fi

        # load all scripts in chain directory
        chiLoadDir $(find "$chainPath" -type f -name '*.sh' -not -path "$chainInitScriptPath")
      
        # zsh chains only loaded on zsh shells
        if [[ -n "$ZSH_VERSION" ]]; then
            chiLoadDir $(find "$chainPath" -type f -name '*.zsh' -not -path "$chainInitScriptPath")
        fi
    else
        chiLoadDir "$chainPath"
    fi

    chiSetDynamicVariable "$2" "$CHI_MODULE_PATH_PREFIX" "$moduleName"
    chiSetDynamicVariable true "$CHI_MODULE_LOADED_PREFIX" "$moduleName"
}

function chiModuleGetName() {
    requireArg "a module path" "$1" || return 1

    local modulePath="$1"
    local moduleDir="$(dirname "$modulePath")"
    
    local fiberName="$(chiFiberPathToName "${moduleDir%/chains*}")"
    local fiberPath="$(chiReadDynamicVariable "${CHI_MODULE_PATH_PREFIX}_{$fiberName}")"

    local searchPath="$([[ "$(basename "$moduleDir")" == "chains" ]] && echo "$modulePath" || echo "$moduleDir")"

    # check all the $CHI_MODULE_PATH_* vars for one that contains the module path
    for var in $(env | grep -o "^${CHI_MODULE_PATH_PREFIX}.*=${searchPath}"); do
        local varName="${var%%=*}"
        local fiberVariableName="${varName#"${CHI_MODULE_PATH_PREFIX}"_}"
        local chainVariableName="${fiberVariableName#"${fiberName}_"}"
        
        echo "${fiberName}:$(chiModuleVariableNameToName "$chainVariableName")"
    done
}
