## dataeng-tools

This repository contains tools and scripts used by Data Engineering, both
interactively and in scripting. The primary language is currently Bash but this
may change in the future.

### Prerequisites

Make sure the following programs are installed on your computer (not every helper
requires each one, but you may want to install them all to save time):

Required:
- `jq v1.6` [link](https://github.com/stedolan/jq)

Optionally required:
- `yq v3.3.2` [link](https://github.com/mikefarah/yq)
- `aws`
- `terraform`
- `docker`
- `kubectl/kubectx`
- `helm`
- `tsc` [link](https://www.npmjs.com/package/typescript)

MacOS only:
- `watch`

Linux only:
- `xclip`

### Setup

1. Install the prerequisites for the module(s) you want to use (see docs below)
2. Clone this repository to your usual location
3. Add the following line to your profile (ie `.bashrc` or `.zshrc`), substituting `<location>`:

   `source <location>/dataeng-tools/shell/init.sh`

4. Start a new shell session, and follow the instructions to modify the config file at `~/.config/dataeng-tools/config.json5` (or equivalent).

> Note: if you would prefer to not automatically load these modules (for performance reasons), set CA_DT_AUTOINIT_DISABLED=true, and use the command `dtShell` when you want to use them

### Modules

#### AWS

> Requires: `aws`, `jq`

There are several AWS helper submodules, broken out by service.

##### Auth

The `aws-auth` helper is designed to reduce friction during development, providing
useful functions for introspecting, and switching between roles, including
automatically re-authenticating if needed. This shell integration is disabled by default, but you can enable it by setting `CA_DT_AWS_AUTH_ENABLED=true` in step 3 of the setup. This is recommended, but not required.

###### Examples

To switch between AWS organizations (if you are a member of multiple):
```
awsOrg engineering-data
```

To assume a particular AWS role, authenticating if needed:
```
awsAuth dataeng-dev-admin
```

To reset your AWS credentials (which can be useful for debugging):
```
deAuth
```

Functions:
- `awsId`: prints your full identity if authenticated, or fails
- `awsAccount`: prints your account alias if authenticated, or fails
- `awsAccountId`: prints your account id if authenticated, or fails
- `awsRole`: prints your currently-assumed IAM role if authenticated, or fails
- `deAuth`: removes authentication, can be used for testing/resetting
- `checkAuthAndFail`: checks if you're authenticated, or fails. meant to be used as a failfast
- `checkAccountAuthAndFail`: checks if you're authenticated with a specific account, or fails. meant to be used as a failfast

If you enable the shell integration, you can use the following functions to assume roles:
- `awsOrg`: switch to a different AWS organization, needed only if `DEPT_ROLE` not set
- `awsAuth`: authenticate if needed, and assume a profile
- `withProfile`: run a command with a specific AWS profile

##### IAM

Functions
- `listRolePolicies`: shows all policy attachments for a given role
- `getPolicy`: fetches a policy
- `showCurrentRolePermissions`: shows all policy attachments and their allowed actions for the current role
- `getPolicyAttachments`: shows all policy attachments for a given policy version
- `showPolicy`: shows all policy attachments and their allowed actions for a given policy version

##### EBS

Functions:
- `watchVolumeModificationProgress`: watches an EBS volume currently being modified and reports progress
- `watchSnapshotProgress`: watches an EBS volume snapshot currently being created and reports progress
- `checkAZ`: checks whether an availability zone with the given name exists
- `findSnapshots`: finds the ids of EBS snapshots with the given name, in descending-recency order
- `findSnapshot`: finds the id of the latest EBS snapshot with the given name
- `createVolume`: creates an EBS volume with the given name, either empty or from a snapshot
- `findVolumesByName`: finds the ids of the EBS volumes with the given name
- `listSnapshots`: lists all EBS snapshots in the account, with names
- `listInProgressSnapshots`: lists all in-progress EBS snapshots in the account, with names
- `listVolumes`: lists all EBS volumes in the account, with names
- `modifyVolumeIOPS`: sets the IOPS for the EBS volume with the given name or id
- `resizeVolume`: resizes the EBS volume with the given name or id
- `snapshotVolume`: snapshots the EBS volume with the given name or id
- `waitUntilSnapshotReady`: polls the status of the given EBS snapshot until it is available
- `deleteVolume`: deletes the EBS volumes with the given name or id

##### RDS

Functions:
- `checkRdsSnapshotExistence`: checks the existence of an RDS snapshot with the given name
- `waitUntilRdsSnapshotReady`: polls the status of the given RDS snapshot until it is available
- `deleteRdsSnapshot`: waits for the RDS snapshot with the given name to be available, and then deletes it
- `checkRdsInstanceExistence`: checks the existence of an RDS instance with the given name
- `snapshotRds`: snapshots the given RDS instance

##### S3

Functions:
 - `catS3Key`: downloads and reads the content of a particular S3 object

##### SSM

Functions:
 - `getSecureParam`: fetches and decrypts an SSM parameter

##### MSK

Functions:
 - `listKafkaClusters`: lists all MSK clusters in the account, with names
 - `findKafkaClusterArnByName`: finds the ARN of the MSK cluster with the given name
 - `getKafkaConnection`: gets the connection string of the MSK cluster with the given identifier
 - `getKafkaZkConnection`: gets the Zookeeper connection string of the MSK cluster with the given identifier

##### DynamoDB

Functions:
 - `listDynamoTables`: lists all DyanmoDB tables
 - `listDynamoTableItems`: lists all items in the given DynamoDB table
 - `getDynamoItem`: gets a specific DynamoDB item
 - `updateDynamoItem`: updates the value of a specific DynamoDB item

#### K8s

##### Env

The `k8s-env` helper sets up your Kubernetes configuration for working with our EKS environments. It works by adding the `eksconfig.yaml` file to your `KUBECONFIG` environment variable. This shell integration is disabled by default, but you can enable it by setting `DE_K8S_CONFIG_ENABLED=true` in step 2 of the setup. This is recommended, but not required. If you do choose to use it, however, you may want to delete any existing EKS-relevant config from your `~/.kube/config` file, to avoid conflicts.

Functions:
- `getCurrentK8sContext`: gets the current k8s context config
- `deleteK8sContext`: deletes a k8s context

##### Helpers

> Requires: `kubectl`, `yq`, `jq`, `fzf` (optional)

The K8s helper provides useful functions for interacting with clusters and various
associated administrative tasks.

> Note: these functions use the shell's current context/namespace. Please ensure you set them
appropriately using `kubectx/kubens` before running.

Functions:
 - `debugPod`: launches a debug pod in the cluster preloaded with common networking tools, drops you into its shell when created
 - `downDeploy/upDeploy/reDeploy`: stop/start/restart a deployment
 - `secretEncode`: base64-encodes a string for use in a Secret
 - `rds`: connects to an RDS instance from the service name
 - `getServiceExternalUrl`: fetches the external url, with port, for a Service with a load balancer configured
 - `getServiceEndpoint`: fetches the endpoint url for both services and proxies to zen garden
 - `killDeploymentPods`: kills all pods for a deployment, useful for forcing a restart during dev
 - `getK8sImage`: gets the container image for a given resource
 - `getServiceAccountToken`: gets the token for a given ServiceAccount
 - `createTmpK8sSvcAccContext`: creates a temporary k8s context for a ServiceAccount
 - `runAsServiceAccount`: impersonates a given ServiceAccount and runs a command
 - `kubectlAsServiceAccount`: impersonates a given ServiceAccount and runs a kubectl command using its token

##### Pipeline

The `k8s-pipeline` helper module adds functionality which helps deploy workloads to K8s clusters, please see [the README](shell/helpers/k8s-pipeline/README.md) for details

Functions:
- `k8sPipeline`: automates Helm operations, enabling simple deployments

#### Kafka

> Requires: `docker`, `python`

Functions:
- `listTopics`: lists all known topics
- `readTopic`: reads from a topic at a certain offset
- `resetTopics`: resets an MSK cluster's topics by destroying and recreating using terraform
- `resetCoinTopic`: pauses `tx-producer`, and then resets the MSK cluster's coin-specific topics using terraform
- `kafkacli`: tool to query tx-producer kafka topics

#### Coin Collection

> Requires: `jq`, `psql`, `kubectl`
> Depend on: `k8s`

Functions:
- `resetBackendDb`: pauses an `ib-backend`, recreates the db, and unpauses
- `createTransferDbs`: creates a transfer database for each coin name passed in
- `getLatestClusterVersion`: finds the latest cluster version by querying S3
- `upgradeEnvironmentClusterVersion`: upgrades an environment's cluster version to either the specified or latest

#### P2P Nodes

> Requires: `node`, `kubectl`
> Depend on: `aws-auth`, `aws-ebs`

Functions:
- `updateZCashParams`: ensures existence of an up-to-date EBS snapshot containing the latest ZCash encryption parameter files.
- `createZCashParamsVolume`: creates an EBS volume containing the latest ZCash encryption parameter files
- `snapshotNodeState`: pauses a p2p node, snapshots the EBS volume backing it, and unpauses
- `cloneNodeState`: clones an existing node's state by snapshotting and then creating a volume

#### Terraform

> Requires: `terraform`, `jq`

Functions:
- `runTF`: runs the specified terraform command in on a particular module
- `showDestroys`: generates a terraform plan and shows destructive actions
- `copyTfState`: copies the Terraform remote state
- `backupTfState`: backs up a Terraform remote state file
- `restoreTfState`: restores a Terraform remote state file backup
- `getTfLockTableItem`: get a specific TF remote state lock item
- `getTfLockDigest`: get a specific TF remote state lock digest
- `updateTfLockDigest`: get a specific TF remote state lock digest

#### Network

Functions:
- `checksumUrl`: downloads a file from a url and checksums it

### Contributing
See `CONTRIBUTING.md` for more details about how to contribute.
