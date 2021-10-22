CA_DT_SECRETS_MODULE_NAME=dtSecret

# retrieves a secret with the given name from the secret store
function dtSecretGet() {
    requireArg "a secret name" "$1" || return 1

    local commandField=command

    local secretCommand
    secretCommand=$(dtReadModuleConfigField "$CA_DT_SECRETS_MODULE_NAME" command)
    if [[ $? -ne 0 ]]; then
        echo "$secretCommand"
        return 1
    fi
    
    if [[ -z "$secretCommand" ]]; then
        dtLog "'$CA_DT_SECRETS_MODULE_NAME' config section not initialized, please set '$commandField' field!"
        return 1
    fi

    $secretCommand "$1"
}
