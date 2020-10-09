function parseStream() {
    jq . -c | jq .
}

function prettyJson() {
    jq '.'
}

function prettyYaml() {
    yq r -PC -
}

function prettyYamlMultiple() {
    yq r -PCd'*' -
}

# reads the value at a certain path from a JSON object
# args: minified json string, path to read
function readJSON() {
    requireArg "a JSON string" $1 || return 1
    requireArg "a jq path" $2 || return 1

    jq -cr "$2" <<< $1
}

# merges two JSON objects together
# args: N>2 minified json strings
function mergeJSON() {
    requireArg "a JSON string" $1 || return 1
    requireArg "another JSON string" $2 || return 1

    jq -s 'add' <<< $@
}
