# retrieves a secret with the given name from the secret store
function chiSecretGet() {
    requireArg "a secret name" "$1" || return 1

    local commandField="tool"

    local secretCommand
    secretCommand="$(chiConfigUserReadModule core secret "$commandField")"
    if [[ $? -ne 0 ]]; then
        echo "$secretCommand"
        return 1
    fi
    
    if [[ -z "$secretCommand" ]]; then
        chiLogError "config section not initialized, please set '$commandField' field!" core secret
        return 1
    fi

    $secretCommand "$1"
}
