# lists all MSK clusters in the account, with names
function awsMskListClusters() {
    checkAuthAndFail || return 1

    awsMskListClustersJSON | jq -r '"\(.ClusterName) - \(.ClusterArn)"'
}

# lists names of all MSK clusters in the account
function awsMskListClusterNames() {
    checkAuthAndFail || return 1

    awsMskListClustersJSON | jq -r '.ClusterName'
}

# lists all MSK clusters in the account, with names
function awsMskListClustersJSON() {
    checkAuthAndFail || return 1

    aws kafka list-clusters | jq -r '.ClusterInfoList[]'
}

# finds the ARN of the MSK cluster with the given name
# args: MSK cluster name
function awsMskFindClusterArnByName() {
    awsMskFindClusterByNameJSON $1 | jq -r '.ClusterArn'
}

# finds the MSK cluster with the given name
# args: MSK cluster name
function awsMskFindClusterByNameJSON() {
    checkAuthAndFail || return 1

    requireArg "a cluster name" $1 || return 1

    awsMskListClustersJSON | jq -r --arg CLUSTER_NAME "$1" 'select(.ClusterName==$CLUSTER_NAME)'
}

# gets the connection string of the MSK cluster with the given identifier
# args: MSK cluster name or ARN
function awsMskGetConnection() {
    checkAuthAndFail || return 1

    requireArg "a cluster name" $1 || return 1

    local clusterArn=$([[ "$1" == "arn:aws:kafka"* ]] && echo "$1" || awsMskFindClusterArnByName $1)

    if [[ -z "$clusterArn" ]]; then
        echo "No cluster with given name found!"
        return 1;
    fi

    aws kafka get-bootstrap-brokers --cluster-arn $clusterArn | jq -r '.BootstrapBrokerString'
}

# gets the Zookeeper connection string of the MSK cluster with the given identifier
# args: MSK cluster name or ARN
function awsMskGetZkConnection() {
    checkAuthAndFail || return 1

    requireArg "a cluster name" $1 || return 1

    local cluster=$([[ "$1" == "arn:aws:kafka"* ]] && echo "$1" || awsMskFindClusterByNameJSON $1)

    if [[ -z "$cluster" ]]; then
        echo "No cluster with given name found!"
        return 1;
    fi

    jq -r '.ZookeeperConnectString' <<< $cluster
}
