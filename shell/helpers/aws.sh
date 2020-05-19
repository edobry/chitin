#!/usr/bin/env bash

if [ "$DE_AWS_AUTH_ENABLED" = true ]; then
    export AWS_PROFILE=$AWS_AUTH_PROFILE

    export AWS_HELPER_DIR=$PROJECT_DIR/terraform/util/aws
    source $AWS_HELPER_DIR/org-sso-helper.sh
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
    echo "[org-sso]\n" > ~/.aws/credentials
    awsId
}

# checks if you're authenticated, triggers authentication if not,
# and then assumes the provided role
function aws-auth() {
    if ! awsId > /dev/null; then
        echo "Reauthenticating..."
        AWS_PROFILE=$AWS_AUTH_PROFILE gimme-aws-creds
    fi

    export AWS_PROFILE=$1

    local role
    if [ ! -z $AWS_CURRENT_ROLE ]; then
        role=$AWS_CURRENT_ROLE
    else
        role=$(awsRole)
    fi
    echo "Assumed role: $role"
}

alias aws-dataeng-dev='aws-auth $DATAENG_DEV'
alias aws-dataeng-prod='aws-auth $DATAENG_PROD'
