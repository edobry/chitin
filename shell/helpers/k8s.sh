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

# scales down a deployment to 0 replicas, and awaits the operation's completion
# args: deployment name
function downDeployAndWait() {
    requireArg "a deployment name" "$1" || return 1

    downDeploy "$1"
    k8sWaitForDeploymentScaleDown "$1"
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
    local chartDir=$CA_DT_DIR/charts/debug-pod
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
    kubectl get secret regcred -o=json | jq -r '.data. ".dockerconfigjson"' | base64Decode | jq '.'
}

# fetches and prints the image pull secret's auth string, for debugging
function getRegcredAuthString() {
    getRegcred | jq -r ".auths .\"$1\" .auth" | base64Decode
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

    local url=$(k8sGetServiceEndpoint $service)
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
function k8sGetServiceExternalUrl() {
    requireArg "a service name" $1 || return 1

    local svc=$(kubectl get service $1 -o=json)
    local hostname=$(echo "$svc" | jq -r '.status.loadBalancer.ingress[0].hostname')
    local port=$(echo "$svc" | jq -r '.spec.ports[0].port')

    echo "$hostname:$port"
}

# fetch the endpoint url for both services and proxies to zen garden
function k8sGetServiceEndpoint() {
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

# gets the container image for a given resource
# args: resource type, resource id, namespace
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

function findVolumeIdByPVC() {
    requireArg "a namespace" "$1" || return 1
    requireArg "a persistent volume claim name" "$2" || return 1

    local namespace="$1"
    local persistentVolumeClaimName="$2"

    volumeName=$(kubectl -n $namespace get pvc --field-selector metadata.name=$persistentVolumeClaimName -o jsonpath='{.items[0].spec.volumeName}')

    if [[ -z "$volumeName" ]]; then
        echo "ERROR: trying to get volumeName for persistentVolumeClaimName $persistentVolumeClaimName in namespace $namespace"
        return
    fi

    volumeId=$(kubectl -n $namespace get pv --field-selector metadata.name=$volumeName -o jsonpath='{.items[0].spec.csi.volumeHandle}')

    if [[ -z "$volumeId" ]]; then
        echo "ERROR: trying to get volumeId/volumeHandle for persistentVolume $volumeName in namespace $namespace"
        return
    fi

    echo "$volumeId"
}

function createVolumeTags() {
    requireArg "a namespace" "$1" || return 1
    requireArg "a persistent volume claim name" "$2" || return 1
    requireArg "a deployment" "$3" || return 1
    requireArg "a product" "$4" || return 1

    local namespace="$1"
    local persistentVolumeClaimName="$2"
    local deployment="$3"
    local product="$4"

    volumeId=$(findVolumeIdByPVC $1 $2)

    if [[ -z "$volumeId" ]]; then
        return
    fi

    echo "tagging volumeId: $volumeId deployment: $deployment product=$product"
    aws ec2 create-tags --resources $volumeId --tags Key=kube_deployment,Value=$deployment Key=Name,Value=$deployment Key=product,Value=$product
}

function snapshotAndScale() {
    requireArg "a namespace" "$1" || return 1
    requireArg "a persistent volume claim name" "$2" || return 1
    requireArg "a deployment" "$3" || return 1
    requireArg "a template file" "$4" || return 1

    local namespace="$1"
    local persistentVolumeClaimName="$2"
    local deployment="$3"
    local templateFile="$4"

    volumeId=$(findVolumeIdByPVC $1 $2)

    if [[ -z "$volumeId" ]]; then
        return
    fi

    replicas=$(kubectl get deployment $deployment -o jsonpath='{.spec.replicas}')

    if [[ -z "$replicas" ]]; then
        echo "ERROR: unable to get replicas for deployment: $deployment in namespace: $namespace"
        return
    fi

    echo "scale deployment $deployment to zero"
    kubectl -n $namespace scale deployment $deployment --replicas=0
    echo "take snapshot of $volumeId"
    cat $templateFile | sed -e "s/timestamp/$(date '+%Y%m%d%H%M')/g" > ~/snapshot.yaml
    kubectl -n $namespace apply -f ~/snapshot.yaml
    echo "scale deployment $deployment to $replicas replicas"
    kubectl -n $namespace scale deployment $deployment --replicas=$replicas
}

# gets the token for a given ServiceAccount
# args: svc acc name
function getServiceAccountToken() {
    requireArg "a service account name" "$1" || return 1
    checkAuthAndFail || return 1

    local serviceAccountTokenName=$(kubectl get serviceaccounts $1 -o json | jq -r '.secrets[0].name')
    kubectl get secrets $serviceAccountTokenName -o json | jq -r '.data.token' | base64Decode
}

# creates a temporary k8s context for a ServiceAccount
# args: svc acc name
function createTmpK8sSvcAccContext() {
    requireArg "a service account name" "$1" || return 1
    local svcAccountName="$1"

    local token=$(getServiceAccountToken "$svcAccountName")
    kubectl config set-credentials $svcAccountName --token $token > /dev/null

    local currentCtx=$(getCurrentK8sContext)

    local ctxName="tmp-ctx-svc-acc-$svcAccountName"
    kubectl config set-context $ctxName \
        --cluster $(readJSON "$currentCtx" '.cluster') \
        --namespace $(readJSON "$currentCtx" '.namespace') \
        --user $svcAccountName > /dev/null

    echo "$ctxName"
}

# impersonates a given ServiceAccount and runs a command
# args: svc acc name, command name, command args (optional[])
function runAsServiceAccount() {
    requireArg "a service account name" "$1" || return 1
    requireArg "a command name" "$2" || return 1
    checkAuthAndFail || return 1

    local svcAccountName="$1"
    local command="$2"
    shift && shift

    echo "Creating temporary service account context for '$svcAccountName'..."
    local ctxName=$(createTmpK8sSvcAccContext $svcAccountName)
    local currentCtx=$(kubectx -c)
    kubectx $ctxName

    echo "Running command in context..."
    echo -e "\n------ START COMMAND OUTPUT ------"
    $command $*
    echo -e "------ END COMMAND OUTPUT ------\n"

    echo "Cleaning up temporary context..."
    kubectx $currentCtx
    deleteK8sContext $ctxName
}

# impersonates a given ServiceAccount and runs a kubectl command using its token
# args: svc acc name, kubectl command name, command args (optional[])
function kubectlAsServiceAccount() {
    requireArg "a service account name" "$1" || return 1
    requireArg "a kubectl command to run" "$2" || return 1

    local svcAccountName="$1"
    shift

    runAsServiceAccount $svcAccountName kubectl $*
}

function k8sNamespaceExists() {
    requireArg "a namespace" "$1" || return 1

    kubectl get namespaces "$1" --output=json > /dev/null 2>&1
}

function k8sAwaitPodCondition() {
    requireArg "a pod name" "$1" || return 1
    requireArg "a condition" "$2" || return 1

    kubectl wait --for=condition="$2" pod/"$1"

}

# gets the pod selector used for a given Deployment
# args: deployment name
function k8sGetDeploymentSelector() {
    requireArg "a deployment name" "$1" || return 1

    kubectl get deployment "$1" --output json | jq -r \
        '.spec.selector.matchLabels | to_entries | map("\(.key)=\(.value)") | join(",")'
}

# gets an annotation value for the given resource
# args: resource type, resource name, annotation
function k8sGetResourceAnnotation() {
    requireArg "a resource type" "$1" || return 1
    requireArg "a resource name" "$2" || return 1
    requireArg "an annotation name" "$3" || return 1

    kubectl get "$1" "$2" --output json | jq -r --arg annotation "$3" \
        '.metadata.annotations[$annotation]'
}

# gets the external hostname created for a given Service
# args: service name
function k8sGetServiceExternalHostname() {
    requireArg "a service name" "$1" || return 1

    k8sGetResourceAnnotation service "$1" 'external-dns.alpha.kubernetes.io/hostname'
}

# gets the pods managed by a given Deployment
# args: deployment name
function k8sGetDeploymentPods() {
    requireArg "a deployment name" "$1" || return 1

    local deploymentName="$1"
    shift

    kubectl get pods --selector=$(k8sGetDeploymentSelector "$deploymentName") $*
}

# checks whether a given Deployment has running pods under management
# args: deployment name
function k8sDeploymentHasPods() {
    requireArg "a deployment name" "$1" || return 1

    k8sGetDeploymentPods "$1" -o=json | jq -e '.items[0]' >/dev/null 2>&1
}

# waits until all pods under management of a given Deployment have scaled down
# args: deployment name
function k8sWaitForDeploymentScaleDown() {
    requireArg "a deployment name" "$1" || return 1

    local deploymentName="$1"

    while k8sDeploymentHasPods $deploymentName
    do
        echo "Waiting for scale down..."
    done

    echo "Deployment '$1' has successfuly scaled down"
}

function k8sListDeployments() {
    kubectl get deployments | tail -n +2 | cut -d ' ' -f 1
}

function k8sListPods() {
    kubectl get pods | tail -n +2 | cut -d ' ' -f 1
}

function k8sListServices() {
    kubectl get services | tail -n +2 | cut -d ' ' -f 1
}

function k8sListPostgresServices() {
    kubectl get services | grep postgres | tail -n +2 | cut -d ' ' -f 1
}

function k8sApplyInstance() {
    requireArg "an instance name" "$1" || return 1
    requireArg "the manifest directory" "$2" || return 1

    kubectl apply -f "$2" -l instance="$1"
}

function k8sDeleteInstance() {
    requireArg "an instance name" "$1" || return 1

    kubectl delete -l instance="$1" $(k8sGetResourceList delete)
}

function k8sGetResourceList() {
    requireArg "an API verb" "$1" || return 1

    kubectl api-resources --namespaced=true --verbs="$1" -o name | tr '\n' ,| sed 's/,$//'
}

function k8sGetAllResources() {
    kubectl get $(k8sGetResourceList list) --ignore-not-found $@
}
