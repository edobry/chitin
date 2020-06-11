# pauses an ib-backend, recreates the db, and unpauses
# args: deployment name, db service name, db name
# example: resetBackendDb eth-backend-ib-backend postgres-ethereum eth_transfer
function resetBackendDb() {
    local deploymentName="$1"
    local serviceName="$2"
    local dbName="$3"

    echo "Pausing backend..."
    downDeploy $deploymentName

    echo -e "\nRecreating DB..."
    echo "drop database $dbName;" "create database $dbName;"  | rds $serviceName postgres -e

    echo -e "\nResuming backend..."
    upDeploy $deploymentName
}

# creates a transfer database for each coin name passed in
# args: db service name, coins...
function createTransferDbs() {
    local serviceName="$1"
    shift

    echo "Creating transfer databases for $(echo "$@" | sed 's/ /, /g') in $serviceName..."

    echo $* | awk '{ \
        for(i=1; i<=NF; i++){ \
            print "create database "$i "_transfer;" \
        } \
    }' | rds $serviceName postgres -e
}
