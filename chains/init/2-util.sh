function chiLog() {
    requireArg "a message" "$1" || return 1

    echo "chitin${2:+:}${2} - $1" >&2
}

function chiBail() {
    chiLog "$(chiColorRed "${1:-"something went wrong"}!")"
    chiLog "$(chiColorRed "exiting!")"
    return 1
}

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

function chiReadDynamicVariable() {
    requireArg "a variable name" "$1" || return 1

    if [[ -z "$ZSH_VERSION" ]]; then
        echo "${!1}"
    else
        echo "${(P)1}"
    fi
}

function chiShowColors() {
    for i in $(seq 0 $(($(tput colors) - 1))); do
        printf "$(tput setaf $i)Color code $i$(tput sgr0)\n"
    done
}

CHI_COLOR_PREFIX="CHI_COLOR"

function chiColorInit() {
    export "${CHI_COLOR_PREFIX}_RED=$(tput setaf 1)"
    export "${CHI_COLOR_PREFIX}_GREEN=$(tput setaf 2)"
    export CHI_CODE_STOP="$(tput sgr0)"
}

function chiShowKnownColors() {
    for colorVar in $(env | grep "${CHI_COLOR_PREFIX}_" | cut -d= -f1); do
        local color="${colorVar#"${CHI_COLOR_PREFIX}_"}"
        chiColor "$(chiReadDynamicVariable "$colorVar")" "$color"
        echo
    done
}

function chiColor() {
    requireArg "a known color name" "$1" || return 1
    requireArg "a message" "$2" || return 1

    echo -n "${1}${2}${CHI_CODE_STOP}"
}

function chiColorRed() {
    requireArg "a message" "$1" || return 1

    chiColor "$CHI_COLOR_RED" "$1"
}

function chiColorGreen() {
    requireArg "a message" "$1" || return 1

    chiColor "$CHI_COLOR_GREEN" "$1"
}
