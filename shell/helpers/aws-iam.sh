function awsListUsers() {
    aws iam list-users | jq -r '.Users[].UserName'
}

function awsListRoles() {
    aws iam list-roles | jq -r '.Roles[].RoleName'
}

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

function awsCreateProgrammaticCreds() {
    requireArg "an IAM role name" "$1" || return 1
    checkAuthAndFail || return 1

    local roleName="$1"

    local googleUsername=$(readDTConfig '.modules["aws-auth"].googleUsername' -r)
    local newIamSuffix="programmatic-tmp-$(randomString 5)"
    local newIamUsername="$googleUsername-$newIamSuffix"

    local createUserOutput
    createUserOutput=$(aws iam create-user --user-name $newIamUsername)
    [[ $? -eq 0 ]] || return 1

    local createKeyOutput
    createKeyOutput=$(aws iam create-access-key --user-name $newIamUsername)
    if [[ $? -ne 0 ]]; then
        awsDeleteProgrammaticUser quiet $newIamUsername
        return 1
    fi

    local newIamRole="$roleName-$newIamSuffix"
    local createRoleOutput
    createRoleOutput=$(awsCloneRole quiet $roleName $newIamRole)
    if [[ $? -ne 0 ]]; then
        awsDeleteProgrammaticUser quiet $newIamUsername
        return 1
    fi

    awsAuthorizeAssumeRole $newIamRole $newIamUsername

    readJSON "$createKeyOutput" '.AccessKey | { user: .UserName, role: $roleName, id: .AccessKeyId, key: .SecretAccessKey }'\
        --arg roleName $newIamRole
}

function awsDeleteProgrammaticCreds() {
    requireJsonArg "of programmatic credentials" "$1" || return 1

    local creds="$1"
    validateJSONFields "$creds" user role || return 1

    awsDeleteProgrammaticUser quiet $(readJSON "$creds" '.user')
    awsDeleteRole yes quiet $(readJSON "$creds" '.role')
}

# args: (optional) "quiet"
function awsDeleteProgrammaticUser() {
    requireArg "an IAM user name" "$1" || return 1

    unset quietMode
    if [[ "$1" == "quiet" ]]; then
        quietMode=true
        shift
    fi

    local userName="$1"
    local accessKeyIds=$(awsGetAccessKeysForUser $userName)

    if [[ ! -z "$accessKeyIds" ]]; then
        while IFS= read -r keyId; do
            notSet $quietMode && echo "Deleting access key '$keyId'..."
            awsDeleteAccessKey $userName "$keyId"
        done <<< "$accessKeyIds"
    fi

    notSet $quietMode && echo "Querying user policies..."
    local policyNames=$(aws iam list-user-policies --user-name $userName | \
        jq -r '.PolicyNames[]')

    while IFS= read -r policyName; do
        notSet $quietMode && echo "Deleting user policy '$policyName'..."
        aws iam delete-user-policy --user-name $userName --policy-name "$policyName"
    done <<< "$policyNames"

    notSet $quietMode && echo "Deleting user '$userName'..."
    aws iam delete-user --user-name $userName
}

function awsDeleteAccessKey() {
    requireArg "an IAM user name" "$1" || return 1
    requireArg "an IAM access key id" "$2" || return 1

    aws iam delete-access-key --user-name "$1" --access-key-id "$2"
}

function awsGetAccessKeysForUser() {
    requireArg "an IAM user name" "$1" || return 1

    aws iam list-access-keys --user-name "$1" | jq -r '.AccessKeyMetadata[].AccessKeyId'
}

