function gitIsRepoRoot() {
    requireArg "a directory" "$1"

    [[ -d "$1/.git" ]]
}

function gitGetCurrentCommitHash() {
    git rev-parse HEAD
}

# initiates a sparse repository in a subdirectory in order to fetch one specific file
# args: remote repo url, repo name, relative filepath
# ref: https://stackoverflow.com/questions/60190759/how-do-i-clone-fetch-or-sparse-checkout-a-single-directory-or-a-list-of-directo/60190760#60190760
function sparseCheckout() {
    requireArg "a remote repository" "$1"
    requireArg "the name of the repository" "$2"
    requireArg "a filepath" "$3"

    local remoteRepo="$1"
    local repoName="$2"
    local filepath="$3"

    mkdir -p "$repoName"
    pushd "$repoName" > /dev/null

    # init sparse repo
    git init > /dev/null
    git config core.sparseCheckout true
    echo "$filepath" >> .git/info/sparse-checkout

    # fetch single file
    git remote add origin "$remoteRepo" > /dev/null 2>&1
    git fetch --depth=1 origin main > /dev/null 2>&1
    git checkout main > /dev/null 2>&1
    popd > /dev/null
}
