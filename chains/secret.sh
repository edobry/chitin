export CHI_SECRETS_CHAIN_NAME="core:chiSecret"

# retrieves a secret with the given name from the secret store
function chiSecretGet() {
    requireArg "a secret name" "$1" || return 1

    local commandField="tool"

    local secretCommand
    secretCommand=$(chiConfigChainReadField "$CHI_SECRETS_CHAIN_NAME" "$commandField")
    if [[ $? -ne 0 ]]; then
        echo "$secretCommand"
        return 1
    fi
    
    if [[ -z "$secretCommand" ]]; then
        chiLog "config section not initialized, please set '$commandField' field!" "$CHI_SECRETS_CHAIN_NAME"
        return 1
    fi

    $secretCommand "$1"
}
