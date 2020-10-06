# lists all RDS instances in the account, with names
function listDatabases() {
    aws rds describe-db-instances | jq -r '.DBInstances[] | .DBInstanceIdentifier'
}

# checks the existence of an RDS snapshot with the given name
# args: RDS snapshot name
function checkRdsSnapshotExistence() {
    requireArg "a snapshot name" $1 || return 1

    aws rds describe-db-snapshots --db-snapshot-identifier $1 > /dev/null 2>1

    return $?
}

# polls the status of the given RDS snapshot until it is available
# args: RDS snapshot name
function waitUntilRdsSnapshotReady() {
    if ! checkRdsSnapshotExistence $1; then
        echo "No snapshot with the given name found!"
        return 1
    fi

    until aws rds describe-db-snapshots --db-snapshot-identifier $1 \
      | jq -r '.DBSnapshots[0].Status' \
      | grep -qm 1 "available";
    do
        echo "Checking..."
        sleep 5;
    done

    echo "Snapshot $1 is available!"
}

# waits for the RDS snapshot with the given name to be available, and then deletes it
# args: RDS snapshot name
function deleteRdsSnapshot() {
    waitUntilRdsSnapshotReady $1

    aws rds delete-db-snapshot --db-snapshot-identifier $1 > /dev/null

    if [ $? -eq 0 ]; then
        echo "Snapshot deleted!"
        return 0
    else
        return 1
    fi
}


# checks the existence of an RDS instance with the given name
# args: RDS instance name
function checkRdsInstanceExistence() {
    requireArg "an instance name" $1 || return 1

    aws rds describe-db-instances --db-instance-identifier $1 > /dev/null 2>1

    return $?
}

# snapshots the given RDS instance
# args: RDS instance name, RDS snapshot name
function snapshotRds() {
    requireArg "an RDS instance name" $1 || return 1
    requireArg "a snapshot name" $2 || return 1

    local rdsName=$1
    local snapshotName=$2

    if ! checkRdsInstanceExistence $rdsName; then
        echo "No RDS instance with the given name exists!"
        return 1
    fi

    if checkRdsSnapshotExistence $snapshotName; then
        echo "Snapshot with given name already exists!"
        return 1
    fi

    aws rds create-db-snapshot \
        --db-instance-identifier $rdsName \
        --db-snapshot-identifier $snapshotName
}
