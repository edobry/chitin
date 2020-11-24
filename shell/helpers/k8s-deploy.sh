notSet () [[ -z $1 ]]
isSet () [[ ! -z $1 ]]
isTrue () [[ "$1" = true ]]

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

    requireArgOptions "a subcommand" "$1" 'init deploy' || return 1
    requireArg "the environment name" "$2" || return 1
    local subCommand="$1"
    local envName="$2"
    local envDir=env/$envName

    if [[ ! -d "$envDir" ]]; then
        echo "No environment called '$envName' exists!"
        return 1
    fi

    local configFile=$envDir/config.json

    local envConfig=$(cat $configFile | jq -c)

    local commonConfig=$(readJSON "$envConfig" '{ account, context, namespace, environment }')
    local runtimeConfig=$(echo "$commonConfig" | jq -n \
        --arg debugMode "$isDebugMode" \
        --arg dryrunMode "$isDryrunMode" \
        --arg envName "$envName" \
        --arg envDir "$envDir" \
        '[inputs, {
        env: $envName,
        envDir: $envDir,
        flags: {
            isDebugMode: ($debugMode != ""),
            isDryrunMode: ($dryrunMode != "")
        } }] | add')

    readJSON "$runtimeConfig" '.'

    local account=$(readJSON "$runtimeConfig" '.account')
    local cluster=$(readJSON "$runtimeConfig" '.context')
    local namespace=$(readJSON "$runtimeConfig" '.namespace')
    local tfEnv=$(readJSON "$runtimeConfig" '.environment')

    local tfModule=coin-collection/$(readJSON "$envConfig" ".tfModule // \"$envName\"")

    checkAccountAuthAndFail "$account" || return 1

    echo "Initializing DP environment '$envName'..."
    echo "AWS account: 'ca-aws-$account'"
    echo "Terraform environment: '$tfEnv'"
    echo "Terraform module: '$tfModule'"
    echo "EKS cluster: '$cluster'"
    echo "EKS namespace: '$namespace'"
    echo

    notSet $isDryrunMode && kubectx $cluster

    if [[ "$subCommand" = "init" ]]; then
        k8sPipelineInit "$envConfig" "$runtimeConfig"
    elif [[ "$subCommand" = "deploy" ]]; then
        k8sPipelineDeploy "$envConfig" "$runtimeConfig"
    else
        echo "Something went wrong; Subcommand '$subCommand' is not supported!"
        return 1
    fi
}

function checkJSONFlag() {
    requireArg "a flag name" "$1" || return 1
    requireArg "a JSON string" "$2" || return 1

    echo "$2" | jq -r --arg flagName "$1" 'if .flags[$flagName] then "true" else "" end'
}


function targetMatches() {
    requireArg "a chart name" "$1" || return 1
    requireArg "a deployment name" "$2" || return 1

    local chartName="$1"
    local deploymentName="$2"
    local deployTarget="$3"

    # if limiting to "all", always pass
    notSet $deployTarget && return 0

    debug && echo -e "\nTesting instance '$deploymentName' of chart '$chartName'..."

    local chartMatches=false;
    (isSet $isChartMode && argsContain $chartName $deployTarget) && chartMatches=true

    local nameMatches=false;
    if notSet $isChartMode; then
        (isSet $deployTarget && argsContain $deploymentName $deployTarget) && nameMatches=true
    fi

    if ! isTrue "$chartMatches" && ! isTrue "$nameMatches"; then
        echo "Does not match!"
        return 1
    else
        echo "Matches!"
        return 0
    fi
}

