# add krew to PATH
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

function k8sEnvInit() {
    local moduleConfig=$(readDTModuleConfig k8s-env)

    if jsonCheckBool 'enabled' "$moduleConfig"; then
        local dtKubeConfigPath="$CA_DT_DIR/shell/eksconfig.yaml"
        # set user-readable-only permissions
        chmod go-r $dtKubeConfigPath

        local originalString=":$KUBECONFIG:$HOME/.kube/config"

        local conditionalAppend=$(jsonCheckBool 'override' "$moduleConfig" && echo '' || echo "$originalString")
        export KUBECONFIG="$dtKubeConfigPath$conditionalAppend"
    fi
}
k8sEnvInit

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

function k9sEnv() {
    requireArg "an AWS account name" "$1" || return 1
    requireArg "a K8s context name" "$2" || return 1
    requireArg "a K8s namespace name" "$3" || return 1

    checkAuth "$1" || awsAuth "$1"

    echo "Launching K9s in context '$2', namespace '$3'"
    k9s --context "$2" --namespace "$3" -c deployments --request-timeout 30s
}
