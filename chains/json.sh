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

    validateJson "$(jsonReadFile "$1")"
}

function jsonValidateFields() {
    requireJsonArg "to validate" "$1" || return 1
    local json="$1"; shift

    if ! jsonRead "$json" $* -e >/dev/null; then
        echo "One of the required fields '$*' is not present!"
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
    local jsonFile="$1"; shift

    cat "$jsonFile" | jq -cr "$@"
}

# reads the value at a certain path from a JSON object
# args: minified json string, jq path to read
function jsonRead() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "a jq path" "$2" || return 1

    local jsonString="$1"; shift
    local jqPath="$1"; shift

    jq -cr $@ "$jqPath" <<< "$jsonString"
}

function jsonReadPath() {
    requireArg "a JSON string" "$1" || return 1
    local json="$1"; shift

    requireArg "a JSON path" "$1" || return 1

    local output
    output=$(echo "$json" | jq -rc 'getpath($ARGS.positional)' --args $*)
    local jqExit=$?

    if [[ $jqExit -ne 0 ]]; then
        # jq encountered a runtime error
        return $jqExit
    elif [[ "$output" == "null" ]] || [[ -z "$output" ]]; then
        return 1
    else
        # Output exists; print it and return with code 0
        echo "$output"
        return 0
    fi
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

    jq -sc 'reduce .[] as $item ({}; . * $item)' <<< "$@"
}

function jsonWriteToYamlFile() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "a target file path" "$2" || return 1

    echo "$1" | prettyYaml > "$2"
}

function json5Convert() {
    requireArg "a JSON5 filepath" "$1" || return 1

    local json5filePath="$1"
    checkExtension "$json5filePath" "json5" || return 1

    local jsonFilePath="$(tempFile).json"

    # if we have json5 use it to spit out json, otherwise, poor-mans
    if ! checkCommand json5; then
        sed '/\/\/ /d' $json5filePath > $jsonFilePath
    else
        cat "$json5filePath" | json5 | jq -c > "$jsonFilePath"
    fi

    echo $jsonFilePath
}

function yamlConvert() {
    requireArg "a YAML filepath" "$1" || return 1

    local yamlFilePath="$1"
    checkExtension "$yamlFilePath" "yaml" || return 1

    local jsonFilePath="$(tempFile).json"
    cat $yamlFilePath | yamlToJson | jq -c > $jsonFilePath

    echo $jsonFilePath
}

function jsonToYamlConvert() {
    requireArg "a JSON filepath" "$1" || return 1

    local jsonFilePath="$1"

    checkExtension "$jsonFilePath" "json" || return 1

    local yamlFilePath="${jsonFilePath%json}yaml"
    jsonWriteToYamlFile "$(cat $jsonFilePath)" $yamlFilePath

    echo $yamlFilePath
}

function jsonCheckBool() {
    requireArg "a field name" "$1" || return 1
    requireArg "a JSON string" "$2" || return 1

    echo "$2" | jq -e --arg fieldName "$1" '.[$fieldName] // empty' >/dev/null
}

function yamlToJson() {
    yq e - -o=json
}

function batYaml() {
    bat --language yaml --
}

function jsonReadBoolPath() {
    requireArg "a JSON string" "$1" || return 1
    local json="$1"; shift

    requireArg "a JSON path" "$1" || return 1

    local output
    output=$(jsonReadPath "$json" $*)

    if [[ "$?" -ne 0 ]]; then
        echo "the path does not exist!" >&2
        return 1
    elif [[ "$output" =~ ^(true|false)$ ]]; then
        echo "$output"
    else
        echo "the path does not contain a boolean value!" >&2
        return 1
    fi
}

function jsonCheckBoolPath() {
    requireArg "a JSON string" "$1" || return 1
    local json="$1"; shift

    requireArg "a JSON path" "$1" || return 1

    local value
    value=$(jsonReadBoolPath "$json" $* 2>/dev/null)
    [[ $? -eq 0 ]] || return 1

    [[ "$value" == "true" ]]
}
