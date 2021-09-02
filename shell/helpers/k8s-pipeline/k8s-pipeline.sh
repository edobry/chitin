notSet () [[ -z $1 ]]
isSet () [[ ! -z $1 ]]
isTrue () [[ "$1" = true ]]

function k9sPipeline() {
    requireArg "the environment name" "$1" || return 1

    k8sPipeline auth k9s "$1"
}

function k8sPipeline() {
    # to use, call with `cd` as the first arg
    local isCdMode
    if [[ "$1" == "cd" ]]; then
        isCdMode=true
        echo "-- CD MODE --"
        shift
    fi

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

    # to use, call with `auth` as the first arg
    local isAuthMode
    if [[ $1 == "auth" ]]; then
        isAuthMode=true
        shift
    fi

    requireArgOptions "a subcommand" "$1" 'render deploy teardown redeploy k9s debugPod' || return 1
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
    local isRedeployMode
    local isK9sMode
    local isDebugPodMode
    if [[ "$subCommand" == "teardown" ]]; then
        isTeardownMode=true
        echo "-- TEARDOWN MODE --"
    elif [[ "$subCommand" == "render" ]]; then
        isRenderMode=true
        echo "-- RENDER MODE --"
    elif [[ "$subCommand" == "deploy" ]]; then
        isDeployMode=true
        echo "-- DEPLOY MODE --"
    elif [[ "$subCommand" == "redeploy" ]]; then
        isRedeployMode=true
        echo "-- REDEPLOY MODE --"
    elif [[ "$subCommand" == "k9s" ]]; then
        isK9sMode=true
    elif [[ "$subCommand" == "debugPod" ]]; then
        isDebugPodMode=true
    fi

    # to use, call with `chart` as the second arg (after env)
    local isChartMode
    if [[ "$1" == "chart" ]]; then
        isChartMode=true
        shift
    fi

    ## load env config
    local configFile=$envDir/config.json
    if ! validateJsonFile $configFile; then
        echo "Config file at '$configFile' is not valid JSON, exiting!"
        return 1
    fi

    local envConfig=$(jsonReadFile $configFile)
    isSet "$isDebugMode" && echo "envConfig:" && jsonRead "$envConfig" '.'

    local apiVersion=$(jsonRead "$envConfig" '.apiVersion // empty')
    if isSet $apiVersion; then
        dtCheckVersion "$apiVersion" || return 1
    fi

    local tfEnv=$(jsonRead "$envConfig" '.environment.tfEnv // empty')
    local tfModule=$(jsonRead "$envConfig" ".environment.tfModule // empty")

    local accountPath="environment.awsAccount"
    local account=$(jsonRead "$envConfig" ".$accountPath // empty")
    requireArg "the AWS account name as '$accountPath'" "$account" || return 1

    local region=$(jsonRead "$envConfig" '.environment.awsRegion // empty')
    if [[ -z $region ]]; then
        region=$(awsGetRegion)
        if [[ -z $region ]]; then
            echo "The AWS region for this environment could not be determined!"
            return 1
        fi
    fi

    local contextPath="environment.k8sContext"
    local context=$(jsonRead "$envConfig" ".$contextPath // empty")
    requireArg "the K8s context name as '$contextPath'" "$context" || return 1

    local namespacePath="environment.k8sNamespace"
    local namespace=$(jsonRead "$envConfig" ".$namespacePath // empty")
    requireArg "the K8s namespace name as '$namespacePath'" "$namespace" || return 1

    echo "Initializing DP environment '$envName'..."
    isSet "$tfEnv" && echo "Terraform environment: '$tfEnv'"
    isSet "$tfModule" && echo "Terraform module: '$tfModule'"
    echo "AWS account: 'ca-aws-$account'"
    echo "AWS region: '$region'"
    echo "K8s context: '$context'"
    echo "K8s namespace: '$namespace'"
    echo
    ##

    # aws auth
    if isSet "$isAuthMode"; then
        awsAuth "$account-admin"
    fi
    checkAccountAuthAndFail "$account" || return 1

    local vpnTest
    vpnTest=$(netTestVpn)
    if [[ $? -ne 0 ]]; then
        echo "$vpnTest"
        return 1
    fi

    ## env init
    notSet $isDryrunMode && kubectx $context

    if ! k8sNamespaceExists $namespace; then
        k8sPipelineInitEnv $namespace $dockerUsername $dockerPassword
    fi

    notSet $isDryrunMode && kubens $namespace
    ##

    if isSet "$isK9sMode"; then
        k9sEnv $account-admin $context $namespace
        return 0
    fi

    if isSet "$isDebugPodMode"; then
        k8sDebugPod --az ${region}a
        return 0
    fi

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

    local modeCommand
    if isSet $isTeardownMode; then
        modeCommand='teardownChart'
    elif isSet $isRenderMode || isSet $isDeployMode; then
        modeCommand='installChart'
    elif isSet $isRedeployMode; then
        modeCommand='redeployChart'
        unset isRenderMode
        isDeployMode=true
    fi

    local runtimeConfig=$(echo "$envConfig" | jq -nc \
        --arg envName "$envName" \
        --arg envDir "$envDir" \
        --arg target "$target" \
        --arg region "$region" \
        --arg isDebugMode "$isDebugMode" \
        --arg isDryrunMode "$isDryrunMode" \
        --arg isTestingMode "$isTestingMode" \
        --arg isTeardownMode "$isTeardownMode" \
        --arg isDeployMode "$isDeployMode" \
        --arg isRedeployMode "$isRedeployMode" \
        --arg isRenderMode "$isRenderMode" \
        --arg isChartMode "$isChartMode" \
        'inputs * {
        env: $envName,
        envDir: $envDir,
        target: $target,
        region: $region,
        flags: {
            isDebugMode: ($isDebugMode != ""),
            isDryrunMode: ($isDryrunMode != ""),
            isTestingMode: ($isTestingMode != ""),
            isTeardownMode: ($isTeardownMode != ""),
            isDeployMode: ($isDeployMode != ""),
            isRedeployMode: ($isRedeployMode != ""),
            isRenderMode: ($isRenderMode != ""),
            isChartMode: ($isChartMode != "")
        } }')

    isSet "$isDebugMode" && jsonRead "$runtimeConfig" '.'

    # if the environment specifies a base SSM path, use that, otherwise default
    local baseSsmPath=$(jsonRead "$runtimeConfig" '"/\(.environment.ssmOverride // "dataeng-\($envName)")"' --arg envName dev)
    # isSet $isDryrunMode && echo "Base SSM Path: '$baseSsmPath'"

    notSet "$isTestingMode" && notSet "$isDryrunMode" && notSet "$isTeardownMode" && helm repo update
    
    local chartDefaults=$(jsonRead "$runtimeConfig" '.chartDefaults')

    local cdModeFlag=$(isSet $isCdMode && echo "true" || echo "false")

    local deployments=$(jsonRead "$runtimeConfig" '
        # store the root object for later
        . as $root |

        # reformat & merge externalResources.deployments into deployments
        {
            externalResourceDeployments: (
                .externalResources.deployments | to_entries |
                    map({ key: .key,
                        value: { chart: "external-service", values: .value }
                    })),
            deployments: (.deployments | to_entries)
        } | [.externalResourceDeployments, .deployments] | flatten |

        # merge chartDefault config, if exists into each one
        map({key, value: (($root.chartDefaults[.value.chart] // {} | del(.values)) * .value) })[] |

        # filter out disabled and cdDisabled deployments
        select(.value.disabled | not) |
        select(($cdMode | test("false")) or (($cdMode | test("true")) and (.value.cdDisabled | not)))' \
    --arg cdMode $cdModeFlag)

    if [[ -z $deployments ]]; then
        echo "No deployments configured, nothing to do. Exiting!"
        return 0
    fi

    while read -r deploymentOptions; do
         $modeCommand "$runtimeConfig" "$deploymentOptions" "$chartDefaults"
    done <<< $deployments

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
    requireArg "an AWS region name" "$3" || return 1
    requireArg "a K8s context name" "$4" || return 1
    requireArg "a K8s namespace name" "$5" || return 1

    local envName="$1"
    local awsAccount="$2"
    local awsRegion="$3"
    local k8sContext="$4"
    local k8sNamespace="$5"

    local apiVersion=$(dtGetReleasedVersion)
    local config=$(jq -n \
        --arg apiVersion $apiVersion \
        --arg envName $envName \
        --arg awsAccount $awsAccount \
        --arg awsRegion $awsRegion \
        --arg k8sContext $k8sContext \
        --arg k8sNamespace $k8sNamespace \
    '{
        apiVersion: $apiVersion,
        environment: {
            awsAccount: $awsAccount,
            awsRegion: $awsRegion,
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

    local region=$(jsonRead "$runtimeConfig" '.region')
    local envDir=$(jsonRead "$runtimeConfig" '.envDir')
    local isDeployMode=$(checkJSONFlag isDeployMode "$runtimeConfig")
    local isRenderMode=$(checkJSONFlag isRenderMode "$runtimeConfig")
    local isChartMode=$(checkJSONFlag isChartMode "$runtimeConfig")
    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")
    local isDryrunMode=$(checkJSONFlag isDryrunMode "$runtimeConfig")
    local isTestingMode=$(checkJSONFlag isTestingMode "$runtimeConfig")

    local name=$(jsonRead "$deploymentOptions" '.key')
    local config=$(jsonRead "$deploymentOptions" '.value')
    local chart=$(jsonRead "$config" '.chart')

    local chartType=$(jsonRead "$config" '.type // "helm"')
    requireArgOptions "a chart type" "$chartType" "helm cdk8s" || return 1

    local isHelmChart
    if [[ "$chartType" == 'helm' ]]; then
        isHelmChart=true
    fi

    local chartDefaults
    chartDefaults=$(jsonRead "$allChartDefaults" ".\"$chart\" | del(.values)")
    local chartDefaultCode=$?

    local mergedConfig="$config"
    if [[ $chartDefaultCode -eq 0 ]]; then
        mergedConfig=$(jsonMerge "$config" "$chartDefaults")
    fi

    local source=$(jsonRead "$mergedConfig" '.source // "remote"')
    local expectedVersion=$(jsonRead "$mergedConfig" '.version // ""')

    if [[ "$source" == "local" ]]; then
        local chartPath="$chart"
        chart=$(basename "$chart")
    elif [[ "$source" == "remote" ]]; then
        local chartPath=$(isSet $isHelmChart && echo "fimbulvetr/$chart" || echo "@chainalysis/$chart")
        # echo "chartPath: $chartPath"
    else
        echo "Invalid source '$source', set 'local' or 'remote'"
        return 1
    fi

    (targetMatches "$runtimeConfig" "$deploymentOptions") || return 0

    echo -e "\n$(isSet $isRenderMode && echo 'Rendering' || echo 'Deploying') $name..."
    isSet "$isDryrunMode" && echo "$mergedConfig" | prettyYaml

    # update chart deps
    if notSet $isDryrunMode && [[ $source == "local" ]] && isSet $isHelmChart && [[ -d $chartPath ]]; then
        if ! helm dep update $chartPath; then
            echo "Skipping due to missing dependency!"
            return 1
        fi
    fi

    ## version
    local version
    if notSet $isTestingMode; then
        if isSet $isHelmChart; then
            if [[ -z $expectedVersion ]]; then
                local latestVersion
                latestVersion=$(helmChartGetLatestVersion "$source" "$chartPath")
                [[ $? -ne 0 ]] && { echo "Couldn't fetch latest version, skipping"; echo "$latestVersion"; return 1; }

                echo "No version configured, using '$chart:$latestVersion'; consider locking the deployment to this version"
                version=$latestVersion
            elif ! helmChartCheckVersion "$source" "$chartPath" "$expectedVersion"; then
                echo "Could not find expected version for $source chart: '$chartPath':$expectedVersion"
                return 1
            else
                version=$expectedVersion
            fi
        else
            if [[ "$source" == "remote" ]]; then
                version=$expectedVersion
            fi
        fi
    fi

    local helmVersionArg=$([[ -n $version ]] && isSet $isHelmChart && echo "--version=$version" || echo "")
    ##

    local inlineValues=$(jsonRead "$mergedConfig" '.values // {}')
    local nestValues=$(jsonRead "$mergedConfig" '.nestValues // empty')

    ## secrets
    local secretPresets=$(jsonRead "$runtimeConfig" '.externalResources.secretPresets // {}')
    local secretPreset=$(jsonRead "$inlineValues" '."$secretPreset" // empty')
    if isSet $secretPreset; then
        local externalSecretsValues=$(jsonRead "$secretPresets" '.[$name] // {}' --arg name $secretPreset)

        # substitute the secret preset values
        inlineValues=$(echo "$inlineValues" | jq -nc \
            --argjson externalSecretsValues "$externalSecretsValues" \
            'inputs * { externalSecrets: $externalSecretsValues } | del(.secretPreset)')
    fi
    ##

    ## values

    # generate environment-specific configuration and write to a temporary file
    local envValues=$(jq -cr '{
        region: $region, nodegroup: .environment.eksNodegroup, nodeSelector: {
            "eks.amazonaws.com/nodegroup": (.environment.eksNodegroup // empty) } }' \
            --arg region $region <<< "$runtimeConfig")
    
    # handle parent chart value nesting
    if isSet "$nestValues"; then
        envValues=$(jq -nc --arg chartName "$chart" --argjson vals "$envValues" '{ ($chartName): $vals }')
    fi

    isSet "$isDryrunMode" && echo "$envValues" | prettyYaml
    isSet "$isDryrunMode" && echo

    local envFile=$(tempFile).json
    notSet "$isDryrunMode" && echo "$envValues" > "$envFile"

    local chartDefaultFilePath="$envDir/chartDefaults/$chart.yaml"
    local chartDefaultFileArg=$([ -f $chartDefaultFilePath ] && echo "-f $chartDefaultFilePath" || echo "")

    local deploymentFilePath="$envDir/deployments/$name.yaml"
    local deploymentFileArg=$([ -f "$deploymentFilePath" ] && echo "-f $deploymentFilePath" || echo "")

    local chartDefaultInlineValues=$(jsonRead "$allChartDefaults" ".\"$chart\" | .values // {}")
    local chartDefaultInlineValuesFile=$(tempFile).yaml
    jsonWriteToYamlFile "$chartDefaultInlineValues" "$chartDefaultInlineValuesFile"

    local inlineValuesFile=$(tempFile).yaml
    jsonWriteToYamlFile "$inlineValues" "$inlineValuesFile"
    ##

    local subCommand
    if isSet $isRenderMode; then
        subCommand="template"
    else
        subCommand=$(isSet $isHelmChart && echo "upgrade --install" || echo "deploy")
    fi
    
    # precedence order
    #
    # chart default
    #
    # per env chart default (file)
    # per env chart default (inline)
    # deployment (file)
    # deployment (inline)
    local cdk8sVersionArg=$([[ -n $expectedVersion ]] && echo "$expectedVersion" || echo "_")
    local templateCommand=$(isSet $isHelmChart && echo "helm" || echo "k8sRunCdk8sChart $source $chart $cdk8sVersionArg")

    local fullTemplateCommand="$templateCommand "$subCommand" $name $chartPath $helmVersionArg $helmEnvValues -f $envFile $chartDefaultFileArg \
        -f $chartDefaultInlineValuesFile $deploymentFileArg -f $inlineValuesFile"

    isSet "$isDryrunMode" && echo "$fullTemplateCommand"
    local result
    notSet "$isDryrunMode" && $(echo "$fullTemplateCommand")
    result=$?

    if notSet "$isRenderMode" && notSet "$isHelmChart"; then
        if [[ $result -eq 0 ]]; then
            echo "Applying rendered manifests..."

            local renderCommand="k8sApplyInstance $name dist"
            isSet "$isDryrunMode" && echo "$renderCommand"
            notSet "$isDryrunMode" && $(echo "$renderCommand")
        else
            echo 'Error rendering chart!'
        fi
    fi

    return 0
}

function k8sRunCdk8sChart() {
    requireArg "source" "$1" || return 1
    requireArg "chart" "$2" || return 1
    requireArg "version" "$3" || return 1
    requireArg "subcommand" "$4" || return 1
    requireArg "chart instance name" "$5" || return 1
    requireArg "chart package" "$6" || return 1
    requireArg "argument list" "$7" || return 1

    local source=$1
    local chart=$2
    local version=$([[ "$3" == "_" ]] && echo "" || echo "@$3")
    local subcommand="$4"
    local instanceName="$5"
    local package="$6"
    shift; shift; shift; shift; shift; shift;

    if [[ "$source" == "remote" ]]; then
        npm exec --package $package$version chart -- template $instanceName $@
    else
        # $(basename $chart)-chart
        npm exec --prefix $package chart -- template $instanceName $@
    fi
}

function teardownChart() {
    local runtimeConfig="$1"
    local deploymentOptions="$2"
    local allChartDefaults="$3"

    local target=$(jsonRead "$runtimeConfig" '.target')
    local isChartMode=$(checkJSONFlag isChartMode "$runtimeConfig")
    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")
    local isDryrunMode=$(checkJSONFlag isDryrunMode "$runtimeConfig")

    local name=$(jsonRead "$deploymentOptions" '.key')
    local config=$(jsonRead "$deploymentOptions" '.value')
    local chart=$(jsonRead "$config" '.chart')

    local chartType=$(jsonRead "$config" '.type // "helm"')
    requireArgOptions "a chart type" "$chartType" "helm cdk8s" || return 1

    local isHelmChart
    if [[ "$chartType" == 'helm' ]]; then
        isHelmChart=true
    fi

    (targetMatches "$runtimeConfig" "$deploymentOptions") || return 0

    echo -e "\nTearing down '$name'..."

    local teardownCommand=$(isSet $isHelmChart && echo "helm uninstall" || echo "k8sDeleteInstance")
    local fullTeardownCommand="$teardownCommand $name"

    isSet "$isDryrunMode" echo "$fullTeardownCommand"
    notSet "$isDryrunMode" && $(echo "$fullTeardownCommand")
}

function redeployChart() {
    local runtimeConfig="$1"
    local deploymentOptions="$2"
    local allChartDefaults="$3"

    teardownChart "$runtimeConfig" "$deploymentOptions" "$chartDefaults"
    installChart "$runtimeConfig" "$deploymentOptions" "$chartDefaults"
}

function targetMatches() {
    requireArg "the runtime config" "$1" || return 1
    requireArg "the deployment options" "$2" || return 1

    local runtimeConfig="$1"
    local deploymentOptions="$2"

    local deployTarget=$(jsonRead "$runtimeConfig" '.target // empty')
    local isChartMode=$(checkJSONFlag isChartMode "$runtimeConfig")
    local isDebugMode=$(checkJSONFlag isDebugMode "$runtimeConfig")

    local deploymentName=$(jsonRead "$deploymentOptions" '.key')
    local config=$(jsonRead "$deploymentOptions" '.value')
    local chartName=$(jsonRead "$config" '.chart')

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
        --dry-run=client -o=json --save-config)

    # TODO: annotate with:
    #     externalsecrets.kubernetes-client.io/permitted-key-name: "/dev/cluster1/core-namespace/.*"

    isSet $isDryrunMode && echo "$namespaceResource" | prettyJson
    notSet $isDryrunMode && echo "$namespaceResource" | kubectl apply -f -

    #switch to the newly-created namespace
    notSet $isDryrunMode && kubens $namespace
    echo -e "Environment initialized!\n"
}

local tfModule=coin-collection/$(jsonRead "$envConfig" ".tfModule // \"$envName\"")

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
            | prettyYaml > $DP_RESOURCES_DIR/$name.yaml
    done
}
