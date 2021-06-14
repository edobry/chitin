export CA_DT_AWS_ENV_INIT=false
export CA_DT_AWS_AUTH_INIT=false

function initAwsAuthEnv() {
    if [ "$CA_DT_AWS_AUTH_ENABLED" != true ]; then
        echo "DT aws-auth plugin disabled, set 'CA_DT_AWS_AUTH_ENABLED=true' to enable"
        return 1
    fi

    local embeddedAwsConfig=$CA_DT_DIR/shell/terraform/util/aws/config

    # if we're already initialized, we're done
    ([[ $CA_DT_AWS_ENV_INIT = "true" ]] && [[ -f $embeddedAwsConfig ]]) && return 0

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

    export CA_DT_AWS_ENV_INIT=true    
}

function initAutoAwsAuth() {
    # if we're already initialized, we're done
    [[ $CA_DT_AWS_ENV_INIT = "true" ]] && return 0

    local programmaticAuth=$(dtReadModuleConfig 'aws-auth' '.programmaticAuth')
    if [[ "$programmaticAuth" == 'true' ]]; then
        export CA_DT_AWS_AUTH_INIT=true
        awsInitProgrammaticAuth
        return 0
    fi

    initAwsAuthEnv

    local automaticAuth=$(dtReadModuleConfig 'aws-auth' '.automaticAuth')
    if [[ "$automaticAuth" == 'true' ]]; then
        export CA_DT_AWS_AUTH_INIT=true
        awsInitAutomaticAuth
        return 0
    fi
}

function awsInitProgrammaticAuth() {
    local programmaticRole=$(dtReadModuleConfig 'aws-auth' '.programmaticRole')

    # await authorization complete...
    local roleArn=$(awsIamGetRoleArn $programmaticRole 2>/dev/null)
    until [[ ! -z $roleArn ]]; do
        sleep 5
        roleArn=$(awsIamGetRoleArn $programmaticRole)
    done

    aws configure set region $AWS_DEFAULT_REGION
    awsAssumeProgrammaticRoleArn $programmaticRole $roleArn
}

function awsInitAutomaticAuth() {
    local profile=$(dtReadModuleConfig 'aws-auth' '.defaultProfile//empty')
    if [[ -z $profile ]]; then
        dtLog "automaticAuth enabled, but defaultProfile not set!"
        return 1
    fi
    # echo "authorizing $profile..."
    awsAuth $profile
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

# prints your account alias if authenticated, or fails
function awsAccountName() {
    awsAccount 2>/dev/null | sed 's/ca-aws-//'
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
    initAwsAuthEnv || return 1

    requireArg "a profile name" $1 || return 1

    local mfaCode="$2"
    local mfaArg=$(isSet "$mfaCode" && echo --mfa-code $mfaCode || echo '')
    export AWS_PROFILE=$1
    export AWS_SSO_ORG_ROLE_ARN=arn:aws:iam::${AWS_ORG_IDENTITY_ACCOUNT_ID}:role/${CA_DEPT_ROLE}

    if ! checkAuth; then
        echo "Authenticating..."
        AWS_PROFILE=$AWS_ORG_SSO_PROFILE gimme-aws-creds --roles $AWS_SSO_ORG_ROLE_ARN ${=mfaArg}
    fi

    local role=$(awsRole)
    echo "Assumed role: $role"
}
alias aws-auth=awsAuth

# run a command with a specific AWS profile
# args: profile name
function withProfile() {
    initAwsAuthEnv || return 1

    requireArg "a profile name" $1 || return 1
    local profile="$1"
    shift

    requireArg "a command to run" $1 || return 1

    local currentProfile=$(awsRole)

    awsAuth $profile >/dev/null
    $*
    awsAuth $currentProfile >/dev/null
}

function awsGetRegion() {
    aws configure get region
}

function showAWSEnvvars() {
    env | grep 'AWS_' | grep -v "CA_"
}
