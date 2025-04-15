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
        chiLogError "Installed chitin version $installedVersion does not meet minimum of $minimumVersion!" core
        return 1
    fi
}

function chiCheckEmbeddedVersion() {
    if [[ ! -d chitin ]]; then
        chiLogError "No embedded chitin found!" core
        return 1
    fi

    pushd chitin > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function chiDebug() {
    chiLogInfo "configuration"
    chiLogInfo "version: $(chiGetVersion)"
    chiConfigUserShow

    chiLogInfo "tool status:"
    chiToolsShowStatus

    chiLogInfo "envvars:"
    chiShowEnvvars
    
    echo
    hr

    chiLogInfo "configuration:" "aws"
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
