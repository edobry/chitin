function chiToolsGetConfig() {
    requireArg "a tool name" "$1" || return 1
    
    [[ -z "$CHI_TOOLS" ]] && return 1
    echo "$CHI_TOOLS" | jq -ce --arg tool "$1" '.[$tool] // empty'
}

function chiToolsLoad() {
    requireArg "a module name" "$1" || return 1
    requireJsonArg "at least one tool config entry" "$2" || return 1

    local moduleName="$1"; shift

    chiLogDebug "loading tools..." "$moduleName"

    echo "$*" | jq -sc '.[] | select(.value.artifact != null or .value.sourceScript != null)' | while read -r toolEntry; do
        # local toolName="$(jsonReadPath "$toolEntry" key)"
        local toolConfig="$(jsonReadPath "$toolEntry" value)"

        # if its an executable artifact, add its dir to the PATH
        local artifactConfig="$(jsonReadPath "$toolConfig" artifact 2>/dev/null)"
        if [[ -n "$artifactConfig" ]] && jsonCheckBool "$artifactConfig" isExec 2>/dev/null; then
            local targetDir="$(chiToolsArtifactMakeTargetDir "$artifactConfig")"
            chiToolsAddDirToPath "$targetDir"
            continue
        fi

        # if it has a sourceScript field set, source it
        local sourceScript="$(jsonReadPath "$toolConfig" sourceScript 2>/dev/null)"
        if [[ -n "$sourceScript" ]]; then
            local targetDir="$(chiToolsGitMakeTargetDir "$(jsonReadPath "$toolConfig" git 2>/dev/null)")"
            source "$targetDir/$sourceScript"
        fi
    done

    chiLogDebug "tools loaded" "$moduleName"
}

function chiToolsCheckAndUpdateStatus() {
    requireJsonArg "at least one tool config entry" "$1" || return 1

    local toolStatus=('{}')
    for toolEntry in $@; do
        local toolName="$(jsonReadPath "$toolEntry" key)"
        local toolConfig="$(jsonReadPath "$toolEntry" value)"
        local returnedStatus="$(chiToolsCheckStatus "$toolName" "$toolConfig")"
        
        chiLogDebug "tool status for '$toolName': $returnedStatus" "meta:tools"
        toolStatus+=("$returnedStatus")
    done

    chiToolsUpdateStatus "${toolStatus[@]}"
}

