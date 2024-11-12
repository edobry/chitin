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

function checkNumeric() {
    [[ $1 =~ '^[0-9]+$' ]]
}

function checkFileExists() {
    requireArg "a filepath" "$1" || return 1

    if [[ ! -f "$1" ]]; then
        echo "No file exists at the given path!"
        return 1
    fi
}

function checkDirectoryExists() {
    requireArg "a filepath" "$1" || return 1

    if [[ ! -d "$1" ]]; then
        echo "No directory exists at the given path!"
        return 1
    fi
}

# can be used to check arguments for a specific string
# args: search target, args...
# example: argsContain "some string" $* || exit 1
function argsContain() {
    local target="$1"
    shift

    for i in $( echo $* ); do
        [[ "$i" == "$target" ]] && return 0
    done

    return 1
}

# can be used to check a list for a specific string
# args: search target, list
# example: listContains "eu-west-1" $(awsListAZs) || exit 1
function listContains() {
    echo "$2" | grep -q "$1"
}

# checks that an argument is supplied and prints a message if not
# args: name of arg, arg value
function requireArg() {
    requireArgWithCheck "$1" "$2" true ""
}

# checks that an argument is supplied and that it is numeric, and prints a message if not
# args: name of arg, arg value
function requireNumericArg() {
    requireArgWithCheck "$1" "$2" checkNumeric "a numeric "
}

# checks that an argument is supplied and that it points to an existing file, and prints a message if not
# args: name of arg, arg value
function requireFileArg() {
    requireArgWithCheck "$1" "$2" checkFileExists "a path to an existing "
}

# checks that an argument is supplied and that points to an existing directory, and prints a message if not
# args: name of arg, arg value
function requireDirectoryArg() {
    requireArgWithCheck "$1" "$2" checkDirectoryExists "a path to an existing "
}

# checks that an argument is supplied and that its one of the allowed options, and prints a message listing the available options if not
# args: name of arg, arg value, list of valid options
function requireArgOptions() {
    local argName="$1"
    local argValue="$2"

    # skip the first 2 arguments
    shift; shift
    # and transform to a space-delimited list
    local options=$(echo "$*" | tr '\n' ' ' | sort)

    if [[ -z "$argValue" ]] || ! eval "argsContain $argValue $options"; then
        echo "Please supply a valid ${argName:-a value}!"
        echo "It must be one of the following:"
        echo ${options} | tr " " '\n' | sort
        return 1
    fi
}

# checks that an argument is supplied and that it passes the check, and prints a message if not
# args: name of arg, arg value, validation command, (optional) validation failure prefix
function requireArgWithCheck() {
    if [[ -z "$2" ]] || ! eval "$3 '$2'"; then
        echo "Please supply ${4}${1:-a value}!"
        return 1
    fi
}

# checks that the current version of a program is GTE the required version and equal to the major component of the required version
# args: minimum version, current version
function checkVersion() {
    requireArg "the minimum version" "$1" || return 1
    requireArg "the current version" "$2" || return 1

    local minimumVersion="$1"
    local currentVersion="$2"

    checkMajorVersion $minimumVersion $currentVersion || return 1
    [[ "$(printf '%s\n' $minimumVersion $currentVersion | sort -V | head -n1)" = $minimumVersion ]]
}

function checkVersionAndFail() {
    requireArg "the dependency name" "$1" || return 1
    requireArg "the minimum version" "$2" || return 1
    requireArg "the current version" "$3" || return 1

    local minimumVersion="$2"
    local currentVersion="$3"

    local majorExpected=$(getMajorVersionComponent $minimumVersion)

    if ! checkVersion "$2" "$3"; then
        chiLog "invalid $1 version: expected $expectedVersion <= X < $(($majorExpected + 1)).0.0; found $currentVersion"
        return 1
    fi
}

function getMajorVersionComponent() {
    requireArg "a SemVer version number" "$1" || return 1

    echo "$1" | cut -d '.' -f 1
}

function checkMajorVersion() {
    requireArg "the expected version" "$1" || return 1
    requireArg "the current version" "$2" || return 1

    local expectedVersion="$1"
    local currentVersion="$2"

    [[ $(getMajorVersionComponent $currentVersion) -eq \
          $(getMajorVersionComponent $expectedVersion)
    ]]
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
    export CHI_COLOR_RED=$(tput setaf 1)
    export CHI_COLOR_GREEN=$(tput setaf 2)
    export CHI_COLOR_STOP=$(tput sgr0)
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

function expandPathSegment() {
    requireArg "a path segment" "$1" || return 1
    requireArg "a path expansion" "$2" || return 1
    requireArg "a path" "$3" || return 1

    local pathSegment="$1"
    local pathExpansion="$2"
    local path="$3"

    [[ "$path" == ${pathSegment}* ]] && path="${pathExpansion}${path#${pathSegment}}"
    
    echo "$path"
}

function expandHome() {
    requireArg "a path" "$1" || return 1
    
    expandPathSegment "~" "$HOME" "$1"
}

function expandPath() {
    requireArg "a path" "$1" || return 1

    local localShare="local/share"

    expandHome $(expandPathSegment "$localShare" "${XDG_DATA_HOME:-${HOME}}/.${localShare}" "$1")
}
