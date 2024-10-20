CHI_SECRETS_CHAIN_NAME=chiSecret

# retrieves a secret with the given name from the secret store
function chiSecretGet() {
    requireArg "a secret name" "$1" || return 1

    local commandField=command

    local secretCommand
    secretCommand=$(chiReadChainConfigField "$CHI_SECRETS_CHAIN_NAME" command)
    if [[ $? -ne 0 ]]; then
        echo "$secretCommand"
        return 1
    fi
    
    if [[ -z "$secretCommand" ]]; then
        chiLog "'$CHI_SECRETS_CHAIN_NAME' config section not initialized, please set '$commandField' field!"
        return 1
    fi

    $secretCommand "$1"
}
