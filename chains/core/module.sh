export CHI_MODULE_PREFIX="CHI_MODULE"
export CHI_MODULE_PATH_PREFIX="${CHI_MODULE_PREFIX}_PATH"
export CHI_MODULE_TOOLS_PREFIX="${CHI_MODULE_PREFIX}_TOOLS"
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
    chiSnapshotRecordInput f "$CHI_PROJECT_DIR"

    if [[ -n "$CHI_DOTFILES_DIR" ]]; then
        chiFiberLoad "$CHI_DOTFILES_DIR"
    fi

    # read the sibling list line by line. The previous prefix assignment on a plain
    # array assignment (`IFS=$'\n' fibers=(...)`) left IFS changed for the whole shell,
    # and the array leaked as a global (audit defect B23)
    local fibers=()
    local fiber
    while IFS= read -r fiber; do
        [[ -n "$fiber" ]] && fibers+=("$fiber")
    done < <(find "$CHI_PROJECT_DIR" -maxdepth 1 -type d -not -path "$CHI_PROJECT_DIR" -name 'chitin-*')
    [[ ${#fibers[@]} -gt 0 ]] || return 0

    chiFiberLoadExternalLoop "${fibers[@]}"
}

function chiFiberLoadExternalLoop() {
    requireArg "at least one fiber" "$1" || return 1

    local fibers=("$@")
    local retryList=()
    local fiber

    for fiber in "${fibers[@]}"; do
        if ! chiFiberLoad "$fiber"; then
            retryList+=("$fiber")
        fi
    done

    [[ ${#retryList[@]} -gt 0 ]] || return 0

    # a fiber that failed only because a dependency had not loaded yet succeeds on a
    # later pass. One whose dependency can never load (missing, disabled, misspelled)
    # used to make this recurse forever and hang shell login; stop once a pass loads
    # nothing, say why, and let the shell finish starting without those fibers
    if [[ ${#retryList[@]} -eq ${#fibers[@]} ]]; then
        for fiber in "${retryList[@]}"; do
            local unmetDeps="$(chiFiberGetUnmetDeps "$fiber" | tr '\n' ' ')"
            local reason="see errors above"
            [[ -n "$unmetDeps" ]] && reason="unmet fiberDeps: ${unmetDeps% }"
            chiLogError "giving up on fiber: $reason" "$(chiFiberPathToName "$fiber")"
        done
        # the errors above are the outcome; the shell must still finish starting, also
        # when CHI_FAIL_ON_ERROR has set -e in effect
        return 0
    fi

    chiFiberLoadExternalLoop "${retryList[@]}"
}

# prints the fiberDeps of the given fiber that are not loaded, one per line
function chiFiberGetUnmetDeps() {
    requireArg "a fiber path" "$1" || return 1

    local config="$(chiConfigGetVariableValue "$(chiFiberPathToName "$1")")"
    [[ -z "$config" ]] && return 0

    local dep
    while IFS= read -r dep; do
        [[ -z "$dep" ]] && continue
        [[ -z $(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "$dep") ]] && echo "$dep"
    done <<< "$(jsonRead "$config" '(.fiberDeps // [])[]')"
}

export CHI_MODULE_NAME_PREFIX="CHI_MODULE_NAME"

function chiFiberLoad() {
    requireDirectoryArg "fiber directory" "$1" || return 1

    chiSnapshotRecordInput f "$1"
    chiSnapshotRecordInput f "$1/$CHI_CONFIG_MODULE_FILE_NAME"
    chiSnapshotRecordInput f "$1/$CHI_CONFIG_USER_FILE_NAME"
    chiSnapshotRecordInput f "$1/chains"
    chiSnapshotRecordRepoHead "$1"

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

    chiToolsLoad "$fiberName"

    chiModuleCheckToolsAndDeps "$fiberName" || return 1

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

    if $isNestedChain; then
        chiSnapshotRecordInput f "$chainPath"
        chiSnapshotRecordInput f "$chainPath/$CHI_CONFIG_MODULE_FILE_NAME"
        chiSnapshotRecordInput f "$chainPath/$CHI_CONFIG_USER_FILE_NAME"
    else
        chiSnapshotRecordInput e "$chainPath"
    fi

    local chainName="$($isNestedChain && basename "$chainPath" || fileStripExtension $(basename "$2"))"
    local moduleName="$fiberName:$chainName"

    chiLogDebug "loading $($isNestedChain && echo "nested " || echo '')chain..." "$moduleName"

    chiSetDynamicVariable "$moduleName" "$CHI_MODULE_NAME_PREFIX" "$fiberName" "$chainName"

    if [[ -n $(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "$moduleName") ]]; then
        chiLogDebug "chain already loaded, skipping!" "$moduleName"
        return 0
    fi

    if $isNestedChain; then
        chiModuleUserConfigMergeFromFile "$chainPath" "$fiberName" "$chainName"
    fi

    local chainConfig="$($isNestedChain && chiConfigModuleReadFromFile "$chainPath" 2>/dev/null || echo "{}")"
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

    chiToolsLoad "$moduleName"

    chiModuleCheckToolsAndDeps "$moduleName" || return 1

    if $isNestedChain; then
        local chainInitScriptPath="$chainPath/$chainName-init.sh"
        local chainInitScript=""
        if [[ -f "$chainInitScriptPath" ]]; then
            chainInitScript="$chainInitScriptPath"
            source "$chainInitScriptPath" "$moduleName"
            if [[ $? -ne 0 ]]; then
                # recorded on its own: replay re-runs the init script and, like here,
                # loads nothing else from this chain
                chiSnapshotRecordChain "$chainInitScript" "$moduleName"
                return 0
            fi
        fi

        # load all scripts in chain directory; zsh chains only on zsh shells. The
        # chain is recorded as one replay unit (see chiSnapshotLoadChain), so the
        # per-file recording in chiLoadDir is suppressed here
        local chainFiles=($(find "$chainPath" -type f -name '*.sh' -not -path "$chainInitScriptPath"))
        if [[ -n "$ZSH_VERSION" ]]; then
            chainFiles+=($(find "$chainPath" -type f -name '*.zsh' -not -path "$chainInitScriptPath"))
        fi

        CHI_SNAPSHOT_GROUPING=true
        chiLoadDir "${chainFiles[@]}"
        CHI_SNAPSHOT_GROUPING=false
        chiSnapshotRecordChain "$chainInitScript" "$moduleName" "${chainFiles[@]}"
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
