function gitIsRepoRoot() {
    requireArg "a directory" "$1" || return 1

    [[ -d "$1/.git" ]]
}

function gitGetCurrentCommitHash() {
    git rev-parse HEAD
}

# initiates a sparse repository in a subdirectory in order to fetch one specific file
# args: remote repo url, repo name, relative filepath
# ref: https://stackoverflow.com/questions/60190759/how-do-i-clone-fetch-or-sparse-checkout-a-single-directory-or-a-list-of-directo/60190760#60190760
function gitSparseCheckout() {
    requireArg "a remote repository" "$1" || return 1
    requireArg "the name of the repository" "$2" || return 1
    requireArg "a filepath" "$3" || return 1

    local remoteRepo="$1"
    local repoName="$2"
    local filepath="$3"
    local ref="${4:-"main"}"

    # check if repo already initialized
    gitIsRepoRoot "$repoName" && return 0

    echo "Initializing and fetching shallow clone of $repoName..."

    mkdir -p "$repoName"
    pushd "$repoName" > /dev/null

    # init sparse repo
    git init
    git config core.gitSparseCheckout true
    git config init.defaultBranch main
    echo "$filepath" >> .git/info/sparse-checkout

    # fetch single file
    git remote add origin "$remoteRepo"
    git fetch --depth=1 origin $ref
    git checkout $ref
    popd > /dev/null
}

function gitPullMain() {
    requireDirectoryArg "a repository path" "$1" || return 1

    pushd "$1" > /dev/null
    git pull origin main > /dev/null 2>&1
    popd > /dev/null
}

function gitCommitPublish() {
    git commit -m "[publish]" --allow-empty
    git push
}
