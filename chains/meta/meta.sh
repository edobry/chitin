function chiGetVersion() {
    pushd $CHI_PROJECT_DIR/chitin > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function chiGetLocation() {
    echo $CHI_PROJECT_DIR/chitin
}

function chiGetReleasedVersion() {
    chiGetVersion | cut -d '-' -f 1
}

function chiCheckVersion() {
    requireArg "the minimum version" "$1" || return 1

    local minimumVersion="$1"
    local installedVersion="$(chiGetVersion)"

    if ! checkVersion $minimumVersion $installedVersion; then
        chiLog "Installed chitin version $installedVersion does not meet minimum of $minimumVersion!"
        return 1
    fi
}

function chiCheckEmbeddedVersion() {
    if [[ ! -d chitin ]]; then
        chiLog "No embedded chitin found!"
        return 1
    fi

    pushd chitin > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}


function chiShowEnvvars() {
    env | grep "CHI_"
}

function chiDebug() {
    chiLog "configuration"
    chiLog "version: $(chiGetVersion)"
    chiConfigUserShow

    chiLog "tool status:"
    chiToolsShowStatus

    chiLog "envvars:"
    chiShowEnvvars
    
    echo
    hr

    chiLog "configuration:" "aws"
    awsShowEnvvars
}

function chiRegisterCompletion() {
    requireArg "\$0" "$1" || return 1

    checkCommand compdef && return 0

    local dirName="$([[ -f "$1" ]] && dirname "$1" || echo "$1")"

    export fpath=($dirName $fpath)
}

export CHI_COMPLETION_DIR="$CHI_SHARE/completions"
chiRegisterCompletion "$CHI_COMPLETION_DIR"
