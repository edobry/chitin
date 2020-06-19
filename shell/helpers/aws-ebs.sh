# watches an EBS volume currently being modified and reports progress
# args: volumeId
function watchVolumeModificationProgress() {
    if [[ -z $1 ]]; then
        echo "Please supply a volume name!"
        return 1;
    fi

    watch -n 30 "aws ec2 describe-volumes-modifications --volume-id $1 \
        | jq '.VolumesModifications[0].Progress' | xargs printf '%s%%\n'"
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

# creates an EBS volume in the given AZ with the given name
# args: availability zone name, EBS volume name
function createVolume() {
    AZ_NAME=$1
    VOLUME_NAME=$2

    if [[ -z $VOLUME_NAME ]]; then
        echo "Please supply a volume name!"
        return 1;
    fi

    if ! checkAZ $AZ_NAME; then return 1; fi

    aws ec2 create-volume \
        --availability-zone $AZ_NAME \
        --tag-specifications "ResourceType=volume,Tags=[{Key=Name,Value=$VOLUME_NAME}]" \
        --output=json | jq -r '.VolumeId'
}

# creates an EBS volume in the given AZ with the given name from the snapshot with the given name
# args: availability zone name, EBS volume name, EBS snapshot name
function createVolumeFromSnapshot() {
    AZ_NAME=$1
    VOLUME_NAME=$2
    SNAPSHOT_NAME=$3

    if [[ -z $VOLUME_NAME ]]; then
        echo "Please supply a volume name!"
        return 1;
    fi

    if [[ -z $SNAPSHOT_NAME ]]; then
        echo "Please supply a snapshot name!"
        return 1;
    fi

    if ! checkAZ $AZ_NAME; then return 1; fi

    SNAPSHOT_ID=$(findSnapshot $SNAPSHOT_NAME)
    if [[ -z $SNAPSHOT_ID ]]; then
        echo "Snapshot not found!"
        return 1
    fi

    aws ec2 create-volume \
        --availability-zone $AZ_NAME \
        --snapshot-id $SNAPSHOT_ID \
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

# deletes the EBS volumes with the given name
# args: EBS volume name or id
function deleteVolume() {
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
