notSet () [[ -z $1 ]]
isSet () [[ ! -z $1 ]]

function deployCommon() {
    # to use, call with `debug` as the first arg
    local isDebugMode
    if [[ "$1" == "debug" ]]; then
        isDebugMode=true
        echo "-- DEBUG MODE --"
        shift
    fi

    # to use, call with `dryrun` as the first arg
    local isDryrunMode
    if [[ $1 == "dryrun" ]]; then
        isDryrunMode=true
        echo "-- DRYRUN MODE --"
        shift
    fi

    requireArg "the environment name" $1 || exit 1
    DP_ENV=$1
    DP_ENV_DIR=env/$1

    if [[ ! -d "$DP_ENV_DIR" ]]; then
        echo "No environment called '$DP_ENV' exists!"
        exit 1
    fi

    local configFile=$DP_ENV_DIR/config.json

    local envConfig=$(cat $configFile | jq -c)

    DP_ACCOUNT=$(readJSON "$envConfig" '.account')
    DP_CLUSTER=$(readJSON "$envConfig" '.context')
    DP_NAMESPACE=$(readJSON "$envConfig" '.namespace')
    DP_TF_ENV=$(readJSON "$envConfig" '.environment')
    DP_TF_MODULE=coin-collection/$(readJSON "$envConfig" ".tfModule // \"$DP_ENV\"")

    checkAccountAuthAndFail "$DP_ACCOUNT" || exit 1

    echo "Initializing DP environment '$DP_ENV'..."
    echo "AWS account: 'ca-aws-$DP_ACCOUNT'"
    echo "Terraform environment: '$DP_TF_ENV'"
    echo "Terraform module: '$DP_TF_MODULE'"
    echo "EKS cluster: '$DP_CLUSTER'"
    echo "EKS namespace: '$DP_NAMESPACE'"
    echo

    notSet $isDryrunMode && kubectx $DP_CLUSTER
}
