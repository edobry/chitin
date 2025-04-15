function chiModuleLoadToolConfigs() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    local config="$(chiConfigGetVariableValue "$moduleName")"
    [[ -z "$config" ]] || [[ "$config" == "{}" ]] && return 1
  
    local moduleTools="$(jsonRead "$config" '(.tools // {}) | to_entries | 
            map(.value += { meta: { definedIn: $module }}) |
        from_entries' --arg module "$moduleName")"

    [[ -z "$moduleTools" ]] || [[ "$moduleTools" == 'null' ]] || [[ "$moduleTools" == '{}' ]] && return 0

    chiSetDynamicVariable "$(echo "$moduleTools" | jq -c 'to_entries[]')" "$CHI_MODULE_TOOLS_PREFIX" "$moduleName"
    export CHI_TOOLS="$(jsonMerge "${CHI_TOOLS:-"{}"}" "$moduleTools")"
}

function chiModuleCheckToolsAndDeps() {
    requireArg "a module name" "$1" || return 1

    [[ "$CHI_TOOLS_CHECK_ENABLED" == "true" ]] || return 0

    chiLogDebug "checking tools..."  "$1"
    
    if [[ -n "$CHI_CACHE_TOOLS_REBUILD" ]]; then
        chiLogInfo "building tool status cache..." "$1"
        chiToolsCheckAndUpdateStatus "$(chiGetDynamicVariable "$CHI_MODULE_TOOLS_PREFIX" "$1")"
    fi

    if ! chiModuleCheckToolDepsMet "$1"; then
        chiLogError "missing tool dependencies, not loading!" "$1"
        return 1
    fi
    
    chiLogDebug "tools checked" "$1"
}

function chiModuleCheckToolDepsMet() {
    requireArg "a module name" "$1" || return 1

    local moduleName="$1"
    local toolDepsList="$(chiModuleConfigReadVariablePath "$moduleName" toolDeps | jq -r '.[]')"
    [[ -z "$toolDepsList" ]] && return 0

    local toolDepsMet=0
    
    local toolsToInstall=()
    
    while read -r toolDep; do
        chiLogDebug "checking toolDep: $toolDep..." "$moduleName"

        local toolDepStatus="$(chiToolsGetStatus "$toolDep")"
        if [[ -z "$toolDepStatus" ]]; then
            local toolConfig="$(chiToolsGetConfig "$toolDep")"
            
            # the tool config might have been defined in a disabled module
            # TODO: rethink this
            if [[ -n "$toolConfig" ]]; then
                # echo "checking status for $toolDep on-demand..." >&2
                chiToolsCheckAndUpdateStatus "$(jsonToEntry "$toolDep" "$toolConfig")"
                toolDepStatus="$(chiToolsGetStatus "$toolDep")"
            else
                chiLogInfo "no tool status found for '$toolDep'!" "$moduleName"
                toolDepsMet=1
                continue
            fi
        fi

        if ! jsonCheckBool "$toolDepStatus" installed; then
            chiLogInfo "$toolDep not installed!" "$moduleName"

            toolsToInstall+=("$toolDep")
        elif ! jsonCheckBool "$toolDepStatus" validVersion; then
            chiLogInfo "$toolDep version not valid!" "$moduleName"
            toolDepsMet=1
        fi
    done < <(echo "$toolDepsList")

    [[ "${#toolsToInstall[@]}" -eq 0 ]] && return $toolDepsMet

    local installToolDeps="$(chiConfigUserRead core installToolDeps)"
    [[ "$installToolDeps" != "true" ]] && return $toolDepsMet

    chiModuleInstallTools "$moduleName" "${toolsToInstall[@]}"
}

function chiModuleInstallTools() {
    requireArg "a module name" "$1" || return 1
    requireArg "at least one tool name" "$2" || return 1

    local moduleName="$1"; shift
    local toolsToInstall=("$@")

    local installedTools=()
    local brewToolsToInstall=()

    for tool in "${toolsToInstall[@]}"; do
        local toolConfig="$(chiToolsGetConfig "$tool")"
        if [[ -z "$toolConfig" ]]; then
            chiLogInfo "tool config not found for '$tool'!" "$moduleName"
            continue
        fi

        local toolEntry="$(jsonToEntry "$tool" "$toolConfig")"
        installedTools+=("$toolEntry")

        if jsonReadPath "$toolConfig" brew &>/dev/null; then
            brewToolsToInstall+=("$toolEntry")
            continue
        elif jsonReadPath "$toolConfig" pipx &>/dev/null; then
            chiToolsInstallPipx "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" git &>/dev/null; then
            chiToolsInstallGit "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" command &>/dev/null; then
            chiToolsInstallCommand "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" script &>/dev/null; then
            chiToolsInstallScript "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" artifact &>/dev/null; then
            chiToolsInstallArtifact "$moduleName" "$tool" "$toolConfig"
        else
            chiLogInfo "no install method found for '$tool'!" "$moduleName"
            continue
        fi

        chiToolsRunPostInstall "$moduleName" "$tool" "$toolConfig"
        chiGenerateCompletion "$tool" "$toolConfig"
    done

    if [[ "${#brewToolsToInstall[@]}" -gt 0 ]]; then
        chiToolsInstallBrew "$moduleName" "${brewToolsToInstall[@]}"
    fi

    # check again after installing
    if [[ "${#installedTools[@]}" -gt 0 ]]; then
        chiLogDebug "checking post-install: ${installedTools[*]}..." "$moduleName"

        chiToolsLoad "$moduleName" "$installedTools"
        chiToolsCheckAndUpdateStatus "$installedTools"
        chiModuleCheckToolDepsMet "$moduleName"
    fi
}
