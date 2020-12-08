# K8s Deploy

This module facilitates deploying workloads to our K8s clusters, providing several convenience features streamlining developer workflows and guarding against common failure modes. It is to be used in conjunction with a Helm chart repository and a live application configuration repository (or within a single application repository).

### Usage

The exposed `k8sPipeline` function can be used to `render` charts `deploy` them to a cluster, and to `teardown` afterwords. It is to be run in a directory with a `config.json` file which sets up an `environment`.

#### Commands

The basic form these commands take is:
```
k8sPipeline [flags...] [subcommand] [environment] [(optional: chart) target... | all]
```
with the components being as follows:
- `flags`: keywords which, when set, modify the operation of the function
   - `debug`: enables more detailed logging
   - `dryrun` simulates a run, printing out commands that would be executed
- `subcommand`: the operation to be executed
   - `deploy`: the most common mode; `render` and then deploy the targeted deployments to the cluster
   - `render`: substitutes values and templates the targeted deployments, but prints out the results instead of deploying
   - `teardown`: uninstalls the targeted deployments from the cluster
- `environment`: which environment to operate in, corresponds to a directory
- `target`: which deployments to operate on. if `all`, no limiting. if prepended with `chart`, args will be interpreted as chart names, rather than deployment names.

##### Examples

This command pushes the `eth-node` deployment to the `dev` environment:
```
k8sPipeline deploy dev eth-node
```

This command does almost the same thing, but prints out the actions that would have been done instead:
```
k8sPipeline dryrun deploy dev eth-node
```

This command deploys all instances of the `ib-backend` chart in the `prod` environment, ie, if releasing a new version:
```
k8sPipeline deploy prod chart ib-backend
```

This command generates the manifests for all deployments in the `dev` environment and outputs them to a single file:
```
k8sPipeline render dev all > dev-release.yaml
```

This command uninstalls the `eth-seeder` and `eth-backend` deployments from the `dev` environment:
```
k8sPipeline teardown dev eth-seeder eth-backend
```

#### Configuration

Environments are configured within a directory called `env` in the root of a repository; each environment is represented by a subdirectory and contains a configuration file, as well as several subdirectories, each of which maps to a field in the configuration file.

##### Configuration File

The `config.json` file sets up the environment, including the relevant account, region, cluster, namespace, and node group. It also configures each deployment, setting the name, chart, and source.

###### Fields
- `environment`: name of the Terraform environment
- `tfModule`: Terraform module to reference
- `account`: AWS account to use
- `region`: AWS region to use
- `context`: pre-configured K8s context to use
- `namespace`: K8s namespace to create/use
- `nodegroup`: EKS nodegroup to deploy to
- `chartDefaults`: defaults to apply to any instance of a chart, fields same as `deployments`
- `deployments`: workloads to be deployed, each is an instance of a chart with these fields:
   - `chart`: name/path of the Helm chart to use
   - `source`: where to pull the chart from, options are:
      - `local`: local filesystem, expects a path (relative or absolute)
      - `artifactory`: pull from `fimbulvetr`, expects the repo to be configured with Helm
      - `remote`: pull from a remote repository
   - `version`: version of the chart to require [optional]
   - `values`: an inline values object, will be converted to YAML and passed to Helm
- `externalResources`: instances of the `external-service` chart to be deployed, takes only values
- `resourcesOverrides`: overrides credentials passed to `externalResources`

###### Notes

- `chartDefaults`: applies values to all deployments of a certain chart in an environment, ie versions, resources, etc
- `externalResources`: enables creation of K8s Services to facilitate access to extra-cluster resources, ie databases, MSK clusters, or Hetzner services

###### Subdirectory Mappings
- `chartDefaults`: files map to the equivalent config entry's `values` field
- `deployments`: files map to the equivalent config entry's `values` field
- `externalResources`: files map to the equivalent config entry's value

###### Overrides & Precedence

The subdirectories/files are simply a way to extract complex configuration from the main file, and are merged with inline config in this precedence order (higher overrides):
1. Helm chart's `values.yaml`
2. `chartDefaults` (file)
3. `chartDefaults` (inline)
4. `deployments` (file)
5. `deployments` (inline)

###### Example

```json
{
    "environment": "dataeng-dev",
    "tfModule": "legacy-dev",
    "account": "dataeng-dev",
    "region": "eu-west-1",
    "context": "coin-collection-dev",
    "namespace": "coin-collection-dev",
    "nodegroup": "coin-collection-eu-west-1a-workers",
    "chartDefaults": {
        "external-service": {
            "version": "0.1.0"
        },
        "ethereum": {
            "version": "1.3.3"
        },
        "ib-backend": {
            "version": "0.5.4",
            "values": {
                "cluster": {
                    "version": "6.47.0"
                }
            }
        },
    },
    "deployments": {
        "eth-node": {
            "chart": "ethereum"
        },
        "eth2-node": {
            "chart": "ethereum"
        },
        "eth-backend": {
            "chart": "ib-backend"
        },
        "eth-producer": {
            "version": "0.5.4",
            "chart": "tx-producer"
        }
    },
    "externalResources": {
        "bison-eos": {
            "externalName": "[...].eos.bison.run"
        },
        "postgres-cascade": {
            "externalIP": "10.0.0.18",
            "externalPort": 5432
        },
        "postgres-eth": {
            "externalName": "dataeng-dev-coin-collection-eth.[...].rds.amazonaws.com"
        },
        "tx-producer-kafka-1": {
            "externalName": "b-1.kafka-nonprod-tx-produ.[...].amazonaws.com"
        }
    },
    "resourcesOverrides": {
        "postgres-cascade": "readonly"
    }
}
```
