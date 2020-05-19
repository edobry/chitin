# add krew to PATH
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

function secretEncode() {
   echo -n "$1" | base64 | pbcopy
}

alias netshoot='kubectl run --generator=run-pod/v1 tmp-shell --rm -i --tty --image nicolaka/netshoot -- /bin/bash'

function downDeploy() {
    kubectl scale deployment $1 --replicas=0
}

function upDeploy() {
    kubectl scale deployment $1 --replicas=1
}

function reDeploy() {
    downDeploy $1
    upDeploy $1
}

DP_DEV_DIR=$PROJECT_DIR/dataeng-pipeline/dev
function debugPod() {
    local debugPodName="test-shell-$(randomString 8)"

    k apply -f $DP_DEV_DIR/debugPod.yaml
    k wait --for=condition=Ready pod/$debugPodName
    k exec $debugPodName --container $debugPodName -i --tty -- /bin/bash
    k delete pods $debugPodName --grace-period=0 --force
}

function getToken() {
    local eksAdminSecret="$(kubectl -n kube-system get secret | grep eks-admin | awk '{print $1}')"
    kubectl -n kube-system describe secret $eksAdminSecret | grep 'token:' | awk '{print $2}' | pbcopy
}

TF_DIR="$PROJECT_DIR/terraform"
TF_DATAENG_DIR="$TF_DIR/env/dataeng"
# args:
# example usage: runTF dev bnb-kafka output msk_bootstrap_brokers
function runTF() {
    cd $TF_DATAENG_DIR-$1/$2 && shift
    terraform $*
    cd $OLDPWD
}

HELM_HOME="$PROJECT_DIR/dataeng-pipeline/charts"
EXTERNAL_DIR="$HELM_HOME/external"
function makeService() {
    local name=$1
    shift
    helm template $name $EXTERNAL_DIR/service --set name=$name $*
}

# fetches and pretty-prints the image pull secret
function getRegcred() {
    kubectl get secret regcred -o=json | jq -r '.data. ".dockerconfigjson"' | base64 -D | jq '.'
}

# fetches and prints the image pull secret's auth string, for debugging
function getRegcredAuthString() {
    getRegcred | jq -r ".auths .\"$1\" .auth" | base64 -D
}
