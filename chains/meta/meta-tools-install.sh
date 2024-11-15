# function chiDependenciesInstallTools() {
#     requireDirectoryArg "module directory" "$1" || return 1
#     requireArg "a module name" "$2" || return 1

#     chiModuleConfigReadFromFile "$1" "$2"

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
