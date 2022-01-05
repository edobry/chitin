function jsonParseStream() {
    jq . -c | jq .
}

function prettyJson() {
    jq '.'
}

function prettyYaml() {
    yq e -P -
}

function validateJson() {
    requireArg "a minified JSON string" "$1" || return 1

    echo "$1" | jq -e . > /dev/null 2>&1
}

function validateJsonFile() {
    requireFileArg "JSON file" "$1" || return 1

    validateJson $(jsonReadFile "$1")
}

function validateJsonFields() {
    requireJsonArg "to validate" "$1" || return 1
    requireArg "(a) field(s) to validate" "$2" || return 1

    local json="$1"
    shift

    local requiredFields="$*"

    local fields=".$1"
    shift
    for i in "$@"; do
        fields="$fields, .$i"
    done

    if ! jsonRead "$json" "$fields" -e >/dev/null; then
        echo "One of the required fields '$requiredFields' is not present!"
        return 1
    fi
}

# checks that an argument is supplied and that it is numeric, and prints a message if not
# args: name of arg, arg value
function requireJsonArg() {
    requireArgWithCheck "$1" "$2" validateJson "a valid minified JSON string "
}

# reads (a value at a certain path from) a JSON File
# args: json file path, jq path to read (optional)
function jsonReadFile() {
    requireFileArg "JSON file" "$1" || return 1

    local jsonFile="$1"
    shift

    cat "$jsonFile" | jq -cr "$@"
}

# reads the value at a certain path from a JSON object
# args: minified json string, jq path to read
function jsonRead() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "a jq path" "$2" || return 1

    local jsonString=$1
    local jqPath="$2"
    shift && shift

    jq -cr "$@" "$jqPath" <<< $jsonString
}

# merges two JSON objects together
# args: N>2 minified json strings
function jsonMerge() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "another JSON string" "$2" || return 1

    jq -sc 'add' <<< $@
}

# merges two JSON objects together
# args: N>2 minified json strings
function jsonMergeDeep() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "another JSON string" "$2" || return 1

    jq -sc 'reduce .[] as $item ({}; . * $item)' <<< $@
}

function jsonWriteToYamlFile() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "a target file path" "$2" || return 1

    echo "$1" | prettyYaml > "$2"
}

function json5Convert() {
    requireArg "a JSON5 filepath" "$1" || return 1

    local json5filePath="$1"

    if [[ "${json5filePath: -1}" != '5' ]]; then
        dtBail "extension must be '.json5'!"
        return 1
    fi

    local jsonfilePath="${json5filePath%?}"

    # if we have json5 use it to spit out json, otherwise, poor-mans
    if ! checkCommand json5; then
        sed '/\/\/ /d' $json5filePath > $jsonfilePath
    else
        json5 -c $json5filePath
    fi

    echo $jsonfilePath
}

function jsonCheckBool() {
    requireArg "a field name" "$1" || return 1
    requireArg "a JSON string" "$2" || return 1

    echo "$2" | jq -e --arg fieldName "$1" '.[$fieldName] // empty' >/dev/null
}

function yamlToJson() {
    yq e - -j
}
