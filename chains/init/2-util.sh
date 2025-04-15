# checks if a command exists
# args: command
function checkCommand() {
    requireArg "a command" "$1" || return 1

    command -v "$1" >/dev/null 2>&1
}

notSet () [[ -z $1 ]]
isSet () [[ ! -z $1 ]]
isTrue () [[ "$1" = true ]]

#args: length of string
function randomString() {
    cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w "${1:-10}" | head -n 1
}

#creates a randomly named temporary file
function tempFile() {
    echo /tmp/${1:+$1-}$(randomString 10)
}

function hr() {
	printf '%0*d' $(tput cols) | tr 0 ${1:-_}
}

function getColumn() {
    requireNumericArg "the column number" "$1" || return 1

    awk "{ print \$$1 }"
}

function escapeSingleQuotes() {
    sed "s/'/''/g"
}

function escapeCommas(){
    sed 's/,/\\\,/g'
}

function escapeSlashes() {
    sed 's/\//\\\//g'
}

function unescapeNewlines() {
    sed 's/\\n/\
/g'
}

function replaceNewlines() {
    tr '\n' ' ' | sed -e 's/  *$//'
}

function newlinesToChar() {
    requireArg "a character" "$1" || return 1

    paste -sd "$1" -
}

function newlinesToCommas() {
    newlinesToChar ','
}

function splitOnChar() {
    requireArg "a character" "$1" || return 1

    tr "$1" '\n'
}

function splitOnSpaces() {
    splitOnChar ' '
}

function joinWith() {
    requireArg "a character" "$1" || return 1
    requireArg "a list of strings" "$2" || return 1

    local delimiter="$1"; shift

    printf "%s\n" "$@" | paste -sd "$delimiter" -
}

function sedStripRef() {
    sed 's/\?ref=.*$//g'
}

function sedStripGitEx() {
    sed 's/\.git//'
}

function decimalToHex() {
    requireNumericArg "value to convert" "$1" || return 1

    printf "%x" "$1"
}

function findFile() {
    requireArg "a search pattern" "$1" || return 1
    
    find * -type f -name "$1"
}

function deleteFiles() {
    requireArg "a search pattern" "$1" || return 1

    find . -type f -name "$1" -prune -print -exec rm -rf {} \;
}

function cdFileDir() {
    requireArg "a file path" "$1" || return 1

    cd "$(dirname "$1")"
}
