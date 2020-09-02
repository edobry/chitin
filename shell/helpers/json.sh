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
