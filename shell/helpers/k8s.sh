# add krew to PATH
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

# base64-encodes a string for use in a Secret
function secretEncode() {
   echo -n "$1" | base64 | toClip
}

# deprecated older version of the debug pod, only creates, does not manage lifecyle
function netshoot() {
    kubectl run --generator=run-pod/v1 tmp-shell --rm -i --tty --image nicolaka/netshoot -- /bin/bash
}

# scales down a deployment to 0 replicas, effectively pausing
# args: deployment name
function downDeploy() {
    kubectl scale deployment $1 --replicas=0
}

# scales a previously-paused deployment back up to 1 replica
# args: deployment name
function upDeploy() {
    kubectl scale deployment $1 --replicas=1
}

# cycles a deployment, useful when you want to trigger a restart
# args: deployment name
function reDeploy() {
    downDeploy $1
    upDeploy $1
}

# launches a debug pod in the cluster preloaded with common networking tools,
# drops you into its shell when created. randomizes the name, and cleans up after
function debugPod() {
    local baseName="test-shell"
    local debugPodName="$baseName-$(randomString 8)"

    yq w $DT_DIR/helpers/resources/debugPod.yaml "metadata.name" "$debugPodName" \
        | kubectl apply -f -

    kubectl wait --for=condition=Ready pod/$debugPodName
    kubectl exec $debugPodName --container "$baseName" -i --tty -- /bin/bash
    kubectl delete pods $debugPodName --grace-period=0 --force
}

# fetches and pretty-prints the image pull secret
function getRegcred() {
    kubectl get secret regcred -o=json | jq -r '.data. ".dockerconfigjson"' | base64 -D | jq '.'
}

# fetches and prints the image pull secret's auth string, for debugging
function getRegcredAuthString() {
    getRegcred | jq -r ".auths .\"$1\" .auth" | base64 -D
}

# fetches the EKS admin token, can be used for authorizing with the dashboard
function getToken() {
    local eksAdminSecret="$(kubectl -n kube-system get secret | grep eks-admin | awk '{print $1}')"
    kubectl -n kube-system describe secret $eksAdminSecret | grep 'token:' | awk '{print $2}' | toClip
}

# EVERYTHING BELOW THIS LINE IS WIP
# ---------------------------------

HELM_HOME="$PROJECT_DIR/dataeng-pipeline/charts"
EXTERNAL_DIR="$HELM_HOME/external"
function makeService() {
    local name=$1
    shift
    helm template $name $EXTERNAL_DIR/service --set name=$name $*
}
