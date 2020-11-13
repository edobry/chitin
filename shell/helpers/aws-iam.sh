function listRolePolicies() {
    requireArg "a role name" $1 || return 1

    aws iam list-attached-role-policies --role-name $1 |\
        jq -cr '.AttachedPolicies[].PolicyArn'
}

function getPolicy() {
    requireArg "a policy ARN" $1 || return 1

    aws iam get-policy --policy-arn "$1"
}

function showCurrentRolePermissions() {
    local role=$(awsRole)

    echo -e "Showing policy attachments for role '$role'...\n"

    listRolePolicies "$role" | \
    while read -r policyArn; do
        local policyVersion=$(getPolicy "$policyArn" | jq -r '.Policy.DefaultVersionId')
        showPolicy "$policyArn" "$policyVersion"
        echo
    done
}

function getPolicyAttachments() {
    requireArg "a policy ARN" $1 || return 1
    requireArg "a policy version" $2 || return 1

    local policyArn="$1"
    local policyVersion="$2"

    aws iam get-policy-version \
        --policy-arn $policyArn --version-id $policyVersion
}

function showPolicy() {
    requireArg "a policy ARN" $1 || return 1
    requireArg "a policy version" $2 || return 1

    local policyArn="$1"
    local policyVersion="$2"
    local policyName=$(echo "$policyArn" | awk -F'/' '{ print $2 }')

    local policyAttachments=$(getPolicyAttachments $policyArn $policyVersion |\
        jq -cr '.PolicyVersion.Document.Statement[]')

    echo "$policyName $policyVersion"
    echo "==========================="

    echo "$policyAttachments" |\
    while read -r attachment; do
        local header=$(readJSON "$attachment" '"\(.Effect) \(.Resource)"')
        local actions=$([[ $(readJSON "$attachment" '.Action') != "*" ]] && readJSON "$attachment" '.Action[]' || echo "All actions")

        echo "$header"
        echo "---------------------------"
        echo "$actions"
        echo "==========================="
    done
}
