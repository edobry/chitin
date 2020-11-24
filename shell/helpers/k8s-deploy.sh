notSet () [[ -z $1 ]]
isSet () [[ ! -z $1 ]]

function k8sPipeline() {
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

    requireArgOptions "a subcommand" "init deploy" "$1" || return 1
    requireArg "the environment name" "$2" || return 1
    local subCommand="$1"
    local DP_ENV="$2"
    local DP_ENV_DIR=env/$DP_ENV

    if [[ ! -d "$DP_ENV_DIR" ]]; then
        echo "No environment called '$DP_ENV' exists!"
        return 1
    fi

    local configFile=$DP_ENV_DIR/config.json

    local envConfig=$(cat $configFile | jq -c)

    local commonConfig=$(readJSON "$envConfig" '{ account, context, namespace, environment }')

    local DP_ACCOUNT=$(readJSON "$commonConfig" '.account')
    local DP_CLUSTER=$(readJSON "$commonConfig" '.context')
    local DP_NAMESPACE=$(readJSON "$commonConfig" '.namespace')
    local DP_TF_ENV=$(readJSON "$commonConfig" '.environment')

    local DP_TF_MODULE=coin-collection/$(readJSON "$envConfig" ".tfModule // \"$DP_ENV\"")

    checkAccountAuthAndFail "$DP_ACCOUNT" || return 1

    echo "Initializing DP environment '$DP_ENV'..."
    echo "AWS account: 'ca-aws-$DP_ACCOUNT'"
    echo "Terraform environment: '$DP_TF_ENV'"
    echo "Terraform module: '$DP_TF_MODULE'"
    echo "EKS cluster: '$DP_CLUSTER'"
    echo "EKS namespace: '$DP_NAMESPACE'"
    echo

    notSet $isDryrunMode && kubectx $DP_CLUSTER

    if [[ "$subCommand" = "init" ]]; then
        k8sPipelineDeploy "$envConfig"
    elif [[ "$subCommand" = "deploy" ]]; then
        k8sPipelineInit "$isDryrunMode"
    else
        echo "Something went wrong; Subcommand '$subCommand' is not supported!"
        return 1
    fi
}

