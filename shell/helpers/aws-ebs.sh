# watches an EBS volume currently being modified and reports progress
# args: volumeId
function watchVolumeModificationProgress() {
    checkAuthAndFail || return 1

    requireArg "a volume identifier" $1 || return 1

    local volumeIds=$([[ $1 == "vol-"* ]] && echo "$1" || findVolumesByName $1)

    watch -n 30 "aws ec2 describe-volumes-modifications --volume-id $volumeIds \
        | jq '.VolumesModifications[0].Progress' | xargs printf '%s%%\n'"
}

# watches an EBS volume snapshot currently being created and reports progress
# args: snapshot name or id
function watchSnapshotProgress() {
    checkAuthAndFail || return 1

    requireArg "a snapshot identifier" $1 || return 1

    local snapshotId=$([[ $1 == "snap-"* ]] && echo "$1" || findSnapshot $1)

    watch -n 30 "aws ec2 describe-snapshots --snapshot-ids $snapshotId \
        | jq -r '.Snapshots[].Progress'"
}

function listAZs() {
    checkAuthAndFail || return 1

    aws ec2 describe-availability-zones | jq -r '.AvailabilityZones[] | .ZoneName'
}

# checks whether an availability zone with the given name exists
# args: availability zone name
function checkAZ() {
    checkAuthAndFail || return 1

    if ! aws ec2 describe-availability-zones --zone-names $1 > /dev/null 2>1; then
        echo "AZ not found!"
        return 1
    fi
}

function requireAZ() {
    requireArgOptions "availability zone" "$1" $(listAZs)
}

# finds the ids of EBS snapshots with the given name, in descending-recency order
# args: EBS snapshot name
function findSnapshots() {
    requireArg "a snapshot name" $1 || return 1

    local snapshotIds=$(aws ec2 describe-snapshots --filters "Name=tag:Name,Values=$1")

    if [[ -z $snapshotIds ]]; then return 1; fi

    echo $snapshotIds | jq -r '.Snapshots | sort_by(.StartTime) | reverse[] | .SnapshotId'
}

# finds the id of the latest EBS snapshot with the given name
# args: EBS snapshot name
function findSnapshot() {
    findSnapshots "$1" | head -n 1
}

# deletes all EBS snapshots with the given name
# args: EBS snapshot identifier
function deleteSnapshots() {
    checkAuthAndFail || return 1

    requireArg "a snapshot identifier" $1 || return 1

    local snapshotIds=$([[ "$1" == "snap-"* ]] && echo "$1" || findSnapshots "$1")
    if [[ -z $snapshotIds ]]; then
        echo "Snapshot not found!"
        return 1
    fi

    while IFS= read -r id; do
        echo "Deleting snapshot '$id'..."
        aws ec2 delete-snapshot --snapshot-id $id
    done <<< "$snapshotIds"
}

# creates an EBS volume with the given name, either empty or from a snapshot
# args: availability zone name, EBS volume name, (volume size in GB OR source snapshot identifier)
function createVolume() {
    checkAuthAndFail || return 1

    requireArg "a volume name" $2 || return 1

    local azName="$1"
    local volumeName="$2"

    requireArg "a volume size or source snapshot identifier" $3 || return 1
    local sourceArg="$3"

    local sourceOpt
    if checkNumeric $sourceArg; then
        sourceOpt="--size=$sourceArg"
    else
        local snapshotId=$([[ "$sourceArg" == "snap-"* ]] && echo "$sourceArg" || findSnapshot "$sourceArg")
        if [[ -z $snapshotId ]]; then
            echo "Snapshot not found!"
            return 1
        fi

        sourceOpt="--snapshot-id=$snapshotId"
    fi

    # make the more expensive checks later
    requireAZ $azName || return 1

    aws ec2 create-volume \
        --availability-zone $azName \
        $sourceOpt \
        --tag-specifications "ResourceType=volume,Tags=[{Key=Name,Value=$volumeName}]" \
        --output=json | jq -r '.VolumeId'
}

# finds the ids of the EBS volumes with the given name
# args: EBS volume name
function findVolumesByName() {
    requireArg "a volume name" $1 || return 1

    aws ec2 describe-volumes --filters "Name=tag:Name,Values=$1" | jq -r '.Volumes[] | .VolumeId'
}

