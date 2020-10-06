# lists all MSK clusters in the account, with names
function listKafkaClusters() {
    checkAuthAndFail || return 1

    listKafkaClustersJSON | jq -r '"\(.ClusterName) - \(.ClusterArn)"'
}

# lists names of all MSK clusters in the account
function listKafkaClusterNames() {
    checkAuthAndFail || return 1

    listKafkaClustersJSON | jq -r '.ClusterName'
}

# lists all MSK clusters in the account, with names
function listKafkaClustersJSON() {
    checkAuthAndFail || return 1

    aws kafka list-clusters | jq -r '.ClusterInfoList[]'
}

# finds the ARN of the MSK cluster with the given name
# args: MSK cluster name
function findKafkaClusterArnByName() {
    findKafkaClusterByNameJSON $1 | jq -r '.ClusterArn'
}

# finds the MSK cluster with the given name
# args: MSK cluster name
function findKafkaClusterByNameJSON() {
    checkAuthAndFail || return 1

    if [[ -z $1 ]]; then
        echo "Please supply a cluster name!"
        return 1;
    fi

    listKafkaClustersJSON | jq -r --arg CLUSTER_NAME "$1" 'select(.ClusterName==$CLUSTER_NAME)'
}

# gets the connection string of the MSK cluster with the given identifier
# args: MSK cluster name or ARN
function getKafkaConnection() {
    checkAuthAndFail || return 1

    if [[ -z $1 ]]; then
        echo "Please supply a cluster name!"
        return 1;
    fi

    local clusterArn=$([[ "$1" == "arn:aws:kafka"* ]] && echo "$1" || findKafkaClusterArnByName $1)

    if [[ -z "$clusterArn" ]]; then
        echo "No cluster with given name found!"
        return 1;
    fi

    aws kafka get-bootstrap-brokers --cluster-arn $clusterArn | jq -r '.BootstrapBrokerString'
}

# gets the Zookeeper connection string of the MSK cluster with the given identifier
# args: MSK cluster name or ARN
function getKafkaZkConnection() {
    checkAuthAndFail || return 1

    if [[ -z $1 ]]; then
        echo "Please supply a cluster name!"
        return 1;
    fi

    local cluster=$([[ "$1" == "arn:aws:kafka"* ]] && echo "$1" || findKafkaClusterByNameJSON $1)

    if [[ -z "$cluster" ]]; then
        echo "No cluster with given name found!"
        return 1;
    fi

    jq -r '.ZookeeperConnectString' <<< $cluster
}
