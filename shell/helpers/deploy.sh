#!/usr/bin/env bash

source ./common.sh
notDryrun && kubens $DP_NAMESPACE

# to use, call with `teardown` as the second arg (after env)
unset TEARDOWN
if [[ "$2" == "teardown" ]]; then
    TEARDOWN=true
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
requireArg "deployments to limit to, or 'all' to not limit" "$1" || exit 1
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
    chartDefaults=$(readJSON "$allChartDefaults" ".\"$chart\"")
    local chartDefaultCode=$?

    local mergedConfig="$config"
    if [[ $chartDefaultCode -eq 0 ]]; then
        mergedConfig=$(mergeJSON "$config" "$chartDefaults")
    fi

    local source=$(readJSON "$mergedConfig" '.source // "remote"')
    local expectedVersion=$(readJSON "$mergedConfig" '.version // ""')
    local values=$(readJSON "$mergedConfig" '.values // {}')

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

    ## inline values
    local inlineValuesFile=$(tempFile)
    echo $values | printYaml > $inlineValuesFile
    ##

    local helmChartBaseArg=$([ -f $DP_ENV_DIR/configs/$chart.yaml ] && echo "-f $DP_ENV_DIR/configs/$chart.yaml" || echo "")

    if [ $source == "local" ] && [ -d $path ] && notDryrun; then
        if ! helm dep update $path; then
            echo "Skipping due to missing dependency!"
            return 1
        fi
    fi

    local helmSubCommand=$(render && echo "template" || echo "upgrade --install")

    local helmCommand="helm $helmSubCommand $name $path $helmVersionArg $helmEnvValues $helmChartBaseArg \
        -f $DP_ENV_DIR/deployments/$name.yaml -f $inlineValuesFile -f $envFile"

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
