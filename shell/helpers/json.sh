function parseStream() {
    jq . -c | jq .
}

function prettyJson() {
    jq '.'
}

function prettyYaml() {
    yq e -P -
}

function validateJSON() {
    requireArg "a minified JSON string" "$1" || return 1

    echo "$1" | jq -e . > /dev/null 2>&1
}

function validateJSONFile() {
    requireFileArg "JSON file" "$1" || return 1

    validateJSON $(readJSONFile "$1")
}

# reads (a value at a certain path from) a JSON File
# args: json file path, jq path to read (optional)
function readJSONFile() {
    requireFileArg "JSON file" "$1" || return 1

    local jsonFile="$1"

    if [[ ! -f "$1" ]]; then
        echo "No file exists at the given path!"
        return 1
    fi

    shift
    cat "$jsonFile" | jq -cr $*
}

# reads the value at a certain path from a JSON object
# args: minified json string, jq path to read
function readJSON() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "a jq path" "$2" || return 1

    local jsonString=$1
    local jqPath="$2"
    shift && shift

    jq -cr $* "$jqPath" <<< $jsonString
}

# merges two JSON objects together
# args: N>2 minified json strings
function mergeJSON() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "another JSON string" "$2" || return 1

    jq -s 'add' <<< $@
}

function writeJSONToYamlFile() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "a target file path" "$2" || return 1

    echo "$1" | prettyYaml > "$2"
}

function convertJSON5() {
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
