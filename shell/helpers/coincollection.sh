# pauses an ib-backend, recreates the specified dbs, and unpauses
# args: deployment name, db service name, db name...
# example: resetBackendDb eth-backend-ib-backend postgres-ethereum eth_transfer eth2_transfer...
function resetBackendDb() {
    if ! checkAuthAndFail; then return 1; fi

    local deploymentName="$1"
    local serviceName="$2"
    shift && shift

    echo "Pausing backend..."
    downDeploy $deploymentName

    echo -e "\nRecreating DBs..."

    echo $* | awk '{ \
        for(i=1; i<=NF; i++) { \
            print "drop database " $i ";" \
            "create database " $i ";" \
        } \
    }' | rds $serviceName postgres -e

    echo -e "\nResuming backend..."
    upDeploy $deploymentName
}

# creates a transfer database for each coin name passed in
# args: db service name, coins...
function createTransferDbs() {
    if ! checkAuthAndFail; then return 1; fi

    local serviceName="$1"
    shift

    echo "Creating transfer databases for $(echo "$@" | sed 's/ /, /g') in $serviceName..."

    echo $* | awk '{ \
        for(i=1; i<=NF; i++) { \
            print "create database " $i "_transfer;" \
        } \
    }' | rds $serviceName postgres -e
}


# pauses a p2p node, snapshots the EBS volume backing it, and unpauses
# args: deployment name, (optional) snapshot suffix
# example: snapshotNodeState eth-node-ethereum pre-upgrade
function snapshotNodeState() {
    if ! checkAuthAndFail; then return 1; fi

    local deploymentName="$1"
    local snapshotSuffix=${2:-$(randomString 5)}

    echo "Pausing node..."
    downDeploy "$deploymentName"

    echo -e "\nQuerying volume ID..."

    local claimName=$(kubectl get deployments.apps "$deploymentName" -o json | \
        jq -r --arg deploymentName "$deploymentName-data" \
            '.spec.template.spec.volumes[] | select(.name == $deploymentName) | .persistentVolumeClaim.claimName')

    local volumeName=$(kubectl get persistentvolumeclaims "$claimName" -o json | jq -r '.spec.volumeName')

    local volumeID=$(kubectl get persistentvolumes $volumeName -o json | jq -r '.spec.awsElasticBlockStore.volumeID')
    echo -e "Snapshotting EBS volume '$volumeID'..."

    local snapshotName="$deploymentName-snapshot-$snapshotSuffix"

    local snapshotID=$(snapshotVolume "$volumeID" "$snapshotName" | tail -n +2 | \
        jq -r '.SnapshotId')

    echo "Created snapshot: $snapshotName ($snapshotID)"

    echo -e "\nResuming node..."
    upDeploy "$deploymentName"
}

# finds the latest cluster version by querying S3
function getLatestClusterVersion() {
    if ! checkAuthAndFail; then return 1; fi

    aws s3 ls s3://chainalysis-dataeng-prod-chainflow-data-release/cluster-data/ | \
        awk '{ print $2 }' | grep 'v[0-9]\.[0-9]*\.[0-9]*[-a-z0-9]*/' | \
        sed 's/v//' | sed 's/\///' | sort -V | tail -n1
}

# upgrades an envrionment's cluster version to either the specified or latest
# args: environment name, (optional) version
function upgradeEnvironmentClusterVersion() {
    local env="$1"
    local version="$2"

    if [[ -z "$env" ]]; then
        echo "Please supply an environment name!"
        return 1;
    fi

    if [[ -z "$version" ]]; then
        echo "Fetching latest cluster version..."
        version=$(getLatestClusterVersion)
        echo "Found: $latestVersion"
    fi

    echo "Updating dev ib-backend config..."
    yq -Pi w "$PROJECT_DIR/dataeng-pipeline/env/$env/configs/ib-backend.yaml" \
        'ib-backend.cluster.version' "$version"
    echo "Done!"
}