function k8sPipelineDeploy() {
    local envConfig="$1"
    local runtimeConfig="$2"

    local env=$(readJSON "$runtimeConfig" '.env')
    local envDir=$(readJSON "$runtimeConfig" '.envDir')

    local account=$(readJSON "$runtimeConfig" '.account')
    local cluster=$(readJSON "$runtimeConfig" '.context')
    local namespace=$(readJSON "$runtimeConfig" '.namespace')
    local tfEnv=$(readJSON "$runtimeConfig" '.environment')

    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")
    local isDryrunMode=$(checkJSONFlag isDryrunMode "$runtimeConfig")

    notSet $isDryrunMode && kubens $namespace

    # to use, call with `teardown` as the second arg (after env)
    local isTeardownMode
    if [[ "$2" == "teardown" ]]; then
        isTeardownMode=true
        echo -e "\n-- TEARDOWN MODE --"
        shift
    fi

    # to use, call with `render` as the second arg (after env)
    local isRenderMode
    if [[ "$2" == "render" ]]; then
        isRenderMode=true
        echo -e "\n-- RENDER MODE --"
        shift
    fi

    # to use, call with `chart` as the second arg (after env)
    local isChartMode
    if [[ "$2" == "chart" ]]; then
        isChartMode=true
        shift
    fi

    shift
    unset DP_TARGET
    requireArg "deployments to limit to, or 'all' to not limit" "$1" || return 1
    if [[ "$1" = "all" ]]; then
        echo "Processing all deployments"
    else
        DP_TARGET="$*"

        additionalMsg=$(isSet $isChartMode && echo " instances of chart" || echo "")
        echo -e "\nLimiting to$additionalMsg: $(echo "$DP_TARGET" | sed 's/ /, /g')"
    fi

    notSet $isDryrunMode && notSet $isTeardownMode && helm repo update

    # generate environment-specific configuration and write to a temporary file
    # TODO: add per-chart child-chart config
    local envFile=$envDir/env.json
    local envValues=$(readJSON "$envConfig" '{ region, nodeSelector: { "eks.amazonaws.com/nodegroup": (.nodegroup // empty) } } ')

    isSet $isDryrunMode notSet $isTeardownMode && echo $envValues | prettyYaml
    notSet $isDryrunMode && notSet $isTeardownMode && echo $envValues > $envFile

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

        (targetMatches "$chart" "$name" "$DP_TARGET") || return 0

        echo -e "\n$(isSet $isRenderMode && echo 'Rendering' || echo 'Deploying') $name..."

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
        local chartDefaultFilePath="$envDir/chartDefaults/$chart.yaml"
        local chartDefaultFileArg=$([ -f $chartDefaultFilePath ] && echo "-f $chartDefaultFilePath" || echo "")

        local deploymentFilePath="$envDir/deployments/$name.yaml"
        local deploymentFileArg=$([ -f "$deploymentFilePath" ] && echo "-f $deploymentFilePath" || echo "")

        local chartDefaultInlineValues=$(readJSON "$allChartDefaults" ".\"$chart\" | .values // {}")
        local chartDefaultInlineValuesFile=$(tempFile)
        writeJSONToYamlFile "$chartDefaultInlineValues" "$chartDefaultInlineValuesFile"

        local inlineValues=$(readJSON "$mergedConfig" '.values // {}')
        local inlineValuesFile=$(tempFile)
        writeJSONToYamlFile "$inlineValues" "$inlineValuesFile"
        ##

        if [ $source == "local" ] && [ -d $path ] && notSet $isDryrunMode; then
            if ! helm dep update $path; then
                echo "Skipping due to missing dependency!"
                return 1
            fi
        fi

        local helmSubCommand=$(isSet $isRenderMode && echo "template" || echo "upgrade --install")

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

        isSet $isDryrunMode echo $helmCommand
        notSet $isDryrunMode && $helmCommand
    }

    function teardownChart() {
        local name=$(readJSON $1 .key)
        local source=$(readJSON $1 .value.source)
        local chart=$(readJSON $1 .value.chart)

        if ! targetMatches "$chart" "$name" "$DP_TARGET"; then return 0; fi

        echo -e "\nUninstalling '$name'..."

        helmCommand="helm uninstall $name"

        isSet $isDryrunMode echo $helmCommand
        notSet $isDryrunMode && $helmCommand
    }

    chartDefaults=$(readJSON "$envConfig" '.chartDefaults')

    readJSON "$envConfig" '.deployments | to_entries[] | select(.value.disabled | not)' | \
    while read -r args; do
        if notSet $isTeardownMode; then
            installChart "$args" "$chartDefaults"
        else
            teardownChart "$args" "$chartDefaults"
        fi
    done

    notSet $isDryrunMode && notSet $isTeardownMode && rm "$envFile"
}

function k8sPipelineInit() {
    k8sDeployCommon $*
    shift

    local env=$(readJSON "$runtimeConfig" '.env')
    local envDir=$(readJSON "$runtimeConfig" '.envDir')

    local account=$(readJSON "$runtimeConfig" '.account')
    local cluster=$(readJSON "$runtimeConfig" '.context')
    local namespace=$(readJSON "$runtimeConfig" '.namespace')
    local tfEnv=$(readJSON "$runtimeConfig" '.environment')

    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")
    local isDryrunMode=$(checkJSONFlag isDryrunMode "$runtimeConfig")

    notSet $isDryrunMode && kubens $namespace

    local tfModule=coin-collection/$(readJSON "$envConfig" ".tfModule // \"$envName\"")

    echo "Creating namespace..."
    namespaceResource=$(kubectl create namespace $namespace \
        --dry-run=true -o=json --save-config)
    isSet $isDryrunMode echo $namespaceResource | jq '.'
    notSet $isDryrunMode && echo $namespaceResource | kubectl apply -f -

    #switch to the newly-created namespace
    notSet $isDryrunMode && kubens $namespace

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
        echo "/dataeng-$envName")

    isSet $isDryrunMode echo "Base SSM Path: '$baseSsmPath'"

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
    isSet $isDryrunMode echo $regcredResource | jq '.'
    notSet $isDryrunMode && echo $regcredResource | kubectl apply -f -

    DP_RESOURCES_DIR=$envDir/resources
    function createDatabaseServicesFromTerraform() {
        echo -e "\nParsing Terraform output from module '$tfEnv/$tfModule'..."

        local tfCommand="runTF $tfEnv $tfModule output -json rds_instance_endpoints"
        isSet $isDryrunMode echo $tfCommand

        # read the terraform state for this environment, grab the databases
        local rdsInstances=$($tfCommand \
            | jq -c 'to_entries[] | { name: "postgres-\(.key)", externalName: (.value | split(":") | first) }')

        for instance in $rdsInstances; do
            isSet $isDryrunMode echo $instance | jq '.'

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
        isSet $isDryrunMode echo $helmCommand
        notSet $isDryrunMode && $helmCommand
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