# lists all EBS snapshots in the account, with names
function listSnapshots() {
    aws ec2 describe-snapshots --owner-ids $(awsAccountId) | jq -r '.Snapshots | sort_by(.StartTime) | reverse[] |
        { id: .SnapshotId, tags: ( (.Tags // []) | .[] | [select(.Key=="Name")] // []) } |
        "\(.id) - \((.tags[] | select(.Key == "Name") | .Value) // "")"'
}

# lists all in-progress EBS snapshots in the account, with names
function listInProgressSnapshots() {
    aws ec2 describe-snapshots --owner-ids $(awsAccountId) | jq -r '.Snapshots[] |
        select(.Progress!="100%") | "\(.SnapshotId) - \(.Progress)"'
}

# lists all EBS volumes in the account, with names
function listVolumes() {
    aws ec2 describe-volumes | jq -r '.Volumes[] |
        { id: .VolumeId, tags: ( (.Tags // []) | .[] | [select(.Key=="Name")] // []) } |
        "\(.id) - \((.tags[] | select(.Key == "Name") | .Value) // "")"'
}

# sets the IOPS for the EBS volume with the given name or id
# args: EBS volume identifier, new IOPS
function modifyVolumeIOPS() {
    checkAuthAndFail || return 1

    requireArg "a volume identifier" $1 || return 1

    requireNumericArg "IOPS value" $2 || return 1
    local volumeIOPS=$2

    local volumeIds=$([[ "$1" == "vol-"* ]] && echo "$1" || findVolumesByName "$1")

    if [[ -z $volumeIds ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        echo "Modifying volume $id..."
        aws ec2 modify-volume --volume-id $id --volume-type io2 --iops $volumeIOPS
    done <<< "$volumeIds"
}

# resizes the EBS volume with the given name or id
# args: EBS volume identifier, new size in GB
function resizeVolume() {
    checkAuthAndFail || return 1

    requireArg "a volume identifier" $1 || return 1

    requireNumericArg "volume size" $2 || return 1
    local volumeSize=$2

    local volumeIds=$([[ $1 == "vol-"* ]] && echo "$1" || findVolumesByName $1)

    if [[ -z $volumeIds ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        echo "Resizing volume $id..."
        aws ec2 modify-volume --volume-id $id --size $volumeSize
    done <<< "$volumeIds"

}

# snapshots the EBS volume with the given name or id
# args: EBS volume id, EBS snapshot name
function snapshotVolume() {
    checkAuthAndFail || return 1

    requireArg "a volume identifier" $1 || return 1

    requireArg "a snapshot name" $2 || return 1
    local snapshotName="$2"

    local volumeIds=$([[ "$1" == "vol-"* ]] && echo "$1" || findVolumesByName $1)

    if [[ -z "$volumeIds" ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        aws ec2 create-snapshot \
            --volume-id $id \
            --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=$snapshotName}]" | \
        jq -r '.SnapshotId'
    done <<< "$volumeIds"
}

# polls the status of the given EBS snapshot until it is available
# args: (optional) "quiet", EBS snapshot identifier
function waitUntilSnapshotReady() {
    checkAuthAndFail || return 1

    unset quietMode
    if [[ "$1" == "quiet" ]]; then
        quietMode=true
        shift
    fi

    local snapshotId=$([[ "$1" == "snap-"* ]] && echo "$1" || findSnapshot "$1")
    if [[ -z $snapshotId ]]; then
        [[ -z $quietMode ]] && echo "Snapshot not found!"
        return 1
    fi

    until aws ec2 describe-snapshots --snapshot-id "$snapshotId" \
      | jq -r '.Snapshots[0].State' \
      | grep -qm 1 "completed";
    do
        [[ -z $quietMode ]] && echo "Checking..."
        sleep 5;
    done

    [[ -z $quietMode ]] && echo "Snapshot $1 is available!"
}

# deletes the EBS volumes with the given name
# args: EBS volume name or id
function deleteVolume() {
    checkAuthAndFail || return 1

    requireArg "a volume identifier" $1 || return 1

    local volumeIds=$([[ "$1" == "vol-"* ]] && echo "$1" || findVolumesByName "$1")

    if [[ -z $volumeIds ]]; then
        echo "No volume with given name found!"
        return 1;
    fi

    while IFS= read -r id; do
        echo "Deleting volume '$id'..."
        aws ec2 delete-volume --volume-id $id
    done <<< "$volumeIds"
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
