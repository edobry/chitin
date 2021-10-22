# gets the tags for the ASG with the given name
# args: ASG name
function awsAsgGetTags() {
    requireArg "an ASG name" "$1" || return 1

    aws autoscaling describe-auto-scaling-groups | jq -r --arg asgName "$1" \
        '.AutoScalingGroups[] | select(.AutoScalingGroupName == $asgName) | .Tags[] | "\(.Key): \(.Value)"'
}
