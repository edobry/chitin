#args: length of string
function randomString() {
    cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w $1 | head -n 1
}

#creates a randomly named temporary file
function tempFile() {
    echo /tmp/$(randomString 10)
}

function escapeCommas(){
    sed 's/,/\\\,/g'
}

function checkNumeric() {
    [[ $1 =~ '^[0-9]+$' ]]
}

# can be used to check arguments for a specific string
# args: search target, args...
# example: argsContain "some string" $* || exit 1
function argsContain() {
    local target="$1"
    shift

    for i in $@ ; do
        [[ "$i" == "$target" ]] && return 0
    done

    return 1
}

# can be used to check a list for a specific string
# args: search target, list
# example: listContains "eu-west-1" $(listAZs) || exit 1
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
