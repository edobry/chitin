#!/bin/bash

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
# args: all args passed to DebugPod chart
function debugPod() {
    local baseName="debug-pod"
    local debugPodName="$baseName-$(randomString 8)"

    echo -e "\nGenerating '$baseName' manifest..."
    local chartDir=$DT_DIR/../charts/debug-pod
    pushd $chartDir > /dev/null

    npm run compile
    node main.js --config config.json --name "$debugPodName" $*

    echo -e "\nDeploying to K8s..."
    local manifests=$(ls dist/*)
    cat $manifests | kubectl apply -f -
    popd > /dev/null

    echo -e "\nAwaiting pod creation..."
    # TODO: fail on timeout
    kubectl wait --for=condition=Ready pod/$debugPodName
    if [[ ! $? ]]; then
        echo -e "\Pod did not start up in time! Exiting..."
        return 1
    fi

    echo -e "\n---------------- START POD OUTPUT ----------------"
    kubectl exec $debugPodName --container "$baseName" -i --tty -- /bin/bash
    echo -e "\n---------------- END POD OUTPUT ----------------"

    echo -e "\nCleaning up pod..."
    kubectl delete pods $debugPodName --grace-period=10 --wait=true
}

# fetches and pretty-prints the image pull secret
function getRegcred() {
    kubectl get secret regcred -o=json | jq -r '.data. ".dockerconfigjson"' | base64 -D | jq '.'
}

# fetches and prints the image pull secret's auth string, for debugging
function getRegcredAuthString() {
    getRegcred | jq -r ".auths .\"$1\" .auth" | base64 -D
}

dashboardNamespace="kubernetes-dashboard"

# fetches the admin user token, can be used for authorizing with the dashboard
function getToken() {
    local user="admin-user"

    local adminSecret="$(kubectl -n $dashboardNamespace get secret | grep $user | awk '{print $1}')"
    kubectl -n $dashboardNamespace describe secret $adminSecret | grep 'token:' | awk '{print $2}' | toClip
}

function dashboard() {
    echo "Launching dashboard..."
    echo "Copying token to clipboard..."
    getToken

    echo -e "\nOpening URL (might need a refresh):"
    local url="http://localhost:8001/api/v1/namespaces/$dashboardNamespace/services/https:dashboard-kubernetes-dashboard:https/proxy/"
    echo -e "\n$url\n"

    openUrl $url

    kubectl proxy
}

# opens psql connected to an rds db
# $1: service name of rds instance (ex. postgres-erc20)
# $2: db name (ex. jsondb), defaults to "postgres"
# $*: passed through to psql. $2 must be set
# ex: rds postgres-erc20 jsondb -c "select max(bid) from erc20"
function rds() {
    [ -z $1 ] && echo "missing RDS service" && return
    service=$1
    shift

    url=$(getServiceEndpoint $service)
    [ -z $url ] && return;
    json=$(kubectl get secret $service-user -o json | jq .data)
    user=$(jq .username -r <<< $json| base64 --decode)
    password=$(jq .password -r <<< $json | base64 --decode)

    db=${1:-'postgres'}
    [ $1 ] && shift;

    psql postgres://$user:$password@$url/$db "$*"
}

function kconfig() {
    kubectl get pod -o yaml $1 | bat -p -l yaml
}

# fetches the external url, with port, for a Service with a load balancer configured
# args: service name
function getServiceExternalUrl() {
    local svc=$(kubectl get service $1 -o=json)
    local hostname=$(echo "$svc" | jq -r '.status.loadBalancer.ingress[0].hostname')
    local port=$(echo "$svc" | jq -r '.spec.ports[0].port')

    echo "$hostname:$port"
}

# fetch the endpoint url for both services and proxies to zen garden
function getServiceEndpoint() {
    service=$(kubectl describe services $1)
    kind=$(grep "Type:" <<< $service | awk '{print $2}')
    if [[ $kind == 'ClusterIP' ]]; then
        echo $(grep 'Endpoints' <<< $service | awk '{print $2}')
        return
    fi
    if [ $kind = 'ExternalName' ]; then
        echo $(grep 'External Name' <<< $service | awk '{print $3}')
        return
    fi
    echo "Unknown service type"
}

# kills all pods for a deployment, useful for forcing a restart during dev
# args: deployment name
function killDeploymentPods() {
    local deployment="$1"

    if [[ -z $deployment ]]; then
        echo "Please supply a deployment name!"
        return 1;
    fi

    kubectl delete pods --selector app.kubernetes.io/instance=$deployment
}
