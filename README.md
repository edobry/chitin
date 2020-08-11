## dataeng-tools

This repository contains tools and scripts used by Data Engineering, both
interactively and in scripting. The primary language is currently Bash but this
may change in the future.

### Prerequisites

Make sure the following programs are installed on your computer (not every helper
requires each one, but you may want to install them all to save time):
- `jq v1.6` [link](https://github.com/stedolan/jq)
- `yq v3.3.2` [link](https://github.com/mikefarah/yq)
- `aws`
- `terraform`
- `docker`
- `kubectl/kubectx`
- `helm`

MacOS only:
- `watch`

Linux only:
- `xclip`

### Setup

1. Clone (if you have not already) the `chainalysis/terraform` repository
2. Copy the contents of `chainalysis-env-template.sh` into your profile, however
you prefer (ie, into your existing configuration, or by copying the file and sourcing),
and then set your own values
3. Add `source $PROJECT_DIR/dataeng-tools/shell/init.sh` to your profile, AFTER
the line(s) you added in the previous step

### Helpers

#### AWS

> Requires: `aws`, `jq`

There are several AWS helper submodules, broken out by service.

##### Auth

The `aws-auth` helper is designed to reduce friction during development, providing
useful functions for introspecting, and switching between roles, including
automatically re-authenticating if needed. This shell integration is disabled by default, but you can enable it by setting `DE_AWS_AUTH_ENABLED=true` in step 2 of the setup. This is recommended, but not required.

Notable functions:
- `awsId`: prints your full identity if authenticated, or fails
- `awsAccount`: prints your account alias if authenticated, or fails
- `awsRole`: prints your currently-assumed IAM role if authenticated, or fails
- `deAuth`: removes authentication, can be used for testing/resetting
- `checkAuthAndFail`: checks if you're authenticated, or fails. meant to be used as a failfast
- `checkAccountAuthAndFail`: checks if you're authenticated with a specific account, or fails. meant to be used as a failfast

If you enable the shell integration, you can use the following functions to assume roles:
- `aws-auth`: tab-completes known AWS profiles
- `aws-dataeng-dev`
- `aws-dataeng-prod`
- `aws-kafka-prod`

##### EBS

Notable functions:
- `watchVolumeModificationProgress`: watches an EBS volume currently being modified and reports progress
- `watchSnapshotProgress`: watches an EBS volume snapshot currently being created and reports progress
- `checkAZ`: checks whether an availability zone with the given name exists
- `findSnapshot`: finds the id of an EBS snapshot with the given name
- `createVolume`: creates an EBS volume with the given name, either empty or from a snapshot
- `snapshotVolume`: snapshots the EBS volume with the given name or id
- `findVolumesByName`: finds the ids of the EBS volumes with the given name
- `resizeVolume`: resizes the EBS volume with the given name or id
- `deleteVolume`: deletes the EBS volumes with the given name or id

##### RDS

Notable functions:
- `checkRdsSnapshotExistence`: checks the existence of an RDS snapshot with the given name
- `waitUntilRdsSnapshotReady`: polls the status of the given RDS snapshot until it is available
- `deleteRdsSnapshot`: waits for the RDS snapshot with the given name to be available, and then deletes it
- `checkRdsInstanceExistence`: checks the existence of an RDS instance with the given name
- `snapshotRds`: snapshots the given RDS instance

##### SSM

Notable functions:
 - `getSecureParam`: fetches and decrypts an SSM parameter

#### K8s

##### Env

The `k8s-env` helper sets up your Kubernetes configuration for working with our EKS environments. It works by adding the `eksconfig.yaml` file to your `KUBECONFIG` environment variable. This shell integration is disabled by default, but you can enable it by setting `DE_K8S_CONFIG_ENABLED=true` in step 2 of the setup. This is recommended, but not required. If you do choose to use it, however, you may want to delete any existing EKS-relevant config from your `~/.kube/config` file, to avoid conflicts.

##### Helpers

> Requires: `kubectl`, `yq`, `jq`, `fzf` (optional)

The K8s helper provides useful functions for interacting with clusters and various
associated administrative tasks.

Notable functions:
 - `debugPod`: launches a debug pod in the cluster preloaded with common networking tools, drops you into its shell when created
 - `downDeploy/upDeploy/reDeploy`: stop/start/restart a deployment
 - `secretEncode`: base64-encodes a string for use in a Secret
 - `rds`: connects to an rds instance from the service name
 - `getServiceExternalUrl`: fetches the external url, with port, for a Service with a load balancer configured
 - `getServiceEndpoint`: fetches the endpoint url for both services and proxies to zen garden

#### Kafka

> Requires: `docker`, `python`

Notable functions:
- `listTopics`: lists all known topics
- `readTopic`: reads from a topic at a certain offset
- `resetTopics`: resets an MSK cluster's topics by destroying and recreating using terraform
- `resetCoinTopic`: pauses `tx-producer`, and then resets the MSK cluster's coin-specific topics using terraform
- `readKafkaBlock`: reads protobuf encoded blocks

#### Coin Collection

> Requires: `jq`, `psql`, `kubectl`
> Depend on: `k8s`

Notable functions:
- `resetBackendDb`: pauses an `ib-backend`, recreates the db, and unpauses
- `createTransferDbs`: creates a transfer database for each coin name passed in
- `snapshotNodeState`: pauses a p2p node, snapshots the EBS volume backing it, and unpauses
- `getLatestClusterVersion`: finds the latest cluster version by querying S3
- `upgradeEnvironmentClusterVersion`: upgrades an envrionment's cluster version to either the specified or latest

#### Terraform

> Requires: `terraform`, `jq`

Notable functions:
- `runTF`: runs the specified terraform command in on a particular module
- `showDestroys`: generates a terraform plan and shows destructive actions
