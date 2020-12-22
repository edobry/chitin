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

    # to use, call with `testing` as the first arg
    local isTestingMode
    if [[ $1 == "testing" ]]; then
        isTestingMode=true
        echo "-- TESTING MODE --"
        shift
    fi

    requireArgOptions "a subcommand" "$1" 'render deploy teardown' || return 1
    requireArg "the environment name" "$2" || return 1
    local subCommand="$1"
    local envName="$2"
    local envDir=env/$envName
    shift && shift

    if [[ ! -d "$envDir" ]]; then
        echo "No environment called '$envName' exists!"
        return 1
    fi

    local isTeardownMode
    local isRenderMode
    local isDeployMode
    if [[ "$subCommand" == "teardown" ]]; then
        isTeardownMode=true
        echo -e "\n-- TEARDOWN MODE --"
    elif [[ "$subCommand" == "render" ]]; then
        isRenderMode=true
        echo -e "\n-- RENDER MODE --"
    elif [[ "$subCommand" == "deploy" ]]; then
        isDeployMode=true
        echo -e "\n-- DEPLOY MODE --"
    fi

    # to use, call with `chart` as the second arg (after env)
    local isChartMode
    if [[ "$1" == "chart" ]]; then
        isChartMode=true
        shift
    fi

    local configFile=$envDir/config.json

    local envConfig=$(readJSONFile $configFile)
    isSet "$isDebugMode" && echo "envConfig:" && readJSON "$envConfig" '.'

    local apiVersion=$(readJSON "$envConfig" '.apiVersion // empty')
    if isSet $apiVersion; then
        checkDTVersion "$apiVersion" || return 1
    fi

    local account=$(readJSON "$envConfig" '.environment.awsAccount')
    checkAccountAuthAndFail "$account" || return 1
    local region=$(getAwsRegion)

    ## load env config
    local context=$(readJSON "$envConfig" '.environment.k8sContext')
    local namespace=$(readJSON "$envConfig" '.environment.k8sNamespace')

    local tfEnv=$(readJSON "$envConfig" '.environment.tfEnv')
    local tfModule=coin-collection/$(readJSON "$envConfig" ".environment.tfModule // \"$envName\"")

    echo "Initializing DP environment '$envName'..."
    isSet "$tfEnv" && echo "Terraform environment: '$tfEnv'"
    isSet "$tfModule" && echo "Terraform module: '$tfModule'"
    echo "AWS account: 'ca-aws-$account'"
    echo "EKS context: '$context'"
    echo "EKS namespace: '$namespace'"
    echo
    ##

    ## env init
    notSet $isDryrunMode && kubectx $context

    if ! k8sNamespaceExists $namespace; then
        k8sPipelineInitEnv $namespace $dockerUsername $dockerPassword
    fi

    notSet $isDryrunMode && kubens $namespace
    ##

    ## parse target
    local target
    requireArg "deployments to limit to, or 'all' to not limit" "$1" || return 1
    if [[ "$1" = "all" ]]; then
        echo -e "\nProcessing all deployments"
    else
        target="$*"

        additionalMsg=$(isSet $isChartMode && echo " instances of chart" || echo "")
        echo -e "\nLimiting to$additionalMsg: $(echo "$target" | sed 's/ /, /g')"
    fi
    ##

    local envFile=$(tempFile)
    local runtimeConfig=$(echo "$envConfig" | jq -nc \
        --arg envName "$envName" \
        --arg envDir "$envDir" \
        --arg envFile "$envFile" \
        --arg target "$target" \
        --arg isDebugMode "$isDebugMode" \
        --arg isDryrunMode "$isDryrunMode" \
        --arg isTestingMode "$isTestingMode" \
        --arg isTeardownMode "$isTeardownMode" \
        --arg isDeployMode "$isDeployMode" \
        --arg isRenderMode "$isRenderMode" \
        --arg isChartMode "$isChartMode" \
        'inputs * {
        env: $envName,
        envDir: $envDir,
        envFile: $envFile,
        target: $target,
        flags: {
            isDebugMode: ($isDebugMode != ""),
            isDryrunMode: ($isDryrunMode != ""),
            isTestingMode: ($isTestingMode != ""),
            isTeardownMode: ($isTeardownMode != ""),
            isDeployMode: ($isDeployMode != ""),
            isRenderMode: ($isRenderMode != ""),
            isChartMode: ($isChartMode != "")
        } }')

    isSet "$isDebugMode" && readJSON "$runtimeConfig" '.'

    # if the environment specifies a base SSM path, use that, otherwise default
    local baseSsmPath=$(readJSON "$runtimeConfig" '"/\(.environment.ssmOverride // "dataeng-\($envName)")"' --arg envName dev)
    # isSet $isDryrunMode && echo "Base SSM Path: '$baseSsmPath'"

    # generate environment-specific configuration and write to a temporary file
    # TODO: add per-chart child-chart config
    local envValues=$(readJSON "$runtimeConfig" '{
        region: $region, nodeSelector: {
            "eks.amazonaws.com/nodegroup": (.environment.nodegroup // empty) } }' --arg region $region)

    notSet "$isTestingMode" && notSet "$isDryrunMode" && notSet "$isTeardownMode" && helm repo update

    isSet "$isDryrunMode" && notSet "$isTeardownMode" && echo "$envValues" | prettyYaml
    notSet "$isDryrunMode" && notSet "$isTeardownMode" && echo "$envValues" > $envFile

    local chartDefaults=$(readJSON "$runtimeConfig" '.chartDefaults')

    local modeCommand=$(notSet $isTeardownMode && echo installChart || echo teardownChart)

    local externalResourceDeployments=$(readJSON "$runtimeConfig" '.externalResources.deployments | to_entries |
        map({ key: .key, value: { chart: "external-service", values: .value } })[]')

    local deployments=$(readJSON "$runtimeConfig" '.deployments | to_entries[] | select(.value.disabled | not)')

    local mergedDeployments=$(echo -e "$externalResourceDeployments\n$deployments")
    if [[ -z $mergedDeployments ]]; then
        echo "No deployments configured, nothing to do. Exiting!"
        return 0
    fi
    while read -r deploymentOptions; do
         $modeCommand "$runtimeConfig" "$deploymentOptions" "$chartDefaults"
    done <<< $mergedDeployments

    notSet $isDryrunMode && notSet $isTeardownMode && rm "$envFile"

    return 0
}

function checkJSONFlag() {
    requireArg "a flag name" "$1" || return 1
    requireArg "a JSON string" "$2" || return 1

    echo "$2" | jq -r --arg flagName "$1" 'if .flags[$flagName] then "true" else "" end'
}

function createK8sPipelineEnv() {
    requireArg "an environment name" "$1" || return 1
    requireArg "an AWS account name" "$2" || return 1
    requireArg "a K8s context name" "$3" || return 1
    requireArg "a K8s namespace name" "$4" || return 1

    local envName="$1"
    local awsAccount="$2"
    local k8sContext="$3"
    local k8sNamespace="$4"

    local apiVersion=$(getReleasedDTVersion)
    local config=$(jq -n \
        --arg apiVersion $apiVersion \
        --arg envName $envName \
        --arg awsAccount $awsAccount \
        --arg k8sContext $k8sContext \
        --arg k8sNamespace $k8sNamespace \
    '{
        apiVersion: $apiVersion,
        environment: {
            awsAccount: $awsAccount,
            k8sContext: $k8sContext,
            k8sNamespace: $k8sNamespace
        },
        chartDefaults: {},
        deployments: {},
        externalResources: { deployments: {} }
    }')

    if [[ ! -d "env" ]]; then
        echo "Are you in the right directory? No 'env' dir found!"
        return 1
    fi

    local envDir="env/$envName"
    local configPath="$envDir/config.json"

    if [[ -f $configPath ]]; then
        echo "Environment '$envName' already initialized."
        return 0
    fi

    echo "Creating new environment directory for '$envName'..."
    mkdir -p $envDir/deployments $envDir/chartDefaults $envDir/externalResources
    echo $config > $configPath
    echo "Environment initialized! You can configure it at '$configPath'."
}

function installChart() {
    local runtimeConfig="$1"
    local deploymentOptions="$2"
    local allChartDefaults="$3"

    local envDir=$(readJSON "$runtimeConfig" '.envDir')
    local envFile=$(readJSON "$runtimeConfig" '.envFile')
    local isDeployMode=$(checkJSONFlag isDeployMode "$runtimeConfig")
    local isRenderMode=$(checkJSONFlag isRenderMode "$runtimeConfig")
    local isChartMode=$(checkJSONFlag isChartMode "$runtimeConfig")
    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")
    local isDryrunMode=$(checkJSONFlag isDryrunMode "$runtimeConfig")
    local isTestingMode=$(checkJSONFlag isTestingMode "$runtimeConfig")

    local name=$(readJSON "$deploymentOptions" '.key')
    local config=$(readJSON "$deploymentOptions" '.value')
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
        local chartPath="$chart"
    elif [[ "$source" == "remote" ]]; then
        local chartPath="fimbulvetr/$chart"
    else
        echo "Invalid source '$source', set 'local' or 'remote'"
        return 1
    fi

    (targetMatches "$runtimeConfig" "$deploymentOptions") || return 0

    echo -e "\n$(isSet $isRenderMode && echo 'Rendering' || echo 'Deploying') $name..."

    # update chart deps
    if notSet $isDryrunMode && [[ $source == "local" ]] && [[ -d $chartPath ]]; then
        if ! helm dep update $chartPath; then
            echo "Skipping due to missing dependency!"
            return 1
        fi
    fi

    ## version
    local version
    if notSet $isTestingMode; then
        if [[ -z $expectedVersion ]]; then
            local latestVersion
            latestVersion=$(getLatestChartVersion "$source" "$chartPath")
            [[ $? -ne 0 ]] && { echo "Couldn't fetch latest version, skipping"; echo "$latestVersion"; return 1; }

            echo "No version configured, using '$chart:$latestVersion'; consider locking the deployment to this version"
            version=$latestVersion
        elif ! checkChartVersion "$source" "$chartPath" "$expectedVersion"; then
            echo "Could not find expected version for $source chart: '$chartPath':$expectedVersion"
            return 1
        else
            version=$expectedVersion
        fi
    fi

    local helmVersionArg=$([ -n $version ] && echo "--version=$version" || echo "")
    ##

    local inlineValues=$(readJSON "$mergedConfig" '.values // {}')

    ## secrets
    local secretPresets=$(readJSON "$runtimeConfig" '.externalResources.secretPresets // {}')
    local secretPreset=$(readJSON "$inlineValues" '."$secretPreset" // empty')
    if isSet $secretPreset; then
        local externalSecretsValues=$(readJSON "$secretPresets" '.[$name] // {}' --arg name $secretPreset)

        # substitute the secret preset values
        inlineValues=$(echo "$inlineValues" | jq -nc \
            --argjson externalSecretsValues "$externalSecretsValues" \
            'inputs * { externalSecrets: $externalSecretsValues } | del(.secretPreset)')
    fi
    ##

    ## values
    local chartDefaultFilePath="$envDir/chartDefaults/$chart.yaml"
    local chartDefaultFileArg=$([ -f $chartDefaultFilePath ] && echo "-f $chartDefaultFilePath" || echo "")

    local deploymentFilePath="$envDir/deployments/$name.yaml"
    local deploymentFileArg=$([ -f "$deploymentFilePath" ] && echo "-f $deploymentFilePath" || echo "")

    local chartDefaultInlineValues=$(readJSON "$allChartDefaults" ".\"$chart\" | .values // {}")
    local chartDefaultInlineValuesFile=$(tempFile)
    writeJSONToYamlFile "$chartDefaultInlineValues" "$chartDefaultInlineValuesFile"

    local inlineValuesFile=$(tempFile)
    writeJSONToYamlFile "$inlineValues" "$inlineValuesFile"
    ##

    local helmSubCommand=$(isSet $isRenderMode && echo "template" || echo "upgrade --install")

    # precedence order
    #
    # chart default
    #
    # per env chart default (file)
    # per env chart default (inline)
    # deployment (file)
    # deployment (inline)

    local helmCommand="helm $helmSubCommand $name $chartPath $helmVersionArg $helmEnvValues $chartDefaultFileArg \
        -f $chartDefaultInlineValuesFile $deploymentFileArg -f $inlineValuesFile -f $envFile"

    isSet "$isDryrunMode" && echo "$helmCommand"
    notSet "$isDryrunMode" && $(echo "$helmCommand")

    return 0
}

function teardownChart() {
    local runtimeConfig="$1"
    local deploymentOptions="$2"
    local allChartDefaults="$3"

    local target=$(readJSON "$runtimeConfig" '.target')
    local isChartMode=$(checkJSONFlag isChartMode "$runtimeConfig")
    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")
    local isDryrunMode=$(checkJSONFlag isDryrunMode "$runtimeConfig")

    local name=$(readJSON "$deploymentOptions" '.key')
    local config=$(readJSON "$deploymentOptions" '.value')
    local chart=$(readJSON "$config" '.chart')

    (targetMatches "$runtimeConfig" "$deploymentOptions") || return 0

    echo -e "\nTearing down '$name'..."

    helmCommand="helm uninstall $name"

    isSet "$isDryrunMode" echo "$helmCommand"
    notSet "$isDryrunMode" && $(echo "$helmCommand")
}

function targetMatches() {
    requireArg "the runtime config" "$1" || return 1
    requireArg "the deployment options" "$2" || return 1

    local runtimeConfig="$1"
    local deploymentOptions="$2"

    local deployTarget=$(readJSON "$runtimeConfig" '.target // empty')
    local isChartMode=$(checkJSONFlag isChartMode "$runtimeConfig")
    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")

    local deploymentName=$(readJSON "$deploymentOptions" '.key')
    local config=$(readJSON "$deploymentOptions" '.value')
    local chartName=$(readJSON "$config" '.chart')

    # if limiting to "all", always pass
    notSet $deployTarget && return 0

    isSet $isDebugMode && echo -e "\nTesting instance '$deploymentName' of chart '$chartName'..."

    local chartMatches=false;
    (isSet $isChartMode && argsContain "$chartName" $deployTarget) && chartMatches=true

    local nameMatches=false;
    if notSet $isChartMode; then
        (isSet $deployTarget && argsContain "$deploymentName" $deployTarget) && nameMatches=true
    fi

    if ! isTrue "$chartMatches" && ! isTrue "$nameMatches"; then
        isSet $isDebugMode && echo "Does not match!"
        return 1
    else
        isSet $isDebugMode && echo "Matches!"
        return 0
    fi
}

function k8sPipelineInitEnv() {
    requireArg "an environment name" "$1" || return 1

    local name="$1"
    # TODO: impute namespace name from env name
    local namespace="$name"

    echo "Initializing environment '$name'..."

    echo "Creating namespace..."
    local namespaceResource=$(kubectl create namespace $namespace \
        --dry-run=true -o=json --save-config)

    # TODO: annotate with:
    #     externalsecrets.kubernetes-client.io/permitted-key-name: "/dev/cluster1/core-namespace/.*"

    isSet $isDryrunMode && echo "$namespaceResource" | prettyJson
    notSet $isDryrunMode && echo "$namespaceResource" | kubectl apply -f -

    #switch to the newly-created namespace
    notSet $isDryrunMode && kubens $namespace
    echo -e "Environment initialized!\n"
}

local tfModule=coin-collection/$(readJSON "$envConfig" ".tfModule // \"$envName\"")

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