function awsCloneRole() {
    requireArg "a source IAM role name" "$1" || return 1
    requireArg "a target IAM role name" "$2" || return 1

    unset quietMode
    if [[ "$1" == "quiet" ]]; then
        quietMode=true
        shift
    fi

    local sourceRoleName="$1"
    local targetRoleName="$2"

    notSet $quietMode && echo "Querying source role policy attachments..."
    local sourcePolicyArns=$(aws iam list-attached-role-policies --role-name $sourceRoleName | \
        jq -r '.AttachedPolicies[].PolicyArn')

    notSet $quietMode && echo "Querying source role assume-role policy document..."
    local sourceAssumeRolePolicyDocumentFile=$(tempFile)
    awsGetAssumeRolePolicyDocument $sourceRoleName > $sourceAssumeRolePolicyDocumentFile

    notSet $quietMode && echo "Creating new role '$targetRoleName'..."
    local createOutput
    createOutput=$(aws iam create-role --role-name $targetRoleName \
        --assume-role-policy-document file://$sourceAssumeRolePolicyDocumentFile)
    [[ $? -eq 0 ]] || return 1

    while IFS= read -r policyArn; do
        notSet $quietMode && echo "Attaching policy '$policyArn'..."
        aws iam attach-role-policy --role-name $targetRoleName --policy-arn "$policyArn"
    done <<< "$sourcePolicyArns"
}

function awsGetAssumeRolePolicyDocument() {
    requireArg "an IAM role name" "$1" || return 1

    aws iam get-role --role-name "$1" | jq '.Role.AssumeRolePolicyDocument'
}

function awsDeleteRole() {
    requireArg "an IAM role name" "$1" || return 1

    if [[ "$1" != 'yes' ]]; then
        echo "This command is potentially destructive; please ensure you're passing the right arguments, and then re-run with 'yes' as the first argument"
        return 0
    else
        shift
    fi

    unset quietMode
    if [[ "$1" == "quiet" ]]; then
        quietMode=true
        shift
    fi

    local roleName="$1"

    notSet $quietMode && echo "Querying role policy attachments..."
    local policyArns=$(awsListRolePolicies $roleName)

    while IFS= read -r policyArn; do
        notSet $quietMode && echo "Detaching policy '$policyArn'..."
        aws iam detach-role-policy --role-name $roleName --policy-arn "$policyArn"
    done <<< "$policyArns"

    notSet $quietMode && echo "Deleting role '$roleName'..."
    aws iam delete-role --role-name $roleName
}

function awsGetUserArn() {
    requireArg "an IAM user name" "$1" || return 1

    aws iam get-user --user-name "$1" | jq -r '.User.Arn'
}

function awsAuthorizeAssumeRole() {
    requireArg "an IAM role name" "$1" || return 1
    requireArg "an IAM user name" "$2" || return 1

    local roleName="$1"
    local userName="$2"

    local roleArn=$(awsGetRoleArn $roleName)
    local userArn=$(awsGetUserArn $userName)
    local assumeRoleDoc=$(awsGetAssumeRolePolicyDocument $roleName)

    local userGetRolePolicy=$(jq -nc \
        --arg roleArn $roleArn \
    '{
        Version: "2012-10-17",
        Statement: [{
            Sid: "AllowGetRole",
            Effect: "Allow",
            Action: [
                "iam:GetRole"
            ],
            Resource: $roleArn
        }]
    }')

    aws iam put-user-policy --user-name $userName \
        --policy-document "$userGetRolePolicy" --policy-name AllowGetRolePolicy

    local authzStatement=$(jq -nc --arg userArn $userArn '{
        Sid: "ProgrammaticAssumption",
        Effect: "Allow",
        Principal: {
            AWS: $userArn
        },
        Action: "sts:AssumeRole"
    }')

    local patchedAssumeRoleDoc=$(echo "$assumeRoleDoc" "$authzStatement" |\
        jq -sc '.[1] as $patch | .[0].Statement += [$patch] | .[0]')

    aws iam update-assume-role-policy --role-name $roleName \
        --policy-document $patchedAssumeRoleDoc
}

function awsGetRoleArn() {
    requireArg "an IAM role name" "$1" || return 1

    local result
    result=$(aws iam get-role --role-name "$1" | jq -r '.Role.Arn')
    [[ $? -eq 0 ]] || return 1

    echo "$result"
}

function awsAssumeRole() {
    requireArg "an IAM role name" "$1" || return 1

    local roleName="$1"

    local roleArn
    roleArn=$(awsGetRoleArn "$roleName")
    if [[ $? -ne 0 ]]; then
        echo "$roleArn"
        echo "Could not assume programmatic role '$roleName'!"
        return 1
    fi

    awsAssumeRoleArn $roleName $roleArn
}

function awsAssumeRoleArn() {
    requireArg "an IAM role name" "$1" || return 1
    requireArg "an IAM role ARN" "$2" || return 1

    local roleName="$1"
    local roleArn="$2"

    aws sts assume-role --role-arn $roleArn \
        --role-session-name "$roleName-session-$(randomString 3)"
}