function chiToolsCheckStatus() {
    requireArg "a tool name" "$1" || return 1
    requireJsonArg "a tool config" "$2" || return 1

    local toolName="$1"
    local toolConfig="$2"

    local moduleName="$(jsonReadPath "$toolConfig" meta definedIn)"
    
    local expectedVersion="$(jsonReadPath "$toolConfig" version)"
    local versionCommand="$(jsonReadPath "$toolConfig" versionCommand)"

    local installed="false"
    local validVersion="false"

    chiLogDebug "checking status for '$toolName'..." "meta:tools"

    if chiToolsCheckInstalled "$toolName" "$toolConfig"; then
        if [[ -z "$versionCommand" ]]; then
            installed="true"
            validVersion="true"
        elif [[ -z "$expectedVersion" ]]; then
            chiLog "expected version not set for $toolName!" "$moduleName"
            installed="true"
        else
            local currentVersion="$(eval "$versionCommand")"
            
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

export CHI_CACHE="$(xdgCache)/chitin"
export CHI_CACHE_TOOLS="$CHI_CACHE/tool-status.json"

function chiToolsLoadFromCache() {
    [[ ! -f "$CHI_CACHE_TOOLS" ]] && return 1
    [[ -n "$CHI_TOOL_STATUS" ]] && return 0

    export CHI_TOOL_STATUS="$(cat "$CHI_CACHE_TOOLS")"
}

function chiToolsUpdateStatus() {
    requireArg "at least one tool status JSON string" "$1" || return 1
    local toolStatus=("$@")

    export CHI_TOOL_STATUS="$(jsonMerge "${CHI_TOOL_STATUS:-"{}"}" $toolStatus "{}")"
    
    mkdir -p "$CHI_CACHE"
    echo "$CHI_TOOL_STATUS" > "$CHI_CACHE_TOOLS"
}

function chiToolsGetStatus() {
    requireArg "a tool name" "$1" || return 1
    
    [[ -z "$CHI_TOOL_STATUS" ]] && return 1
    echo "$CHI_TOOL_STATUS" | jq -ce --arg tool "$1" '.[$tool] // empty'
}

function chiToolsShowStatus() {
    jsonRead "$CHI_TOOL_STATUS" 'to_entries[] | "\(.key) - installed: \(.value.installed), valid: \(.value.validVersion)"'
}

function chiToolsCheckInstalled() {
    requireArg "a tool name" "$1" || return 1
    local toolName="$1"; shift

    local tool="$1"
    [[ -z "$tool" ]] && tool="$(chiToolsGetConfig "$toolName")"
    [[ -z "$tool" ]] && return 1

    local moduleName="$(jsonReadPath "$tool" meta definedIn 2>/dev/null)"

    # check order:
    #
    # if a checkCommand is set, use that
    # if its a brew tool,
    #   if its a cask, use `brewCheck`
    #   if checkBrew is set, use `brewCheck`
    # else, use `checkCommand` with the tool name

    local checkCommandValue="$(jsonReadPath "$tool" checkCommand 2>/dev/null)"
    
    local checkBrew
    jsonCheckBool "$tool" checkBrew &>/dev/null && checkBrew=true || checkBrew=false

    local checkPipx
    jsonCheckBool "$tool" checkPipx &>/dev/null && checkPipx=true || checkPipx=false
    
    local checkPathValue
    checkPathValue="$(jsonReadPath "$tool" checkPath 2>/dev/null)"
    
    local checkEvalValue
    checkEvalValue="$(jsonReadPath "$tool" checkEval 2>/dev/null)"

    local checkPath
    jsonCheckBool "$tool" checkPath &>/dev/null && checkPath=true || checkPath=false

    if [[ -n "$checkCommandValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkCommand' and 'checkBrew' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if $checkPipx; then
            chiLog "both 'checkCommand' and 'checkPipx' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if $checkPath; then
            chiLog "both 'checkCommand' and 'checkPath' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if [[ -n "$checkPathValue" ]]; then
            chiLog "both 'checkCommand' and 'checkPath' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if [[ -n "$checkEvalValue" ]]; then
            chiLog "both 'checkCommand' and 'checkEval' set for '$toolName'!" "$moduleName"
            return 1
        fi
        
        return $(checkCommand $([[ "$checkCommandValue" == "true" ]] \
            && echo "$toolName" \
            || echo "$checkCommandValue"))
    elif [[ -n "$checkPathValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkPath' and 'checkBrew' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if $checkPipx; then
            chiLog "both 'checkCommand' and 'checkPipx' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if [[ -n "$checkEvalValue" ]]; then
            chiLog "both 'checkCommand' and 'checkEval' set for '$toolName'!" "$moduleName"
            return 1
        fi

        local gitConfig="$(jsonReadPath "$tool" git 2>/dev/null)"
        if [[ -z "$gitConfig" ]]; then
            chiLog "expected git config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        local target="$(jsonReadPath "$gitConfig" target 2>/dev/null)"

        [[ -f "$(chiExpandPath "$target/$checkPathValue")" ]] && return 0 || return 1
    elif [[ -n "$checkEvalValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkEval' and 'checkBrew' set for '$toolName'!" "$moduleName"
            return 1
        fi

        if $checkPipx; then
            chiLog "both 'checkCommand' and 'checkPipx' set for '$toolName'!" "$moduleName"
            return 1
        fi

        eval "$checkEvalValue" &>/dev/null
        return $?
    fi

    local isBrew=false
    local brewConfig
    brewConfig="$(jsonReadPath "$tool" brew 2>/dev/null)"
    [[ $? -eq 0 ]] && isBrew=true

    local isPipx=false
    local pipxConfig
    pipxConfig="$(jsonReadPath "$tool" pipx 2>/dev/null)"
    [[ $? -eq 0 ]] && isPipx=true

    local isArtifact=false
    local artifactConfig="$(jsonReadPath "$tool" artifact 2>/dev/null)"
    [[ -n "$artifactConfig" ]] && isArtifact=true

    if $isBrew; then
        # echo "in isBrew" >&2
        if [[ -z "$brewConfig" ]]; then
            chiLog "expected brew config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        if jsonCheckBool "$brewConfig" cask &>/dev/null; then
            # echo "running brew check cask"
            return $(brewCheckCask "$toolName")
        fi

        # echo "checkBrew: $checkBrew" >&2

        if $checkBrew; then
            # echo "running brew check formula"
            return $(brewCheckFormula "$toolName")
        fi
        # echo "brew done" >&2
    elif $isPipx; then
        if [[ -z "$pipxConfig" ]]; then
            chiLog "expected pipx config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        if $checkPipx; then
            pipxCheckPackage "$toolName" && return 0 || return 1
        fi
    elif $checkBrew; then
        chiLog "'checkBrew' set for non-brew tool '$toolName'!" "$moduleName"
        return 1
    elif $isArtifact; then
        # echo "in isArtifact" >&2
        if [[ -z "$artifactConfig" ]]; then
            chiLog "expected artifact config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        [[ -f "$(chiToolsArtifactMakeTargetPath "$artifactConfig")" ]] && return 0 || return 1
    fi

    checkCommand "$toolName"
}

function chiToolsMakeStatus() {
    requireArg "a tool name" "$1" || return 1
    requireArg "an installed boolean" "$2" || return 1
    requireArg "a validVersion boolean" "$3" || return 1

    jq -nc --arg tool "$1" --argjson installed "$2" --argjson validVersion "$3" \
        '{ ($tool): {
            installed: $installed,
            validVersion: $validVersion
        } }'
}
