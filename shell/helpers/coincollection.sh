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
        echo "Found: $version"
    fi

    echo "Updating dev ib-backend config..."
    yq -Pi w "$PROJECT_DIR/dataeng-pipeline/env/$env/configs/ib-backend.yaml" \
        'ib-backend.cluster.version' "$version"
    echo "Done!"
}
