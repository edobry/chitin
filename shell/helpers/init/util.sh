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

function escapeCommas(){
    sed 's/,/\\\,/g'
}

function unescapeNewlines() {
    sed 's/\\n/\
/g'
}

function replaceNewlines() {
    tr '\n' ' ' | sed -e 's/  *$//'
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

# checks that an argument is supplied and that it is numeric, and prints a message if not
# args: name of arg, arg value
function requireFileArg() {
    requireArgWithCheck "$1" "$2" checkFileExists "a path to an existing "
}

# checks that an argument is supplied and that its one of the allowed options, and prints a message listing the available options if not
# args: name of arg, arg value, list of valid options
function requireArgOptions() {
    local argName="$1"
    local argValue="$2"

    # skip the first 2 arguments
    shift && shift
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
# args: name of arg, arg value, validation command, (optionak) validation failure prefix
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
        echo "invalid $1 version: expected $expectedVersion <= X < $(($majorExpected + 1)).0.0; found $currentVersion"
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

# checks if a command exists
# args: command
function checkCommand() {
    requireArg "a command" "$1" || return 1

    command -v "$1" >/dev/null 2>&1
}
