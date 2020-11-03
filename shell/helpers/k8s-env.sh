# add krew to PATH
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

if [ "$CA_DT_K8S_CONFIG_ENABLED" = true ]; then
    export KUBECONFIG="$CA_DT_DIR/eksconfig.yaml:$KUBECONFIG:$HOME/.kube/config"
fi
