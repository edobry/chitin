function chiToolsGetConfig() {
    requireArg "a tool name" "$1" || return 1
    
    [[ -z "$CHI_TOOLS" ]] && return 1
    echo "$CHI_TOOLS" | jq -ce --arg tool "$1" '.[$tool] // empty'
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
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    requireArg "a tool name" "$1" || return 1
    local toolName="$1"; shift

    local tool="$1"
    [[ -z "$tool" ]] && tool=$(chiToolsGetConfig "$toolName")
    [[ -z "$tool" ]] && return 1

    # check order:
    #
    # if a checkCommand is set, use that
    # if its a brew tool,
    #   if its a cask, use `brewCheck`
    #   if checkBrew is set, use `brewCheck`
    # else, use `checkCommand` with the tool name
    
    local checkCommandValue=$(jsonReadPath "$tool" checkCommand 2>/dev/null)
    
    local checkBrew
    jsonCheckBoolPath "$tool" checkBrew &>/dev/null && checkBrew=true || checkBrew=false
    
    local checkPathValue
    checkPathValue=$(jsonReadPath "$tool" checkPath 2>/dev/null)
    
    local checkEvalValue
    checkEvalValue=$(jsonReadPath "$tool" checkEval 2>/dev/null)

    local checkPath
    jsonCheckBoolPath "$tool" checkPath &>/dev/null && checkPath=true || checkPath=false

    if [[ -n "$checkCommandValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkCommand' and 'checkBrew' set for '$toolName'!" "$moduleName"
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

        if [[ -n "$checkEvalValue" ]]; then
            chiLog "both 'checkCommand' and 'checkEval' set for '$toolName'!" "$moduleName"
            return 1
        fi

        local gitConfig=$(jsonReadPath "$tool" git 2>/dev/null)
        if [[ -z "$gitConfig" ]]; then
            chiLog "expected git config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        local target=$(jsonReadPath "$gitConfig" target 2>/dev/null)

        [[ -f "$(expandPath "$target/$checkPathValue")" ]] && return 0 || return 1
    elif [[ -n "$checkEvalValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkEval' and 'checkBrew' set for '$toolName'!" "$moduleName"
            return 1
        fi

        eval "$checkEvalValue" &>/dev/null
        return $?
    fi

    local isBrew=false
    local brewConfig
    brewConfig=$(jsonReadPath "$tool" brew 2>/dev/null)
    [[ $? -eq 0 ]] && isBrew=true

    local isArtifact=false
    local artifactConfig
    artifactConfig=$(jsonReadPath "$tool" artifact 2>/dev/null)
    [[ $? -eq 0 ]] && isArtifact=true

    if $isBrew; then
        # echo "in isBrew" >&2
        if [[ -z "$brewConfig" ]]; then
            chiLog "expected brew config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        if jsonCheckBoolPath "$brewConfig" cask &>/dev/null; then
            # echo "running brew check cask"
            return $(brewCheckCask "$toolName")
        fi

        # echo "checkBrew: $checkBrew" >&2

        if $checkBrew; then
            # echo "running brew check formula"
            return $(brewCheckFormula "$toolName")
        fi
        # echo "brew done" >&2
    elif $checkBrew; then
        chiLog "'checkBrew' set for non-brew tool '$toolName'!" "$moduleName"
        return 1
    elif $isArtifact; then
        # echo "in isArtifact" >&2
        if [[ -z "$artifactConfig" ]]; then
            chiLog "expected artifact config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        [[ -f $(chiToolsArtifactMakeTargetPath "$artifactConfig") ]] && return 0 || return 1
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

# function chiDependenciesInstallTools() {
#     requireDirectoryArg "module directory" "$1" || return 1
#     requireArg "a module name" "$2" || return 1

#     chiModuleConfigRead "$1" "$2"

#     chiToolsInstallBrew "$2"
#     chiToolsInstallGit "$2"
# }

function chiToolsInstallBrew() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    requireArg "a tool config JSON string" "$1" || return 1

    local brewfilePath=$(tempFile)
    local brewfile=$(chiToolsGenerateBrewfile $*)
    echo "$brewfile" > $brewfilePath

    chiLog "installing brew depenedencies..." "$moduleName"
    brew bundle --file="$brewfilePath"
}

function chiToolsGenerateBrewfile() {
    requireArg "a tool name" "$1" || return 1

    echo $* | jq -r '
        (
            if .value.brew.tap then
                "tap \"" + .value.brew.tap + "\"" +
                (
                    if .value.brew.tapUrl then
                        ", \"" + .value.brew.tapUrl + "\""
                    else "" end
                ) + "\n"
            else "" end
        ) +
        (
            if .value.brew.cask == true then
                "cask"
            else
                "brew"
            end
        ) + " \"" +
        (.value.brew.name // .key ) +
        (
            if .value.brew.version then
                "@" + (.value.brew.version | tostring)
            else "" end
        ) + "\"" +
        (
            if .value.brew.link == false then
                ", link: false"
            else "" end
        )'
}

function chiToolsInstallGit() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local toolName="$2"
    local url=$(jsonRead "$3" '.git.url // empty')
    local target=$(expandPath $(jsonRead "$3" '.git.target // empty'))

    [[ -d "$target" ]] && return 0

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Cloning '$toolName' from '$url' to '$target'...\n" "$1"
    
    mkdir -p "$target"
    git clone "$url" "$target"
}

function chiToolsInstallCommand() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local installCommand=$(jsonReadPath "$3" command)
    [[ $? -eq 0 ]] || return 1

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Installing '$2' with command '$installCommand'...\n" "$1"
    
    eval "$installCommand"
}

function chiToolsInstallScript() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local installScript=$(jsonReadPath "$3" script)
    [[ $? -eq 0 ]] || return 1

    local postInstall=$(jsonReadPath "$3" postInstall)

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Installing '$2' from script at '$installScript'...\n" "$1"
    
    /bin/bash -c "$(curl -fsSL "$installScript")"
    
    if [[ -n "$postInstall" ]]; then
        chiLog "running post-install script..." "$1"
        eval "$postInstall"
    fi
}

function chiToolsInstallArtifact() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local toolName="$2"
    local artifactConfig=$(jsonReadPath "$3" artifact 2>/dev/null)

    local url=$(jsonReadPath "$artifactConfig" url)
    [[ $? -eq 0 ]] || return 1
    url=$(chiToolsUrlExpand "$3" "$url")
    [[ $? -eq 0 ]] || return 1
    
    local installDir=$(chiToolsArtifactMakeTargetDir "$artifactConfig")
    [[ $? -eq 0 ]] || return 1
    [[ -f "$installDir" ]] && return 0

    local fileName
    jsonReadBoolPath "$1" appendFilename &>/dev/null \
        && fileName="$(basename "$url")"

    local installPath="$installDir${fileName:+/}$fileName"

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Installing '$toolName' from '$url' to '$installPath'..." "$1"

    $(jsonReadBoolPath "$artifactConfig" isExec &>/dev/null \
        && echo chiToolsInstallExecutableFromUrl \
        || echo chiToolsInstallFromUrl) "$toolName" "$url" "$installPath" "$fileName" # > /dev/null
}

function chiToolsUrlExpand() {
    requireArg "a tool config JSON string" "$1" || return 1
    requireArg "a URL to expand" "$2" || return 1

    local version=$(jsonReadPath "$1" version)
    if [[ -z "$version" ]]; then
        chiLog "no version found in tool config!" "$moduleName" >&2
        return 1
    fi

    chiUrlExpand "$version" "$2"
}

function chiToolsArtifactMakeTargetDir() {
    requireArg "a tool artifact config JSON string" "$1" || return 1

    local target=$(jsonReadPath "$1" target)
    [[ -z "$target" ]] \
        && echo "$CHI_TOOLS_BIN" \
        || echo $(expandPath "$target")
}

function chiToolsArtifactMakeTargetPath() {
    requireArg "a tool artifact config JSON string" "$1" || return 1

    local url=$(jsonReadPath "$1" url)
    local target=$(chiToolsArtifactMakeTargetDir "$1")

    jsonReadBoolPath "$1" appendFilename &>/dev/null \
        && echo "$target/$(basename "$url")" \
        || echo "$target"
}
