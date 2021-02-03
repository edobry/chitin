export CA_DT_AWS_AUTH_INIT=false

function initAwsAuth() {
    if [ "$CA_DT_AWS_AUTH_ENABLED" != true ]; then
        echo "DT aws-auth plugin disabled, set 'CA_DT_AWS_AUTH_ENABLED=true' to enable"
        return 1
    fi

    local programmaticAuth=$(readDTModuleConfig 'aws-auth' '.programmaticAuth')
    if [[ "$programmaticAuth" == 'true' ]]; then
        awsInitProgrammaticAuth
        return 0
    fi

    local embeddedAwsConfig=$CA_DT_DIR/shell/terraform/util/aws/config

    # if we're already initialized, we're done
    ([[ $CA_DT_AWS_AUTH_INIT = "true" ]] && [[ -f $embeddedAwsConfig ]]) && return 0

    # set google username
    # export CA_GOOGLE_USERNAME=<name>@chainalysis.com
    if [[ -z "${CA_GOOGLE_USERNAME}" ]]; then
        echo "CA_GOOGLE_USERNAME must be set to your Chainalysis email address."
        return 1
    fi

    export AWS_SDK_LOAD_CONFIG=1
    export AWS_SSO_ORG_ROLE_ARN=arn:aws:iam::${AWS_ORG_IDENTITY_ACCOUNT_ID}:role/${CA_DEPT_ROLE}

    export TF_VAR_aws_sessionname=${CA_GOOGLE_USERNAME}

    # download generated AWS config
    sparseCheckout git@github.com:chainalysis/terraform.git $CA_DT_DIR/shell/terraform util/aws/config
    export AWS_CONFIG_FILE=$embeddedAwsConfig

    export CA_DT_AWS_AUTH_INIT=true
}

function awsInitProgrammaticAuth() {
    local programmaticRole=$(readDTModuleConfig 'aws-auth' '.programmaticRole')

    awsAssumeProgrammaticRole "$programmaticRole"
}

# prints your full identity if authenticated, or fails
function awsId() {
    local id
    if id=$(aws sts get-caller-identity) 2> /dev/null; then
        echo $id
    else
        return 1
    fi
}

# prints your account alias if authenticated, or fails
function awsAccount() {
    local id
    if id=$(aws iam list-account-aliases | jq -r '.AccountAliases[0]') 2> /dev/null; then
        echo $id
    else
        return 1
    fi
}
# prints your account id if authenticated, or fails
function awsAccountId() {
    local id
    if id=$(awsId | jq -r '.Account') 2> /dev/null; then
        echo $id
    else
        return 1
    fi
}

# prints your currently-assumed IAM role if authenticated, or fails
function awsRole() {
    local id
    if id=$(awsId); then
        export CA_AWS_CURRENT_ROLE=$(echo $id | jq '.Arn' | awk -F '/' '{ print $2 }')
        echo $CA_AWS_CURRENT_ROLE
    else
        return 1
    fi
}

# removes authentication, can be used for testing/resetting
function deAuth() {
    cp ~/.aws/credentials ~/.aws/credentials.bak
    echo "[$AWS_ORG_SSO_PROFILE]\n" > ~/.aws/credentials
    awsId
}

# checks if you're authenticated
function checkAuth() {
    if ! awsId > /dev/null; then
        echo "Unauthenticated!"
        return 1
    fi
}

# checks if you're authenticated, or fails. meant to be used as a failfast
function checkAuthAndFail() {
    if ! checkAuth; then
        echo "Please authenticate with AWS before rerunning."
        return 1
    fi
}

# checks if you're authenticated with a specific account, or fails. meant to be used as a failfast
function checkAccountAuthAndFail() {
    checkAuthAndFail || return 1

    requireArg "an account name" $1 || return 1
    local targetAccount="ca-aws-$1"

    if [[ $(awsAccount) != "$targetAccount" ]]; then
        echo "You are authenticated with the wrong account; please re-authenticate with '$targetAccount'."
        return 1
    fi
}

