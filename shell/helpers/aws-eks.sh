function extractEksImageVersion() {
    requireArg "an EKS Docker image" "$1" || return 1

    echo "$1" | cut -d ":" -f 2 | sed 's/-eksbuild\.1//'
}

function getEKSImageVersion() {
    requireArg "a resource type" "$1" || return 1
    requireArg "a resource identifier" "$2" || return 1
    requireArg "a namespace" "$3" || return 1

    local resourceType="$1"
    local resourceId="$2"
    local namespace="$3"

    echo "Checking current version of $resourceId..."
    local currentImage=$(getK8sImage $resourceType $resourceId $namespace)

    extractEksImageVersion "$currentImage"
}

function upgradeEksComponent() {
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
    local currentVersion=$(extractEksImageVersion $currentImage)

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

function upgradeEksVpcCniPlugin() {
    requireArg "the new version" "$1" || return 1
    requireArg "the region" "$2" || return 1
    checkAuthAndFail || return 1

    local resourceType="daemonset"
    local resourceId="aws-node"
    local namespace="kube-system"
    local newVersion="v$1"
    local region="$2"

    local currentImage=$(getK8sImage $resourceType $resourceId $namespace)
    local currentVersion=$(extractEksImageVersion $currentImage)

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
    requireArg "the new VPC CNI Plugin version" "$3" || return 1
    requireArg "the region" "$4" || return 1
    checkAuthAndFail || return 1

    local newClusterVersion="$1"
    local newKubeProxyVersion="$2"
    local newCoreDnsVersion="$3"
    local newVpcCniPluginVersion="$4"
    local region="$4"

    echo "Upgrading cluster components to version $newClusterVersion..."

    upgradeEksComponent daemonset kube-proxy kube-system $newKubeProxyVersion
    upgradeEksComponent deployment coredns kube-system $newCoreDnsVersion
    upgradeEksVpcCniPlugin $newVpcCniPluginVersion $region
}

function listEksNodegroups() {
    requireArg "a cluster name" "$1" || return 1
    checkAuthAndFail || return 1

    aws eks list-nodegroups --cluster-name "$1" | jq -r '.nodegroups[]'
}

function listEksClusters() {
    checkAuthAndFail || return 1

    aws eks list-clusters | jq -r '.clusters[]'
}

function updateEksNodegroups() {
    requireArg "a cluster name" "$1" || return 1
    checkAuthAndFail || return 1

    local clusterName="$1"
    local nodeGroups=$(listEksNodegroups $clusterName)

    echo "Updating node groups for cluster $clusterName..."

    echo $nodeGroups |\
    while read -r nodegroup; do
        echo -e "Starting update for node group $nodegroup..."
        updateEksNodegroup $clusterName $nodegroup
    done

    echo -e "\nWaiting for node group updates to complete..."

    echo $nodeGroups |\
    while read -r nodegroup; do
        echo "Waiting for $nodegroup..."
        waitForEksNodeGroupActive $clusterName $nodegroup
    done

    echo "Done!"
}

function updateEksNodegroup() {
    requireArg "a cluster name" "$1" || return 1
    requireArg "a node group name" "$2" || return 1
    checkAuthAndFail || return 1

    local response
    response=$(aws eks update-nodegroup-version --cluster-name $1 --nodegroup-name $2 2>/dev/null)
    [[ $? -eq 0 ]] || return 1

    local updateStatus=$(readJSON "$response" '.update.status')
    local newVersion=$(readJSON "$response" '.update.params[] | select(.type == "ReleaseVersion") | .value')

    echo "Status of node group '$2' update to version '$newVersion' is $updateStatus"
}

function waitForEksNodeGroupActive() {
    requireArg "a cluster name" "$1" || return 1
    requireArg "a node group name" "$2" || return 1
    checkAuthAndFail || return 1

    aws eks wait nodegroup-active --cluster-name $1 --nodegroup-name $2
}
