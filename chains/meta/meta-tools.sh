function chiDependenciesInstallTools() {
    requireDirectoryArg "module directory" "$1" || return 1
    requireArg "a module name" "$2" || return 1

    chiModuleConfigRead "$1" "$2"

    chiToolsInstallBrew "$2"
    chiToolsInstallGit "$2"
}

function chiToolsInstallBrew() {
    requireArg "a module name" "$1" || return 1

    local brewfilePath=$(chiDependenciesGenerateBrewfile "$1")

    chiLog "installing brew depenedencies...\n" "$1"
    brew bundle --file=$brewfilePath
}

function chiDependenciesGenerateBrewfile() {
    requireArg "a module name" "$1" || return 1

    local brewfilePath=$(tempFile)

    chiModuleDependenciesGetRequiredTools "$1" brew | jq -r '
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
        )' > $brewfilePath

    echo $brewfilePath
}

function chiToolsInstallGit() {
    requireArg "a module name" "$1" || return 1

    local gitTools=$(chiModuleDependenciesGetRequiredTools "$1" git)

    while read -r tool; do
        echo "tool: $tool"
        local depName=$(jsonRead "$tool" '.key')
        local url=$(jsonRead "$tool" '.value.git.url // empty')
        local target=$(jsonRead "$tool" '.value.git.target // empty')

        chiToolsInstallGitTool "$depName" "$url" "$target"
    done < <(echo "$gitTools")

    echo $brewfilePath
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
