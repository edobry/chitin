function checkNumeric() {
    [[ "$1" =~ '^[0-9]+$' ]]
}

function checkFileExists() {
    requireArg "a filepath" "$1" || return 1

    if [[ ! -f "$1" ]]; then
        echo "No file exists at the given path!"
        return 1
    fi
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
    local target="$1"; shift

    for option in "$@"; do
        [[ "$option" == "$target" ]] && return 0
    done

    return 1
}

# checks that an argument is supplied and prints a message if not
# args: name of arg, arg value
function requireArg() {
    requireArgWithCheck "$1" "$2" true ""
}

# checks that an argument is supplied and that it passes the check, and prints a message if not
# args: name of arg, arg value, validation command, (optional) validation failure prefix
function requireArgWithCheck() {
    if [[ -z "$2" ]] || ! eval "$3 '$2'"; then
        echo "Please supply ${4}${1:-a value}!" >&2
        return 1
    fi
}

# checks that an argument is supplied and that it is numeric, and prints a message if not
# args: name of arg, arg value
function requirePathlikeVarArg() {
    requireArg "a PATH-like variable name" "$1"
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

# checks that an argument is supplied and that it points to an existing JSON file, and prints a message if not
# args: name of arg, arg value
function requireJsonFileArg() {
    requireFileArg "$1" "$2"
    requireArgWithCheck "$1" "$2" checkExtensionJson "a path to an existing JSON "
}

# checks that an argument is supplied and that it points to an existing YAML file, and prints a message if not
# args: name of arg, arg value
function requireYamlFileArg() {
    requireFileArg "$1" "$2"
    requireArgWithCheck "$1" "$2" checkExtensionYaml "a path to an existing YAML "
}

# checks that an argument is supplied and that points to an existing directory, and prints a message if not
# args: name of arg, arg value
function requireDirectoryArg() {
    requireArgWithCheck "$1" "$2" checkDirectoryExists "a path to an existing "
}

# checks that an argument is supplied and that its one of the allowed options, and prints a message listing the available options if not
# args: name of arg, arg value, list of valid options
function requireArgOptions() {
    local argName="$1"; shift

    requireArg "$argName" "$1" || return 1
    local argValue="$1"; shift

    # transform to a space-delimited list
    local options="$(echo "$*" | tr '\n' ' ' | sort)"

    if [[ -z "$argValue" ]] || ! eval "argsContain $argValue $options"; then
        echo "Supplied argument '$argValue' is not a valid option for $argName!" >&2
        echo "It must be one of the following:" >&2
        echo "$options" | tr " " '\n' | sort >&2
        return 1
    fi
}
