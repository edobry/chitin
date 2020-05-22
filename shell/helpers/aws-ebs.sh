# watches an EBS volume currently being modified and reports progress
# args: volumeId
function watchVolumeModificationProgress() {
    watch -n 30 "aws ec2 describe-volumes-modifications --volume-id $1 \
        | jq '.VolumesModifications[0].Progress' | xargs printf '%s%%\n'"
}
