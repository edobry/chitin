# add krew to PATH
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

if [ "$CA_DT_K8S_CONFIG_ENABLED" = true ]; then
    export KUBECONFIG="$CA_DT_DIR/eksconfig.yaml:$KUBECONFIG:$HOME/.kube/config"
fi

# gets the current k8s context config
function getCurrentK8sContext() {
    kubectl config view -o json | jq -cr --arg ctx $(kubectl config current-context) \
        '.contexts[] | select(.name == $ctx).context'
}

# deletes a k8s context
# args: context name
function deleteK8sContext() {
    requireArg "a context name" "$1" || return 1
    local contextName="$1"

    kubectl config delete-context $contextName
}
