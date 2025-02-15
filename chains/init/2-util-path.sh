function xdgHome() {
    echo "${XDG_DATA_HOME:-${HOME}}"
}

function xdgData() {
    echo "$(xdgHome)/.local/share"
}

function xdgCache() {
    echo "$(xdgHome)/.cache"
}

export CHI_CACHE="$(xdgCache)/chitin"

function fileGetExtension() {
    requireArg "a file path" "$1" || return 1

    echo "${1##*.}"
}

function fileStripExtension() {
    requireArg "a file path" "$1" || return 1

    echo "${1%.*}"
}

function chiAddToPathVar() {
    requirePathlikeVarArg "$1" || return 1
    requireArg "an existing path" "$2" || return 1

    local currentValue="$(chiReadDynamicVariable "$1")"

    # check if the variable already contains the dir
    [[ ":${currentValue}:" == *":$2:"* ]] && return 0

    export "${1}=:${2}:${currentValue}"
}

function chiRemoveFromPathVar() {
    requirePathlikeVarArg "$1" || return 1
    requireArg "an existing path" "$2" || return 1

    export "${1}=$(showPathVar "$1" | grep -v "$2" | newlinesToChar ':')"
}

function showPathVar() {
    requirePathlikeVarArg "$1" || return 1
    
    chiReadDynamicVariable "$1" | splitOnChar ':'
}

function chiToolsAddDirToPath() {
    requireDirectoryArg "directory" "$1" || return 1

    chiAddToPathVar PATH "$(chiExpandPath "$1")"
}

function chiToolsRemoveDirFromPath() {
    requireDirectoryArg "directory" "$1" || return 1

    chiRemoveFromPathVar PATH "$1"
}

function showPath() {
    showPathVar PATH
}

function chiExpandPathSegment() {
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

function chiExpandPathSegmentStart() {
    requireArg "a path segment" "$1" || return 1
    requireArg "a path expansion" "$2" || return 1
    requireArg "a path" "$3" || return 1
    
    chiExpandPathSegment "$1" "$2" "$3" "^${1}"
}

function chiExpandPath() {
    requireArg "a path" "$1" || return 1

    local localShare="localshare"
    local xdgHome="xdghome"
    
    local expandedPath="$(chiExpandHome "$(echo $1 | envsubst)")"
    expandedPath="$(chiExpandPathSegmentStart "$xdgHome" "$(xdgHome)" "$expandedPath")"
    expandedPath="$(chiExpandPathSegmentStart "$localShare" "$(xdgData)" "$expandedPath")"

    echo "$expandedPath"
}

function chiExpandHome() {
    requireArg "a path" "$1" || return 1
    
    chiExpandPathSegmentStart "~" "$HOME" "$1"
}

function chiUrlExpand() {
    requireArg "a URL to expand" "$1" || return 1
    requireJsonArg "of expansion values" "$2" || return 1

    local expandedUrl="$1"

    local versionSegment="{{version}}"
    local version="$(jsonReadPath "$2" version)"
    if [[ -n "$version" ]]; then
        expandedUrl="$(chiExpandPathSegment "$versionSegment" "$version" "$expandedUrl" "$versionSegment")"
    fi

    echo "$expandedUrl"
}