function awsOrg() {
    requireArgOptions "an organization name" "$1" "$CA_KNOWN_AWS_ORGS" || return 1

    export CA_DEPT_ROLE="$1"
    echo "Set AWS organization to: $1"
}

# checks if you're authenticated, triggers authentication if not,
# and then assumes the provided role
function awsAuth() {
    initAwsAuth || return 1

    requireArg "a profile name" $1 || return 1

    export AWS_PROFILE=$1
    export AWS_SSO_ORG_ROLE_ARN=arn:aws:iam::${AWS_ORG_IDENTITY_ACCOUNT_ID}:role/${CA_DEPT_ROLE}

    if ! checkAuth; then
        echo "Authenticating..."
        AWS_PROFILE=$AWS_ORG_SSO_PROFILE gimme-aws-creds --roles $AWS_SSO_ORG_ROLE_ARN
    fi

    local role=$(awsRole)
    echo "Assumed role: $role"
}

alias aws-auth=awsAuth

# run a command with a specific AWS profile
# args: profile name
function withProfile() {
    initAwsAuth || return 1

    requireArg "a profile name" $1 || return 1
    local profile="$1"
    shift

    requireArg "a command to run" $1 || return 1

    awsAuth $profile
    $*
}

function getAwsRegion() {
    aws configure get region
}

function awsListUsers() {
    aws iam list-users | jq -r '.Users[].UserName'
}

function awsListRoles() {
    aws iam list-roles | jq -r '.Roles[].RoleName'
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
    awsCloneRole quiet $roleName $newIamRole

    awsAuthorizeAssumeRole $newIamRole $newIamUsername

    readJSON "$createKeyOutput" '.AccessKey | { user: .UserName, role: $roleName, id: .AccessKeyId, key: .SecretAccessKey }'\
        --arg roleName $newIamRole
}

function awsDeleteProgrammaticCreds() {
    requireJsonArg "of programmatic credentials" "$1" || return 1

    local creds="$1"
    validateJSONFields "$creds" user role || return 1

    awsDeleteProgrammaticUser $(readJSON "$creds" '.user')
    awsDeleteRole yes $(readJSON "$creds" '.role')
}

# args: (optional) "quiet"
function awsDeleteProgrammaticUser() {
    requireArg "an IAM user name" "$1" || return 1

    unset quietMode
    if [[ "$1" == "quiet" ]]; then
        quietMode=true
        shift
    fi

    local username="$1"
    local accessKeyIds=$(awsGetAccessKeysForUser $username)

    while IFS= read -r keyId; do
        notSet $quietMode && echo "Deleting access key '$keyId'..."
        awsDeleteAccessKey $username "$keyId"
    done <<< "$accessKeyIds"

    notSet $quietMode && echo "Deleting user '$username'..."
    aws iam delete-user --user-name $username
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
    local createOutput=$(aws iam create-role --role-name $targetRoleName \
        --assume-role-policy-document file://$sourceAssumeRolePolicyDocumentFile)

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

    local roleName="$1"

    echo "Querying role policy attachments..."
    local policyArns=$(aws iam list-attached-role-policies --role-name $roleName | \
        jq -r '.AttachedPolicies[].PolicyArn')

    while IFS= read -r policyArn; do
        echo "Detaching policy '$policyArn'..."
        aws iam detach-role-policy --role-name $roleName --policy-arn "$policyArn"
    done <<< "$policyArns"

    echo "Deleting role '$roleName'..."
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

    local userArn=$(awsGetUserArn $userName)
    local assumeRoleDoc=$(awsGetAssumeRolePolicyDocument $roleName)

    local authzStatement=$(jq -nc --arg userArn $userArn '{
        Sid: "ProgrammaticAssumption",
        Effect: "Allow",
        Principal: {
            AWS: [$userArn]
        },
        Action: "sts:AssumeRole"
    }')

    local patchedAssumeRoleDoc=$(echo "$assumeRoleDoc" "$authzStatement" |\
        jq -sc '.[1] as $patch | .[0].Statement += [$patch] | .[0]')

    aws iam update-assume-role-policy --role-name $roleName \
        --policy-document $patchedAssumeRoleDoc
}
