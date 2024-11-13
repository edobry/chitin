function chiModuleLoadToolConfigs() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    local config=$(chiConfigGetVariableValue "$moduleName")
    [[ -z "$config" ]] || [[ "$config" == "{}" ]] && return 1
  
    local moduleTools=$(jsonRead "$config" '.tools | to_entries | 
            map(.value += { meta: { definedIn: $module }}) |
        from_entries' --arg module "$moduleName")

    [[ -z "$moduleTools" ]] || [[ "$moduleTools" == 'null' ]] || [[ "$moduleTools" == '{}' ]] && return 0

    export CHI_TOOLS="$(jsonMerge "${CHI_TOOLS:-"{}"}" "$moduleTools")"
}

function chiModuleCheckToolStatus() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    local config=$(chiConfigGetVariableValue "$moduleName")
    [[ -z "$config" ]] && return 1

    local toolsFilterList=$([[ "$#" -gt 0 ]] \
        && echo "$(printf '%s\n' "$@" | jq -R . | jq -cs .)" \
        || echo "[]")
  
    local tools=$(jsonRead "$config" '.tools | 
        if ($toolsFilterList | length) == 0 then . else
            with_entries(select(.key | IN($toolsFilterList[])))
        end' --argjson toolsFilterList "$toolsFilterList")

    [[ -z "$tools" ]] || [[ "$tools" == 'null' ]] || [[ "$tools" == '{}' ]] && return 0

    local toolStatus=('{}')
    while IFS= read -r tool; do
        # echo "tool: $tool"
        toolStatus+=("$(chiToolCheckStatus "$tool")")
    done <<< "$(jsonRead "$tools" 'to_entries[]')"

    chiToolsUpdateStatus "${toolStatus[@]}"
}

function chiModuleCheckToolDepsMet() {
    requireArg "a module name" "$1" || return 1

    local moduleName="$1"
    local config=$(chiConfigGetVariableValue "$moduleName")

    [[ -z "$config" ]] && return 0

    local toolDepsList=$(jsonRead "$config" '(.toolDeps // empty)[]')
    [[ -z "$toolDepsList" ]] && return 0

    local toolDepsMet=0
    
    local toolsToInstall=()
    
    while read -r dep; do
        # echo "dep: $dep"

        local depStatus=$(chiToolsGetStatus "$dep")
        if [[ -z "$depStatus" ]]; then
            chiLog "no tool status found for '$dep'!" "$moduleName"
            toolDepsMet=1
            continue
        fi

        if ! jsonCheckBoolPath "$depStatus" installed; then
            chiLog "$dep not installed!" "$moduleName"

            toolsToInstall+=("$dep")
        elif ! jsonCheckBoolPath "$depStatus" validVersion; then
            chiLog "$dep version not valid!" "$moduleName"
            toolDepsMet=1
        fi
    done < <(echo "$toolDepsList")

    [[ "${#toolsToInstall[@]}" -eq 0 ]] && return $toolDepsMet

    local installToolDeps=$(chiModuleConfigReadVariablePath "$moduleName" installToolDeps)
    [[ "$installToolDeps" != "true" ]] && return $toolDepsMet

    local installedTools=()
    local brewToolsToInstall=()

    for tool in "${toolsToInstall[@]}"; do
        local toolConfig=$(chiToolsGetConfig "$tool")
        if [[ -z "$toolConfig" ]]; then
            chiLog "tool config not found for '$tool'!" "$moduleName"
            continue
        fi

        local toolEntry=$(echo "$toolConfig" | jq -c --arg name "$tool" '{ key: $name, value: . }')
        installedTools+=("$tool")

        if jsonReadPath "$toolConfig" brew &>/dev/null; then
            brewToolsToInstall+=("$toolEntry")
        elif jsonReadPath "$toolConfig" git &>/dev/null; then
            chiToolsInstallGit "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" command &>/dev/null; then
            chiToolsInstallCommand "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" script &>/dev/null; then
            chiToolsInstallScript "$moduleName" "$tool" "$toolConfig"
        elif jsonReadPath "$toolConfig" artifact &>/dev/null; then
            chiToolsInstallArtifact "$moduleName" "$tool" "$toolConfig"
        else
            chiLog "no install method found for '$tool'!" "$moduleName"
        fi
    done

    if [[ "${#brewToolsToInstall[@]}" -gt 0 ]]; then
        chiToolsInstallBrew "$moduleName" "${brewToolsToInstall[@]}"
    fi

    # check again after installing
    chiModuleCheckToolStatusAndDepsMet "$moduleName" "${installedTools[@]}"
}

function chiModuleCheckToolStatusAndDepsMet() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    chiModuleCheckToolStatus "$moduleName" "$@"
    chiModuleCheckToolDepsMet "$moduleName"
}

function chiModulesGetRequiredTools() {
    requireArg "a config JSON string" "$1" || return 1
    requireArg "a tool type" "$2" || return 1

    echo "$1" | jq -c --arg type "$2" '.tools | to_entries[] |
        select((.value.optional // false) == false) |
        select(.value | has($type))'
}
