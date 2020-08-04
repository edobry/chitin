# watches an EBS volume currently being modified and reports progress
# args: volumeId
function watchVolumeModificationProgress() {
    if ! checkAuthAndFail; then return 1; fi

    if [[ -z $1 ]]; then
        echo "Please supply a volume name!"
        return 1;
    fi

    watch -n 30 "aws ec2 describe-volumes-modifications --volume-id $1 \
        | jq '.VolumesModifications[0].Progress' | xargs printf '%s%%\n'"
}

# watches an EBS volume snapshot currently being created and reports progress
# args: snapshot name or id
function watchSnapshotProgress() {
    if ! checkAuthAndFail; then return 1; fi

    if [[ -z $1 ]]; then
        echo "Please supply a snapshot identifier!"
        return 1;
    fi

    SNAPSHOT_ID=$([[ $1 == "snap-"* ]] && echo "$1" || findSnapshot $1)

    watch -n 30 "aws ec2 describe-snapshots --snapshot-ids $SNAPSHOT_ID \
        | jq -r '.Snapshots[].Progress'"
}

# checks whether an availability zone with the given name exists
# args: availability zone name
function checkAZ() {
    if ! checkAuthAndFail; then return 1; fi

    if ! aws ec2 describe-availability-zones --zone-names $1 > /dev/null 2>1; then
        echo "AZ not found!"
        return 1
    fi
}

# finds the id of an EBS snapshot with the given name
# args: EBS snapshot name
function findSnapshot() {
    if [[ -z $1 ]]; then
        echo "Please supply a snapshot name!"
        return 1;
    fi

    SNAPSHOT_ID=$(aws ec2 describe-snapshots --filters "Name=tag:Name,Values=$1" \
      | jq -r '.Snapshots[0].SnapshotId // empty')

    if [[ -z $SNAPSHOT_ID ]]; then return 1; fi

    echo $SNAPSHOT_ID
}

# creates an EBS volume with the given name, either empty or from a snapshot
# args: availability zone name, EBS volume name, (volume size in GB OR source snapshot identifier)
function createVolume() {
    if ! checkAuthAndFail; then return 1; fi

    AZ_NAME=$1
    VOLUME_NAME=$2

    if [[ -z $VOLUME_NAME ]]; then
        echo "Please supply a volume name!"
        return 1;
    fi

    VOLUME_SIZE=$3
    SNAPSHOT_NAME=$3

    local sourceOpt=""
    if ! [[ -z $3 ]]; then
        if checkNumeric $3; then
            sourceOpt="--size=$3"
        else
            SNAPSHOT_ID=$(findSnapshot $3)
            if [[ -z $SNAPSHOT_ID ]]; then
                echo "Snapshot not found!"
                return 1
            fi

            sourceOpt="--snapshot-id=$SNAPSHOT_ID"
        fi
    else
        echo "You must supply either a volume size or source snapshot identifier!"
        return 1
    fi

    if ! checkAZ $AZ_NAME; then return 1; fi

    aws ec2 create-volume \
        --availability-zone $AZ_NAME \
        $sourceOpt \
        --tag-specifications "ResourceType=volume,Tags=[{Key=Name,Value=$VOLUME_NAME}]" \
        --output=json | jq -r '.VolumeId'
}

# finds the ids of the EBS volumes with the given name
# args: EBS volume name
function findVolumesByName() {
    if [[ -z $1 ]]; then
        echo "Please supply a volume name!"
        return 1;
    fi

    aws ec2 describe-volumes --filters "Name=tag:Name,Values=$1" | jq -r '.Volumes[] | .VolumeId'
}

# resizes the EBS volume with the given name or id
# args: EBS volume identifier, new size in GB
function resizeVolume() {
    if ! checkAuthAndFail; then return 1; fi

    if [[ -z $1 ]]; then
        echo "Please supply a volume identifier!"
        return 1;
    fi

    VOLUME_SIZE=$2

    if ! checkNumeric $VOLUME_SIZE; then
        echo "Please supply a numeric volume size!"
        return 1
    fi

    VOLUME_IDS=$([[ $1 == "vol-"* ]] && echo "$1" || findVolumesByName $1)

    if [[ -z $VOLUME_IDS ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        echo "Resizing volume $id..."
        aws ec2 modify-volume --volume-id $id --size $VOLUME_SIZE
    done <<< "$VOLUME_IDS"

}

# snapshots the EBS volume with the given name or id
# args: EBS volume id, EBS snapshot name
function snapshotVolume() {
    if ! checkAuthAndFail; then return 1; fi

    if [[ -z "$1" ]]; then
        echo "Please supply a volume identifier!"
        return 1;
    fi

    SNAPSHOT_NAME="$2"

    if [[ -z "$SNAPSHOT_NAME" ]]; then
        echo "Please supply a snapshot name!"
        return 1;
    fi

    VOLUME_IDS=$([[ "$1" == "vol-"* ]] && echo "$1" || findVolumesByName $1)

    if [[ -z "$VOLUME_IDS" ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        echo "Snapshotting volume $id..."
        aws ec2 create-snapshot \
            --volume-id $id \
            --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=$SNAPSHOT_NAME}]"
    done <<< "$VOLUME_IDS"
}

# deletes the EBS volumes with the given name
# args: EBS volume name or id
function deleteVolume() {
    if ! checkAuthAndFail; then return 1; fi

    if [[ -z $1 ]]; then
        echo "Please supply a volume identifier!"
        return 1;
    fi

    VOLUME_IDS=$([[ $1 == "vol-"* ]] && echo "$1" || findVolumesByName $1)

    if [[ -z $VOLUME_IDS ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        echo "Deleting volume $id..."
        aws ec2 delete-volume --volume-id $id
    done <<< "$VOLUME_IDS"
}
