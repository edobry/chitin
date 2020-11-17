# base64-encodes a string for use in a Secret
function secretEncode() {
    requireArg "a secret" $1 || return 1

    echo -n "$1" | base64 | toClip
}

# deprecated older version of the debug pod, only creates, does not manage lifecyle
function netshoot() {
    kubectl run --generator=run-pod/v1 tmp-shell --rm -i --tty --image nicolaka/netshoot -- /bin/bash
}

# scales down a deployment to 0 replicas, effectively pausing
# args: deployment name
function downDeploy() {
    requireArg "a deployment name" $1 || return 1
    kubectl scale deployment $1 --replicas=0
}

# scales a previously-paused deployment back up to 1 replica
# args: deployment name
function upDeploy() {
    requireArg "a deployment name" $1 || return 1
    kubectl scale deployment $1 --replicas=1
}

# cycles a deployment, useful when you want to trigger a restart
# args: deployment name
function reDeploy() {
    requireArg "a deployment name" $1 || return 1

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
    local chartDir=$CA_DT_DIR/../charts/debug-pod
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
    requireArg "a DB service name" $1 || return 1
    local service=$1
    shift

    local url=$(getServiceEndpoint $service)
    [ -z $url ] && return;
    local json=$(kubectl get secret $service-user -o json | jq .data)
    local user=$(jq .username -r <<< $json| base64 --decode)
    local password=$(jq .password -r <<< $json | base64 --decode)

    local db=${1:-'postgres'}
    [ $1 ] && shift;

    psql postgres://$user:$password@$url/$db "$*"
}

function kconfig() {
    requireArg "a pod name" $1 || return 1
    kubectl get pod -o yaml $1 | bat -p -l yaml
}

# fetches the external url, with port, for a Service with a load balancer configured
# args: service name
function getServiceExternalUrl() {
    requireArg "a service name" $1 || return 1

    local svc=$(kubectl get service $1 -o=json)
    local hostname=$(echo "$svc" | jq -r '.status.loadBalancer.ingress[0].hostname')
    local port=$(echo "$svc" | jq -r '.spec.ports[0].port')

    echo "$hostname:$port"
}

# fetch the endpoint url for both services and proxies to zen garden
function getServiceEndpoint() {
    requireArg "a service name" $1 || return 1

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
    requireArg "a deployment name" $1 || return 1
    local deployment="$1"

    kubectl delete pods --selector app.kubernetes.io/instance=$deployment
}

function getK8sImage() {
    requireArg "a resource type" "$1" || return 1
    requireArg "a resource identifier" "$2" || return 1
    requireArg "a namespace" "$3" || return 1

    local resourceType="$1"
    local resourceId="$2"
    local namespace="$3"

    kubectl get $resourceType $resourceId --namespace $namespace \
        -o=jsonpath='{$.spec.template.spec.containers[:1].image}'
}

function extractEKSImageVersion() {
    requireArg "an EKS Docker image" "$1" || return 1

    echo "$1" | cut -d ":" -f 2 | sed 's/-eksbuild\.1//'
}

function getK8sImageVersion() {
    requireArg "a resource type" "$1" || return 1
    requireArg "a resource identifier" "$2" || return 1
    requireArg "a namespace" "$3" || return 1

    local resourceType="$1"
    local resourceId="$2"
    local namespace="$3"

    echo "Checking current version of $resourceId..."
    local currentImage=$(getK8sImage $resourceType $resourceId $namespace)

    extractEKSImageVersion "$currentImage"
}

function upgradeK8sComponent() {
    requireArg "a resource type" "$1" || return 1
    requireArg "a resource identifier" "$2" || return 1
    requireArg "a namespace" "$3" || return 1
    requireArg "the new version" "$4" || return 1
    checkAuthAndFail || return 1

    local resourceType="$1"
    local resourceId="$2"
    local namespace="$3"
    local newVersion="v$4"

    local currentImage=$(getK8sImage $resourceType $resourceId $namespace)
    local currentVersion=$(extractEKSImageVersion $currentImage)

    if [[ $currentVersion == $newVersion ]]; then
        echo "Current version of $resourceId is already up-to-date!"
        return 0
    fi

    local newVersionImage=$(echo "$currentImage" | awk -F':' -v ver="$newVersion" '{ print $1 ":" ver "-eksbuild.1" }')

    echo "Upgrading version of $resourceId from $currentVersion to $newVersion..."
    kubectl set image $resourceType.apps/$resourceId \
        -n $namespace $resourceId=$newVersionImage

    echo "Done!"
}

function upgradeK8sVpcCniPlugin() {
    requireArg "the new version" "$1" || return 1
    requireArg "the region" "$2" || return 1
    checkAuthAndFail || return 1

    local resourceType="daemonset"
    local resourceId="aws-node"
    local namespace="kube-system"
    local newVersion="v$1"
    local region="$2"

    local currentImage=$(getK8sImage $resourceType $resourceId $namespace)
    local currentVersion=$(extractEKSImageVersion $currentImage)

    if [[ $currentVersion == $newVersion ]]; then
        echo "Current version of $resourceId is already up-to-date!"
        return 0
    fi

    local newVersionImage=$(echo "$currentImage" | awk -F':' -v ver="$newVersion" '{ print $1 ":" ver "-eksbuild.1" }')

    echo "Upgrading version of $resourceId from $currentVersion to $newVersion..."

    local tmpFile=$(tempFile)
    curl -s -o $tmpFile https://raw.githubusercontent.com/aws/amazon-vpc-cni-k8s/$newVersion/config/v1.7/aws-k8s-cni.yaml
    sed -i -e "s/us-west-2/$region/" $tmpFile
    kubectl apply -f $tmpFile

    echo "Done!"
}


function upgradeEKS() {
    requireArg "the new K8s version" "$1" || return 1
    requireArg "the new kube-proxy version" "$2" || return 1
    requireArg "the new CoreDNS version" "$3" || return 1
    requireArg "the region" "$4" || return 1
    checkAuthAndFail || return 1

    local newClusterVersion="$1"
    local newKubeProxyVersion="$2"
    local newVpcCniPluginVersion="$3"
    local region="$4"

    upgradeK8sComponent daemonset kube-proxy kube-system $newKubeProxyVersion
    upgradeK8sComponent deployment coredns kube-system $newCoreDnsVersion
    upgradeK8sVpcCniPlugin $newVpcCniPluginVersion $region
}
