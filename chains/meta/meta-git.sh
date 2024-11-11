function chiCd() {
    cd "$CHI_DIR"
}

function chiGit() {
    git -C "$CHI_DIR" $*
}

function chiGitPull() {
    chiGit pull
}

function chiGitAdd() {
    chiGit add $*
}

function chiGitCommit() {
    requireArg 'a commit message' "$1" || return 1

    chiGit commit -m "$1" $*
}

function chiGitPull() {
    chiGit push
}
