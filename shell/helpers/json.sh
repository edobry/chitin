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
    jq -cr "$2" <<< $1
}

# merges two JSON objects together
# args: 2 minified json strings
function mergeJSON() {
    jq -s 'add' <<< $@
}
