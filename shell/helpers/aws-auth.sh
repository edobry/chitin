#!/usr/bin/env bash

if [ "$DE_AWS_AUTH_ENABLED" = true ]; then
    # set google username if you like
    #export GOOGLE_USERNAME=@chainalysis.com
    if [[ -z "${GOOGLE_USERNAME}" ]]; then
        echo "GOOGLE_USERNAME must be set to your chainalysis email address."
        exit 1
    fi

    export DURATION=43200
    export AWS_SDK_LOAD_CONFIG=1
    export AWS_SSO_ORG_ROLE_ARN=arn:aws:iam::${AWS_ORG_IDENTITY_ACCOUNT_ID}:role/${DEPT_ROLE}
    export AWS_CONFIG_FILE=$PROJECT_DIR/terraform/util/aws/config

    export TF_VAR_aws_sessionname=${GOOGLE_USERNAME}
fi

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
        export AWS_CURRENT_ROLE=$(echo $id | jq '.Arn' | awk -F '/' '{ print $2 }')
        echo $AWS_CURRENT_ROLE
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
    if ! checkAuth; then
        echo "Please authenticate with AWS before rerunning."
        return 1
    fi

    local targetAccount="ca-aws-$1"

    if [[ $(awsAccount) != "$targetAccount" ]]; then
        echo "You are authenticated with the wrong account; please re-authenticate with '$targetAccount'."
        return 1
    fi
}

function awsOrg() {
    if [[ -z "$1" ]]; then
        echo "Please supply an organization name! It must be one of the following:"
        echo "$KNOWN_AWS_ORGS"
        return 1;
    fi

    export DEPT_ROLE="$1"
    echo "Set AWS organization to: $1"
}

# checks if you're authenticated, triggers authentication if not,
# and then assumes the provided role
function awsAuth() {
    if [ "$DE_AWS_AUTH_ENABLED" != true ]; then
        echo "DE AWS Auth disabled, set 'DE_AWS_AUTH_ENABLED=true' to enable"
        return 1
    fi

    if [[ -z $1 ]]; then
        echo "Please supply a profile name!"
        return 1;
    fi

    export AWS_PROFILE=$1
    export AWS_SSO_ORG_ROLE_ARN=arn:aws:iam::${AWS_ORG_IDENTITY_ACCOUNT_ID}:role/${DEPT_ROLE}

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
    local profile="$1"
    shift

    if [[ -z $profile ]]; then
        echo "Please supply a profile name!"
        return 1;
    fi

    if [[ -z $1 ]]; then
        echo "Please a command to run!"
        return 1;
    fi

    aws-auth $profile
    $*
}
