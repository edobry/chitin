function chiToolsInstallBrew() {
    requireArg "a module name" "$1" || return 1
    local moduleName="$1"; shift

    requireArg "a tool config JSON string" "$1" || return 1

    local brewfilePath=$(tempFile)
    local brewfile=$(chiToolsGenerateBrewfile $*)
    echo "$brewfile" > $brewfilePath

    chiLog "installing brew depenedencies..." "$moduleName"
    brew bundle --file="$brewfilePath"

    # iterate over the rest args and run post install command for each
    for toolEntry in "$@"; do
        local toolName="$(jsonReadPath "$toolEntry" key)"
        local toolConfig="$(jsonReadPath "$toolEntry" value)"

        chiToolsRunPostInstall "$moduleName" "$tool" "$toolConfig"
    done
}

function chiToolsGenerateBrewfile() {
    requireArg "a tool name" "$1" || return 1

    echo $* | jq -r '
        if .value.brew == true then .value.brew = {} else . end | 
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

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Installing '$2' from script at '$installScript'...\n" "$1"
    
    /bin/bash -c "$(curl -fsSL "$installScript")"
}

function chiToolsInstallArtifact() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local toolName="$2"
    local artifactConfig=$(jsonReadPath "$3" artifact 2>/dev/null)

    local url="$(jsonReadPath "$artifactConfig" url)"
    [[ -n "$url" ]] || return 1
    
    url="$(chiToolsUrlExpand "$3" "$url")"
    [[ $? -eq 0 ]] || return 1
    
    local installDir=$(chiToolsArtifactMakeTargetDir "$artifactConfig")
    [[ $? -eq 0 ]] || return 1
    [[ -f "$installDir" ]] && return 0

    local targetConfig=$(jsonReadPath "$artifactConfig" target)
    local targetBase="$(expandPath "$(jsonReadPath "$targetConfig" base)")"

    local ensureSubdirs=$(jsonRead "$targetConfig" '(.ensureSubdirs // empty)[]')
    if [[ -n "$ensureSubdirs" ]]; then
        for subdir in $ensureSubdirs; do
            mkdir -p "$targetBase/$subdir"
        done
    fi

    local fileName
    jsonReadBoolPath "$artifactConfig" appendFilename &>/dev/null \
        && fileName="$(basename "$url")"

    $(jsonReadBoolPath "$artifactConfig" isExec &>/dev/null \
        && echo chiToolsInstallExecutableFromUrl \
        || echo chiToolsInstallFromUrl) "$toolName" "$url" "$installDir" "$fileName" # > /dev/null
}

function chiToolsUrlExpand() {
    requireArg "a tool config JSON string" "$1" || return 1
    requireArg "a URL to expand" "$2" || return 1

    local expansionValues="$(jsonRead "$1" '{ version }')"

    chiUrlExpand "$2" "$expansionValues"
}

function chiToolsArtifactMakeTargetDir() {
    requireArg "a tool artifact config JSON string" "$1" || return 1

    local targetConfig=$(jsonReadPath "$1" target)
    if [[ -z "$targetConfig" ]]; then
        echo "$CHI_TOOLS_BIN"
        return 0
    fi

    local targetPath

    if validateJson "$targetConfig" &>/dev/null; then
        local targetBase="$(expandPath "$(jsonReadPath "$targetConfig" base)")"
        local targetDir="$(jsonReadPath "$targetConfig" dir)"

        targetPath="$targetBase/$targetDir"
    else
        targetPath="$(expandPath "$targetConfig")"
    fi

    echo "$targetPath"
}

function chiToolsArtifactMakeTargetPath() {
    requireArg "a tool artifact config JSON string" "$1" || return 1

    local url="$(jsonReadPath "$1" url)"
    local target="$(chiToolsArtifactMakeTargetDir "$1")"

    jsonReadBoolPath "$1" appendFilename &>/dev/null \
        && echo "$target/$(basename "$url")" \
        || echo "$target"
}

function chiToolsInstallPipx() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local pipxPackage="$2"
    local pipxConfig=$(jsonReadPath "$3" pipx 2>/dev/null)
    if [[ -n "$pipxConfig" ]] && validateJson "$pipxConfig" &>/dev/null; then
    echo "in pipx: $pipxConfig" >&2
        pipxPackage=$(jsonRead "$pipxConfig" '.package // empty')
    fi

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Installing '$2' with pipx...\n" "$1"
    
    pipx install "$pipxPackage"
}

function chiToolsRunPostInstall() {
    requireArg "a module name" "$1" || return 1
    requireArg "a tool name" "$2" || return 1
    requireArg "a tool config JSON string" "$3" || return 1

    local postInstall=$(jsonReadPath "$3" postInstall)
    [[ -z "$postInstall" ]] && return 0

    GREEN=$(tput setaf 2)
    NC=$(tput sgr0)

    chiLog "${GREEN}==>${NC} Running post-install command for '$2'...\n" "$1"
    
    eval "$postInstall"
}
