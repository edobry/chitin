function chiDependenciesCheckModuleTools() {
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

    export CHI_TOOLS="$(jsonMerge "${CHI_TOOLS:-"{}"}" "$tools")"

    local toolStatus=('{}')
    while IFS= read -r tool; do
        # echo "tool: $tool"
        toolStatus+=("$(chiDependenciesCheckTool "$moduleName" "$tool")")
    done <<< "$(jsonRead "$tools" 'to_entries[]')"

    chiDependenciesUpdateToolStatus "$moduleName" "${toolStatus[@]}"
}

function chiDependenciesCheckTool() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool config JSON string" "$2" || return 1

    local moduleName="$1"
    local tool="$2"

    local toolName=$(jsonRead "$tool" '.key')
    local expectedVersion=$(jsonRead "$tool" '.value.version // empty')
    local versionCommand=$(jsonRead "$tool" '.value.versionCommand // empty')

    local installed="false"
    local validVersion="false"

    if \
        ! jsonCheckBoolPath "$tool" value optional &>/dev/null &&
        chiToolsCheckInstalled "$moduleName" "$tool" \
    ; then
        if [[ -z "$versionCommand" ]]; then
            installed="true"
            validVersion="true"
        elif [[ -z "$expectedVersion" ]]; then
            chiLog "expected version not set for $toolName!" "$moduleName" >&2
            installed="true"
        else
            local currentVersion=$(eval "$versionCommand")
            
            if checkVersionAndFail "$toolName" "$expectedVersion" "$currentVersion"; then
                installed="true"
                validVersion="true"
            else
                installed="true"
            fi
        fi
    fi

    chiToolsMakeStatus "$toolName" "$installed" "$validVersion"
}

function chiDependenciesUpdateToolStatus() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    requireArg "at least one tool status JSON string" "$1" || return 1
    local toolStatus=("$@")

    # echo "update tool status: ${toolStatus[@]}"

    local moduleToolStatus=$(jsonMerge $toolStatus '{}')
    local globalToolStatus=$(jsonMerge "${CHI_TOOL_STATUS:-"{}"}" "$moduleToolStatus" "{}")

    # echo "moduleToolStatus: $moduleToolStatus"

    chiModuleSetDynamicVariable "CHI_TOOL_STATUS" "$moduleName" "$moduleToolStatus"
    export CHI_TOOL_STATUS="$globalToolStatus"
}

function chiDependenciesCheckModuleToolsMet() {
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

    # echo "toolsToInstall: ${toolsToInstall[@]}"
    # echo "tooldepsMet: $toolDepsMet"
    # echo "[[ "${#toolsToInstall[@]}" -eq 0 ]]"

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

    # echo "brewToolsToInstall: ${brewToolsToInstall[@]}"
    # echo "gitToolsToInstall: ${gitToolsToInstall[@]}"

    if [[ "${#brewToolsToInstall[@]}" -gt 0 ]]; then
        chiToolsInstallBrew "$moduleName" "${brewToolsToInstall[@]}"
    fi

    # echo "installedTools: $installedTools"

    # check again after installing
    chiDependenciesCheckModuleTools "$moduleName" "${installedTools[@]}"
    chiDependenciesCheckModuleToolsMet "$moduleName"
}

function chiDependenciesToolsGetRequired() {
    requireArg "a config JSON string" "$1" || return 1
    requireArg "a tool type" "$2" || return 1

    echo "$1" | jq -c --arg type "$2" '.tools | to_entries[] |
        select((.value.optional // false) == false) |
        select(.value | has($type))'
}