function k8sPipelineDeploy() {
    k8sDeployCommon $*
    shift

    notDryrun && kubens $DP_NAMESPACE

    # to use, call with `teardown` as the second arg (after env)
    local isTeardown
    if [[ "$2" == "teardown" ]]; then
        isTeardown=true
        echo -e "\n-- TEARDOWN MODE --"
        shift
    fi
    notTeardown () [[ -z $TEARDOWN ]]
    teardown () [[ ! -z $TEARDOWN ]]

    # to use, call with `render` as the second arg (after env)
    unset RENDER
    if [[ "$2" == "render" ]]; then
        RENDER=true
        echo -e "\n-- RENDER MODE --"
        shift
    fi
    notRender () [[ -z $RENDER ]]
    render () [[ ! -z $RENDER ]]

    # to use, call with `chart` as the second arg (after env)
    unset CHART_MODE
    if [[ "$2" == "chart" ]]; then
        CHART_MODE=true
        shift
    fi

    shift
    unset DP_TARGET
    requireArg "deployments to limit to, or 'all' to not limit" "$1" || return 1
    if [[ "$1" = "all" ]]; then
        echo "Processing all deployments"
    else
        DP_TARGET="$*"

        additionalMsg=$([[ ! -z $CHART_MODE ]] && echo " instances of chart" || echo "")
        echo -e "\nLimiting to$additionalMsg: $(echo "$DP_TARGET" | sed 's/ /, /g')"
    fi

    notDryrun && notTeardown && helm repo update

    # generate environment-specific configuration and write to a temporary file
    # TODO: add per-chart child-chart config
    envFile=$DP_ENV_DIR/env.json
    envValues=$(readJSON "$envConfig" '{ region, nodeSelector: { "eks.amazonaws.com/nodegroup": (.nodegroup // empty) } } ')
    dryrun && notTeardown && echo $envValues | prettyYaml
    notDryrun && notTeardown && echo $envValues > $envFile

    function targetMatches() {
        # LIMITING
        local chart="$1"
        local name="$2"

        # if limiting to "all", always pass
        if [[ -z $DP_TARGET ]]; then return 0; fi

        debug && echo -e "\nTesting instance '$name' of chart '$chart'..."

        local chartMatches=false;
        ([ ! -z $CHART_MODE ] && argsContain $chart $DP_TARGET) && chartMatches=true
        local nameMatches=false;
        if [ -z $CHART_MODE ]; then
            ([ ! -z "$DP_TARGET" ] && argsContain $name $DP_TARGET) && nameMatches=true
        fi

        if [ "$chartMatches" != true ] && [ "$nameMatches" != true ]; then
            debug && echo "Does not match!"
            return 1
        else
            debug && echo "Matches!"
            return 0
        fi
        # END LIMITING
    }

    function installChart() {
        local deployment="$1"
        local allChartDefaults="$2"

        local name=$(readJSON "$deployment" '.key')
        local config=$(readJSON "$deployment" '.value')
        local chart=$(readJSON "$config" '.chart')

        local chartDefaults
        chartDefaults=$(readJSON "$allChartDefaults" ".\"$chart\" | del(.values)")
        local chartDefaultCode=$?

        local mergedConfig="$config"
        if [[ $chartDefaultCode -eq 0 ]]; then
            mergedConfig=$(mergeJSON "$config" "$chartDefaults")
        fi

        local source=$(readJSON "$mergedConfig" '.source // "remote"')
        local expectedVersion=$(readJSON "$mergedConfig" '.version // ""')

        if [[ "$source" == "local" ]]; then
            local path="$chart"
        elif [[ "$source" == "remote" ]]; then
            local path="fimbulvetr/$chart"
        else
            echo "Invalid source '$source', set 'local' or 'remote'"
            return 1
        fi

        (targetMatches "$chart" "$name") || return 0

        echo -e "\n$(render && echo 'Rendering' || echo 'Deploying') $name..."

        ## version
        local version
        if [[ -z $expectedVersion ]]; then
            local latestVersion
            latestVersion=$(getLatestChartVersion "$source" "$path")
            [[ $? -ne 0 ]] && { echo "Couldn't fetch latest version, skipping"; echo "$latestVersion"; return 1; }

            echo "No version configured, using '$chart:$latestVersion'; consider locking the deployment to this version"
            version=$latestVersion
        elif ! checkChartVersion "$source" "$path" "$expectedVersion"; then
            echo "Verson mismatch for $source chart '$path': expected $expectedVersion, not found"
            return 1
        else
            version=$expectedVersion
        fi

        local helmVersionArg=$([ -n $version ] && echo "--version=$version" || echo "")
        ##

        ## values
        local chartDefaultFilePath="$DP_ENV_DIR/chartDefaults/$chart.yaml"
        local chartDefaultFileArg=$([ -f $chartDefaultFilePath ] && echo "-f $chartDefaultFilePath" || echo "")

        local deploymentFilePath="$DP_ENV_DIR/deployments/$name.yaml"
        local deploymentFileArg=$([ -f "$deploymentFilePath" ] && echo "-f $deploymentFilePath" || echo "")

        local chartDefaultInlineValues=$(readJSON "$allChartDefaults" ".\"$chart\" | .values // {}")
        local chartDefaultInlineValuesFile=$(tempFile)
        writeJSONToYamlFile "$chartDefaultInlineValues" "$chartDefaultInlineValuesFile"

        local inlineValues=$(readJSON "$mergedConfig" '.values // {}')
        local inlineValuesFile=$(tempFile)
        writeJSONToYamlFile "$inlineValues" "$inlineValuesFile"
        ##

        if [ $source == "local" ] && [ -d $path ] && notDryrun; then
            if ! helm dep update $path; then
                echo "Skipping due to missing dependency!"
                return 1
            fi
        fi

        local helmSubCommand=$(render && echo "template" || echo "upgrade --install")

        # precedence order
        #
        # chart default
        #
        # per env chart default (file)
        # per env chart default (inlinr)
        # deployment (file)
        # deployment (inline)

        local helmCommand="helm $helmSubCommand $name $path $helmVersionArg $helmEnvValues $chartDefaultFileArg \
            -f $chartDefaultInlineValuesFile $deploymentFileArg -f $inlineValuesFile -f $envFile"

        dryrun && echo $helmCommand
        notDryrun && $helmCommand
    }

    function teardownChart() {
        local name=$(readJSON $1 .key)
        local source=$(readJSON $1 .value.source)
        local chart=$(readJSON $1 .value.chart)

        if ! targetMatches "$chart" "$name"; then return 0; fi

        echo -e "\nUninstalling '$name'..."

        helmCommand="helm uninstall $name"

        dryrun && echo $helmCommand
        notDryrun && $helmCommand
    }

    chartDefaults=$(readJSON "$envConfig" '.chartDefaults')

    readJSON "$envConfig" '.deployments | to_entries[] | select(.value.disabled | not)' | \
    while read -r args; do
        if notTeardown; then
            installChart "$args" "$chartDefaults"
        else
            teardownChart "$args" "$chartDefaults"
        fi
    done

    notDryrun && notTeardown && rm "$envFile"
}

function k8sPipelineInit() {
    k8sDeployCommon $*
    shift

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
}
