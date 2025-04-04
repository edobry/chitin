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

# initiates a sparse repository in a subdirectory and fetches the specified paths only
# args: remote repo url, repo name, relative filepaths (space separated)
# ref: https://stackoverflow.com/questions/60190759/how-do-i-clone-fetch-or-sparse-checkout-a-single-directory-or-a-list-of-directo/60190760#60190760
function gitSparseCheckoutPaths() {
    requireArg "a remote repository" "$1" || return 1
    requireArg "the name of the repository" "$2" || return 1
    requireArg "a filepath" "$3" || return 1

    local remoteRepo="$1"
    local repoName="$2"
    local ref="$3"
    shift; shift; shift
    local filepaths=$*

    # check if repo already initialized
    gitIsRepoRoot "$repoName" && return 0

    echo "Initializing and fetching shallow clone of $repoName..."

    mkdir -p "$repoName"
    pushd "$repoName" > /dev/null

    # init sparse repo
    git init
    git config core.gitSparseCheckout true
    git config init.defaultBranch main
    echo "$filepaths" >> .git/info/sparse-checkout

    # fetch files
    git remote add origin "$remoteRepo"
    git fetch --depth=1 origin $ref
    git checkout $ref
    popd > /dev/null
}

# initiates a sparse repository in a subdirectory and fetches all but the specified paths
# args: remote repo url, repo name, relative filepath
# ref: https://stackoverflow.com/questions/60190759/how-do-i-clone-fetch-or-sparse-checkout-a-single-directory-or-a-list-of-directo/60190760#60190760
function gitSparseCheckoutExclude() {
    # requireArg "a remote repository" "$1" || return 1
    # requireArg "the name of the repository" "$2" || return 1
    # requireArg "a filepath" "$3" || return 1

    local remoteRepo="$1"
    local repoName="$2"
    local ref="$3"
    local filepath="$4"

    # check if repo already initialized
    gitIsRepoRoot "$repoName" && return 0

    echo "Initializing and fetching shallow clone of $repoName..."
    git clone --single-branch --branch=$ref --filter=blob:none --no-checkout --sparse --depth=1 $remoteRepo $repoName
    pushd "$repoName" > /dev/null
    
    git sparse-checkout set --no-cone '/*' "!/$filepath/*"
    git checkout $ref
    popd > /dev/null
}

# initiates a sparse repository in a subdirectory in order to fetch one specific file
# args: remote repo url, repo name, relative filepath
# ref: https://stackoverflow.com/questions/60190759/how-do-i-clone-fetch-or-sparse-checkout-a-single-directory-or-a-list-of-directo/60190760#60190760
function gitSparseCheckoutSingle() {
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

    local mainBranch='main'
    local remoteMainBranch="origin/$mainBranch"

    pushd "$1" > /dev/null
    if [[ "$2" == "hard" ]]; then
        git fetch origin && git reset --hard $remoteMainBranch
    else
        git pull origin $mainBranch > /dev/null 2>&1
    fi
    popd > /dev/null
}

function gitCommitPublish() {
    git commit -m "[publish]" --allow-empty
    git push
}

function gitGenerateKey() {
    requireArg "an email" "$1" || return 1

    local sshDir="$HOME/.ssh"
    mkdir -p "$sshDir"

    local keyPath="$sshDir/id_github"

    ssh-keygen -t ed25519 -C "$1" -f "$keyPath" >&2
    ssh-add --apple-use-keychain "$keyPath" >&2

    echo "$keyPath"
}

function gitAddKey() {
    requireArg "a key path" "$1" || return 1

    eval "$(ssh-agent -s)"
    ssh-add "$1"
}
