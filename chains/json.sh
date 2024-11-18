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
    local jsonString="$1"; shift

    requireArg "a JSON path" "$1" || return 1

    local output
    output=$(jq -cr 'getpath($ARGS.positional)' --args $* <<< "$jsonString")
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

function jsonMergeArraysDeep() {
    requireArg "a JSON string" "$1" || return 1
    requireArg "another JSON string" "$2" || return 1

    jq -n --argjson a "$1" --argjson b "$2" '
        def deepmerge(a; b):
            if a == null then b
            elif b == null then a
            elif (a | type) == "object" and (b | type) == "object" then
                reduce ((a | keys) + (b | keys) | unique)[] as $key
                    ({}; .[$key] = deepmerge(a[$key]; b[$key]))
            elif (a | type) == "array" and (b | type) == "array" then
                [range(0; ([a, b] | map(length) | max))] |
                map( . as $i | deepmerge(
                    ( $a[$i]? // null ),
                    ( $b[$i]? // null )
                ))
            else b end;
        deepmerge($a; $b)
    '
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
    requireYamlArg "filepath" "$1" || return 1

    local jsonFilePath="$(tempFile).json"
    yamlFileToJson "$1" > "$jsonFilePath"

    echo "$jsonFilePath"
}

function yamlFileToJson() {
    requireYamlArg "filepath" "$1" || return 1

    local jsonFilePath="$(tempFile).json"
    cat "$1" | yamlToJson | jq -c
}

function jsonToYamlConvert() {
    requireJsonArg "filepath" "$1" || return 1

    local jsonFilePath="$1"

    local yamlFilePath="${jsonFilePath%json}yaml"
    jsonWriteToYamlFile "$(cat $jsonFilePath)" "$yamlFilePath"

    echo "$yamlFilePath"
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

function jsonMakeArray() {
    requireArg "at least one array item" "$1" || return 1

    printf '%s\n' "$@" | jq -R . | jq -cs '
        map(if (tonumber? // null) != null then tonumber else . end)'
}

function yamlFileSetField() {
    requireYamlArg "file path" "$1" || return 1
    requireArg "a field value" "$2" || return 1
    requireArg "a field path" "$3" || return 1

    local file="$1"; shift
    local fieldValue="$1"; shift

    # echo "file: $file" >&2
    # echo "fieldValue: $fieldValue" >&2

    # Convert the field path to a JSON array, converting numeric strings to numbers
    local pathArray="$(jsonMakeArray "$@")"

    # echo "pathArray: $pathArray" >&2

    # Read the YAML file and convert it to JSON
    local fileContents
    if ! fileContents=$(yamlFileToJson "$file"); then
        echo "Error: Failed to read or parse YAML file '$file'" >&2
        return 1
    fi

    # echo "fileContents: $fileContents" >&2

    # Determine if fieldValue is a valid JSON literal
    local valueArg=("--arg$(jq -e . >/dev/null 2>&1 <<<"$fieldValue" && echo "json")" value "$fieldValue")

    # Use jq to set the value at the specified path
    local newContents="$(jsonRead "$fileContents" \
        'setpath($path; $value)' \
        "${valueArg[@]}" \
        --argjson path "$pathArray" \
    )"
    [[ -z "$newContents" ]] && return 1

    # echo "newContents: $newContents" >&2

    # Convert the updated JSON back to YAML and output it
    echo "$newContents" | prettyYaml
}

function yamlFileSetFieldWrite() {
    requireYamlArg "file path" "$1" || return 1
    requireArg "a field value" "$2" || return 1
    requireArg "a field path" "$3" || return 1

    yamlFileSetField $* > "$1.new"
    mv "$1.new" "$1"
}
