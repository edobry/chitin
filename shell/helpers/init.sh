#!/usr/bin/env bash

source ./common.sh

echo "Creating namespace..."
namespaceResource=$(kubectl create namespace $DP_NAMESPACE \
    --dry-run=true -o=json --save-config)
dryrun && echo $namespaceResource | jq '.'
notDryrun && echo $namespaceResource | kubectl apply -f -

#switch to the newly-created namespace
notDryrun && kubens $DP_NAMESPACE

shift
unset DP_TARGET
if [ ! -z "$*" ]; then
    DP_TARGET="$*"

    echo -e "\nLimiting to: $(echo "$DP_TARGET" | sed 's/ /, /g')"
fi

echo -e "\nFetching SSM parameters..."
# if the environment specifies an S3 bucket, use that, otherwise default
ssmOverride=$(cat $CONFIG_FILE | jq -r '.ssmOverride // empty')
baseSsmPath=$([[ ! -z $ssmOverride ]] && \
    echo "/$ssmOverride" || \
    echo "/dataeng-$DP_ENV")

dryrun && echo "Base SSM Path: '$baseSsmPath'"

ccSsmPath=$baseSsmPath/coin-collection
echo "Fetching from '$ccSsmPath'..."
rdsUsername=$(getSecureParam $ccSsmPath/RDS_INSTANCES_USERNAME)
rdsPassword=$(getSecureParam $ccSsmPath/RDS_INSTANCES_PASSWORD)

readonlySsmPath=$baseSsmPath/readonly
echo "Fetching from '$readonlySsmPath'..."
readonlyUsername=$(getSecureParam $readonlySsmPath/username)
readonlyPassword=$(getSecureParam $readonlySsmPath/password)

k8sSsmPath=$baseSsmPath/kubernetes/system
echo "Fetching from '$k8sSsmPath'..."
dockerUsername=$(getSecureParam $k8sSsmPath/DOCKER_USERNAME)
dockerPassword=$(getSecureParam $k8sSsmPath/DOCKER_PASSWORD)

echo -e "\nCreating image pull secret..."
regcredResource="$(kubectl create secret docker-registry regcred \
    --docker-server=$CHAINALYSIS_ARTIFACTORY \
    --docker-username=$dockerUsername \
    --docker-password=$dockerPassword \
    --docker-email=$dockerUsername@chainalysis.com \
    --dry-run=true -o=json --save-config)"
dryrun && echo $regcredResource | jq '.'
notDryrun && echo $regcredResource | kubectl apply -f -

DP_RESOURCES_DIR=$DP_ENV_DIR/resources
function createDatabaseServicesFromTerraform() {
    echo -e "\nParsing Terraform output from module '$DP_TF_ENV/$DP_TF_MODULE'..."

    local tfCommand="runTF $DP_TF_ENV $DP_TF_MODULE output -json rds_instance_endpoints"
    dryrun && echo $tfCommand

    # read the terraform state for this environment, grab the databases
    local rdsInstances=$($tfCommand \
        | jq -c 'to_entries[] | { name: "postgres-\(.key)", externalName: (.value | split(":") | first) }')

    for instance in $rdsInstances; do
        dryrun && echo $instance | jq '.'

        local name=$(echo $instance | jq -r '.name')

        # generate service file json, convert to yaml, then write
        echo $instance | jq '{ externalName }' \
            | yq r -P - > $DP_RESOURCES_DIR/$name.yaml
    done
}

function installService() {
    path=$1
    # grab just the filename, without the extension
    name=$(echo $1 | awk -F '/' '{ print $4 }' | sed 's/.yaml//')
    shift

    if [ ! -z "$DP_TARGET" ] && ! argsContain $name $DP_TARGET; then return 0; fi

    echo -e "\nInstalling service '$name'..."

    #only use SSM credentials for postgres services
    local helmCredsConf
    if [[ $name == "postgres"* ]]; then
        resourceOverride=$(cat $CONFIG_FILE | jq -r ".resourcesOverrides.\"$name\" // empty")

        if [[ -z $resourceOverride ]]; then
            helmCredsConf="--set credentials.username=$rdsUsername,credentials.password=$rdsPassword"
        elif [[ $resourceOverride == "readonly" ]]; then
            helmCredsConf="--set credentials.username=$readonlyUsername,credentials.password=$readonlyPassword"
        fi
    fi

    helmCommand="helm upgrade --install $name ../charts/external/external-service -f $path $* $helmCredsConf"
    dryrun && echo $helmCommand
    notDryrun && $helmCommand
}

# generate service files
# createDatabaseServicesFromTerraform

# install services
for service in $DP_RESOURCES_DIR/*; do
    # check if the file exists, just in case
    if [[ -f $service ]]; then
        installService $service;
    fi
done
