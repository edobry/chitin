# shows all policy attachments for a given role
# args: role name
function awsListRolePolicies() {
    requireArg "a role name" $1 || return 1

    aws iam list-attached-role-policies --role-name $1 |\
        jq -cr '.AttachedPolicies[].PolicyArn'
}

# fetches a policy
# args: policy ARN
function awsGetPolicy() {
    requireArg "a policy ARN" $1 || return 1

    aws iam get-policy --policy-arn "$1"
}

# shows all policy attachments and their allowed actions for the current role
function showCurrentRolePermissions() {
    local role=$(awsRole)

    echo -e "Showing policy attachments for role '$role'...\n"

    awsListRolePolicies "$role" | \
    while read -r policyArn; do
        local policyVersion=$(awsGetPolicy "$policyArn" | jq -r '.Policy.DefaultVersionId')
        awsShowPolicy "$policyArn" "$policyVersion"
        echo
    done
}

# shows all policy attachments for a given policy version
# args: policy ARN, policy version
function awsGetPolicyAttachments() {
    requireArg "a policy ARN" $1 || return 1
    requireArg "a policy version" $2 || return 1

    local policyArn="$1"
    local policyVersion="$2"

    aws iam get-policy-version \
        --policy-arn $policyArn --version-id $policyVersion
}

# shows all policy attachments and their allowed actions for a given policy version
# args: policy ARN, policy version
function awsShowPolicy() {
    requireArg "a policy ARN" $1 || return 1
    requireArg "a policy version" $2 || return 1

    local policyArn="$1"
    local policyVersion="$2"
    local policyName=$(echo "$policyArn" | awk -F'/' '{ print $2 }')

    local policyAttachments=$(awsGetPolicyAttachments $policyArn $policyVersion |\
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
