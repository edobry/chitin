function chiDependenciesRead() {
    requireDirectoryArg "a directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    local fileContents
    fileContents=$(chiConfigConvertAndReadFile "$1" "dependencies")
    [[ $? -eq 0 ]] || return 1

    chiDependenciesSetVariableValue "$2" "$fileContents"
}

export CHI_DEPS_VARIABLE_PREFIX="CHI_DEPS"

function chiDependenciesGetVariableValue() {
    requireArg "a module name" "$1" || return 1

    chiModuleGetDynamicVariable "$CHI_DEPS_VARIABLE_PREFIX" "$1"
}

function chiDependenciesReadVariablePath() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift;

    jsonReadPath "$(chiDependenciesGetVariableValue "$moduleName")" $*
}

function chiDependenciesSetVariableValue() {
    requireArg "a module name" "$1" || return 1
    requireArg "a dependencies JSON string" "$2" || return 1

    chiModuleSetDynamicVariable "$CHI_DEPS_VARIABLE_PREFIX" "$1" "$2"
}

function chiDependenciesGetToolStatus() {
    requireArg "a tool name" "$1" || return 1
    
    [[ -z "$CHI_TOOL_STATUS" ]] && return 1
    echo "$CHI_TOOL_STATUS" | jq -ce --arg dep "$1" '.[$dep] // empty'
}

function chiDependenciesShowToolStatus() {
    jsonRead "$CHI_TOOL_STATUS" 'to_entries[] | "\(.key) - installed: \(.value.installed), valid: \(.value.validVersion)"'
}

function chiDependenciesCheckToolInstalled() {
    requireArg "a module name" "$1" || return 1
    requireArg "a dep JSON string" "$2" || return 1

    local moduleName="$1"
    local dep="$2"

    local depName=$(jsonRead "$dep" '.key')

    # echo "checking $depName..."

    # check order:
    #
    # if a checkCommand is set, use that
    # if its a brew dep,
    #   if its a cask, use `brewCheck`
    #   if checkBrew is set, use `brewCheck`
    # else, use `checkCommand` with the dep name
    
    local checkCommandValue
    checkCommandValue=$(jsonReadPath "$dep" value checkCommand 2>/dev/null)
    local checkCommandExit=$?
    
    local checkBrew
    jsonCheckBoolPath "$dep" value checkBrew &>/dev/null && checkBrew=true || checkBrew=false

    if [[ -n "$checkCommandValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkCommand' and 'checkBrew' set for '$depName'!" "$moduleName"
            return 1
        fi
        
        return $(checkCommand $([[ "$checkCommandValue" == "true" ]] \
            && echo "$depName" \
            || echo "$checkCommandValue"))
    fi

    local isBrew=false
    local brewConfig
    brewConfig=$(jsonReadPath "$dep" value brew 2>/dev/null)
    [[ $? -eq 0 ]] && isBrew=true

    # echo "isBrew: $isBrew"
    # echo "brewConfig: $brewConfig"

    if $isBrew; then
        # echo "in isBrew"
        if [[ -z "$brewConfig" ]]; then
            chiLog "expected brew config not found for '$depName'!" "$moduleName"
            return 1
        fi

        if jsonCheckBoolPath "$brewConfig" cask &>/dev/null; then
            # echo "running brew check cask"
            return $(brewCheckCask "$depName")
        fi

        # echo "checkBrew: $checkBrew"

        if $checkBrew; then
            # echo "running brew check formula"
            return $(brewCheckFormula "$depName")
        fi
        # echo "brew done"
    fi

    checkCommand "$depName"
}

function chiDependenciesCheckTools() {
    requireArg "a module name" "$1" || return 1

    local moduleName="$1"
    local deps=$(chiDependenciesGetVariableValue "$moduleName")

    [[ -z "$deps" ]] && return 0

    local depsList=$(jsonRead "$deps" '(.tools // []) | to_entries[]')
    [[ -z "$depsList" ]] && return 0

    local toolStatus=()
    while read -r dep; do
        # echo "dep: $dep"
        local depName=$(jsonRead "$dep" '.key')
        local expectedVersion=$(jsonRead "$dep" '.value.version // empty')
        local versionCommand=$(jsonRead "$dep" '.value.versionCommand // empty')

        local installed="false"
        local validVersion="false"

        if ! chiDependenciesCheckToolInstalled "$moduleName" "$dep" && ! jsonCheckBoolPath "$dep" value optional; then
            chiLog "'$depName' not installed!" "$moduleName"
        elif [[ -z "$versionCommand" ]]; then
            installed="true"
            validVersion="true"
        elif [[ -z "$expectedVersion" ]]; then
            chiLog "expected version not set for $depName!" "$moduleName"
            installed="true"
        else
            # echo "checking version for $depName"
            # echo "version command: $versionCommand"
            local currentVersion=$(eval "$versionCommand")
            
            if checkVersionAndFail "$depName" "$expectedVersion" "$currentVersion"; then
                installed="true"
                validVersion="true"
            else
                installed="true"
            fi
        fi

        toolStatus+=("$(chiMakeToolStatus $depName $installed $validVersion)")
    done < <(echo "$depsList")

    local moduleToolStatus=$(jsonMerge $toolStatus '{}')
    local globalToolStatus=$(jsonMerge "${CHI_TOOL_STATUS:-"{}"}" "$moduleToolStatus" "{}")

    chiModuleSetDynamicVariable "CHI_TOOL_STATUS" "$moduleName" "$moduleToolStatus"
    export CHI_TOOL_STATUS="$globalToolStatus"
}

function chiMakeToolStatus() {
    requireArg "a tool name" "$1" || return 1
    requireArg "installed" "$2" || return 1
    requireArg "validVersion" "$3" || return 1

    jq -nc --arg depName "$1" --argjson installed "$2" --argjson validVersion "$3" '{ ($depName): { installed: $installed, validVersion: $validVersion } }'
}

function chiDependenciesCheckToolsMet() {
    requireArg "a module name" "$1" || return 1

    local deps=$(chiDependenciesGetVariableValue "$1")

    [[ -z "$deps" ]] && return 0

    local toolDepsList=$(jsonRead "$deps" '(.toolDeps // empty)[]')
    [[ -z "$toolDepsList" ]] && return 0

    local toolDepsMet=0
    
    while read -r dep; do
        # echo "dep: $dep"

        local depToolStatus=$(chiDependenciesGetToolStatus "$dep")
        if [[ -z "$depToolStatus" ]]; then
            chiLog "no tool status found for '$dep'!" "$1"
            toolDepsMet=1
            continue
        fi

        # echo "$depToolStatus"
        
        if ! jsonCheckBoolPath "$depToolStatus" installed; then
            chiLog "$dep not installed!" "$1"
            toolDepsMet=1
        elif ! jsonCheckBoolPath "$depToolStatus" validVersion; then
            chiLog "$dep version not valid!" "$1"
            toolDepsMet=1
        fi
        set +x
    done < <(echo "$toolDepsList")

    return $toolDepsMet
}

function chiDependenciesToolsGetRequired() {
    requireArg "a dependencies JSON string" "$1" || return 1
    requireArg "a tool type" "$2" || return 1

    echo "$1" | jq -c --arg type "$2" '.tools | to_entries[] |
        select((.value.optional // false) == false) |
        select(.value | has($type))'
}
