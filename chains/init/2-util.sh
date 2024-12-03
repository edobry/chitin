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
    cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w $1 | head -n 1
}

#creates a randomly named temporary file
function tempFile() {
    echo /tmp/$(randomString 10)
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

function sedStripRef() {
    sed 's/\?ref=.*$//g'
}
function sedStripGitEx() {
    sed 's/\.git//'
}

# can be used to check a list for a specific string
# args: search target, list
# example: listContains "eu-west-1" $(awsListAZs) || exit 1
function listContains() {
    echo "$2" | grep -q "$1"
}

function findFile() {
    requireArg "a search pattern" "$1" || return 1
    
    find * -type f -name "$1"
}

function deleteFiles() {
    requireArg "a search pattern" "$1" || return 1

    find . -type f -name "$1" -prune -print -exec rm -rf {} \;
}

function chiShowColors() {
    for i in $(seq 0 $(($(tput colors) - 1))); do
        printf "$(tput setaf $i)Color code $i$(tput sgr0)\n"
    done
}

function chiColorInit() {
    export CHI_COLOR_RED="$(tput setaf 1)"
    export CHI_COLOR_GREEN="$(tput setaf 2)"
    export CHI_COLOR_STOP="$(tput sgr0)"
}

function chiColor() {
    requireArg "a known color name" "$1" || return 1
    requireArg "a message" "$2" || return 1

    echo -n "${1}$2${CHI_COLOR_STOP}"
}

function chiReadDynamicVariable() {
    requireArg "a variable name" "$1" || return 1

    if [[ -z "$ZSH_VERSION" ]]; then
        echo "${!1}"
    else
        echo "${(P)1}"
    fi
}

function xdgHome() {
    echo "${XDG_DATA_HOME:-${HOME}}"
}

function expandPathSegment() {
    requireArg "a path segment" "$1" || return 1
    requireArg "a path expansion" "$2" || return 1
    requireArg "a path" "$3" || return 1

    local pathSegment="$1"
    local pathExpansion="$2"
    # TODO: build something that detects `local path` and ERRORS
    local pathToExpand="$3"
    local pathRegex="${4:-^${pathSegment}*}"

    echo "$pathToExpand" | sed -e "s/${pathRegex}/$(echo "$pathExpansion" | escapeSlashes)/g"
}

function expandPathSegmentStart() {
    requireArg "a path segment" "$1" || return 1
    requireArg "a path expansion" "$2" || return 1
    requireArg "a path" "$3" || return 1
    
    expandPathSegment "$1" "$2" "$3" "^${1}"
}

function expandPath() {
    requireArg "a path" "$1" || return 1

    local localShare="localshare"
    local xdgHome="xdghome"
    
    local expandedPath="$(expandHome "$1")"
    expandedPath="$(expandPathSegmentStart "$xdgHome" "$(xdgHome)" "$expandedPath")"
    expandedPath="$(expandPathSegmentStart "$localShare" "$(xdgHome)/.local/share" "$expandedPath")"

    echo "$expandedPath"
}

function expandHome() {
    requireArg "a path" "$1" || return 1
    
    expandPathSegmentStart "~" "$HOME" "$1"
}

function chiUrlExpand() {
    requireArg "a URL to expand" "$1" || return 1
    requireJsonArg "of expansion values" "$2" || return 1

    local expandedUrl="$1"

    local versionSegment="{{version}}"
    local version="$(jsonReadPath "$2" version)"
    if [[ -n "$version" ]]; then
        expandedUrl="$(expandPathSegment "$versionSegment" "$version" "$expandedUrl" "$versionSegment")"
    fi

    echo "$expandedUrl"
}

function fileGetExtension() {
    requireArg "a file path" "$1" || return 1

    echo "${1##*.}"
}

function fileStripExtension() {
    requireArg "a file path" "$1" || return 1

    echo "${1%.*}"
}

function checkExtension() {
    requireArg "a file path" "$1" || return 1
    requireArg "an extension" "$2" || return 1

    local filePath="$1"
    local extension="$2"

    if [[ "$(fileGetExtension $filePath)" != "$extension" ]]; then
        chiBail "extension must be '.$extension'!"
        return 1
    fi
}

function checkExtensionJson() {
    requireArg "a JSON file path" "$1" || return 1

    checkExtension "$1" "json"
}

function checkExtensionYaml() {
    requireArg "a YAML file path" "$1" || return 1

    checkExtension "$1" "yaml"
}

function showPath() {
    echo $PATH | splitOnChar ':'
}
