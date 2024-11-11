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
    requireArg "a tool config JSON string" "$2" || return 1

    local moduleName="$1"
    local tool="$2"

    local toolName=$(jsonRead "$tool" '.key')

    # check order:
    #
    # if a checkCommand is set, use that
    # if its a brew tool,
    #   if its a cask, use `brewCheck`
    #   if checkBrew is set, use `brewCheck`
    # else, use `checkCommand` with the tool name
    
    local checkCommandValue
    checkCommandValue=$(jsonReadPath "$tool" value checkCommand 2>/dev/null)
    local checkCommandExit=$?
    
    local checkBrew
    jsonCheckBoolPath "$tool" value checkBrew &>/dev/null && checkBrew=true || checkBrew=false

    if [[ -n "$checkCommandValue" ]]; then
        if $checkBrew; then
            chiLog "both 'checkCommand' and 'checkBrew' set for '$toolName'!" "$moduleName"
            return 1
        fi
        
        return $(checkCommand $([[ "$checkCommandValue" == "true" ]] \
            && echo "$toolName" \
            || echo "$checkCommandValue"))
    fi

    local isBrew=false
    local brewConfig
    brewConfig=$(jsonReadPath "$tool" value brew 2>/dev/null)
    [[ $? -eq 0 ]] && isBrew=true

    if $isBrew; then
        # echo "in isBrew"
        if [[ -z "$brewConfig" ]]; then
            chiLog "expected brew config not found for '$toolName'!" "$moduleName"
            return 1
        fi

        if jsonCheckBoolPath "$brewConfig" cask &>/dev/null; then
            # echo "running brew check cask"
            return $(brewCheckCask "$toolName")
        fi

        # echo "checkBrew: $checkBrew"

        if $checkBrew; then
            # echo "running brew check formula"
            return $(brewCheckFormula "$toolName")
        fi
        # echo "brew done"
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

function chiDependenciesInstallTools() {
    requireDirectoryArg "module directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    chiModuleConfigRead "$1" "$2"

    chiToolsInstallBrew "$2"
    chiToolsInstallGit "$2"
}

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
    requireArg "a tool config JSON string" "$1" || return 1

    for tool in "$@"; do
        # echo "tool: $tool"
        local depName=$(jsonRead "$tool" '.key')
        local url=$(jsonRead "$tool" '.value.git.url // empty')
        local target=$(jsonRead "$tool" '.value.git.target // empty')

        chiToolsInstallGitTool "$depName" "$url" "$target"
    done
}

function chiToolsInstallGitTool() {
    requireArg "a tool name" "$1" || return 1
    requireArg "a git url" "$2" || return 1
    requireArg "a target directory" "$3" || return 1

    local target="$3"
    if [[ "$target" == "local/share" ]]; then
        target="${XDG_DATA_HOME:-${HOME}/.local/share}/$1/$1.git"
    fi

    [[ -d "$target" ]] && return 0

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    echo -e "${GREEN}==>${NC} Cloning $1 from $2 to $target...\n"
    
    mkdir -p $target
    git clone "$2" "$target"
}
