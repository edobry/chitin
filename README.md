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

- `yq v4.11.2` [link](https://github.com/mikefarah/yq)
  - make sure you install from `brew` and not `pip`
- `aws v2.0.57`
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

##### ASG

Functions

- `awsAsgGetTags`: gets the tags for the ASG with the given name

##### IAM

Functions

- `awsIamListRolePolicies`: shows all policy attachments for a given role
- `awsIamListUserPolicies`: shows all policy attachments for a given user
- `awsIamGetPolicy`: fetches a policy
- `awsIamShowCurrentRolePermissions`: shows all policy attachments and their allowed actions for the current role
- `awsIamGetPolicyAttachments`: shows all policy attachments for a given policy version
- `awsIamShowPolicy`: shows all policy attachments and their allowed actions for a given policy version
- `awsIamAssumeRoleShell`: assumes an IAM role in a subshell, can be used to test permissions

##### EBS

Functions:

- `awsEbsWatchVolumeModificationProgress`: watches an EBS volume currently being modified and reports progress
- `awsEbsWatchSnapshotProgress`: watches an EBS volume snapshot currently being created and reports progress
- `awsCheckAZ`: checks whether an availability zone with the given name exists
- `awsEbsFindSnapshots`: finds the ids of EBS snapshots with the given name, in descending-recency order
- `awsEbsFindSnapshot`: finds the id of the latest EBS snapshot with the given name
- `awsEbsDeleteSnapshots`: deletes all EBS snapshots with the given name
- `awsEbsShowVolumeTags`: shows the tags on an EBS volume
- `awsEbsTagVolume`: adds a tag to an EBS volume
- `awsEbsCreateVolume`: creates an EBS volume with the given name, either empty or from a snapshot
- `awsEbsFindVolumesByName`: finds the ids of the EBS volumes with the given name
- `awsEbsListSnapshots`: lists all EBS snapshots in the account, with names
- `awsEbsListInProgressSnapshots`: lists all in-progress EBS snapshots in the account, with names
- `awsEbsListVolumes`: lists all EBS volumes in the account, with names
- `awsEbsModifyVolumeIOPS`: sets the IOPS for the EBS volume with the given name or id
- `awsEbsResizeVolume`: resizes the EBS volume with the given name or id
- `awsEbsSnapshotVolume`: snapshots the EBS volume with the given name or id
- `awsEbsWaitUntilSnapshotReady`: polls the status of the given EBS snapshot until it is available
- `awsEbsDeleteVolume`: deletes the EBS volumes with the given name or id
- `awsEbsAuthorizeSnapshotAccess`: authorizes access to a snapshot from another account
- `awsEbsCopySnapshotCrossAccount`: authorizes access to, and then copies a snapshot across to another account

##### EC2

Functions:

- `awsEc2ListInstances`: lists existing EC2 instances
- `awsEc2FindInstancesByName`: finds the ids of the EC2 instances with the given name
- `awsEc2ListKeypairs`: lists existing EC2 keypairs
- `awsEc2CheckKeypairExistence`: checks that a given EC2 Keypair exists
- `awsEc2CreateKeypair`: creates an EC2 keypair and persists it in SSM
- `awsEc2DeleteKeypair`: deletes an existing EC2 keypair and removes it from SSM
- `awsEc2DownloadKeypair`: reads a given EC2 Keypair out from SSM, persists locally, and permissions for use
- `awsEc2GetInstanceKeypairName`: queries the name of the keypair used for the given EC2 instance
- `awsEc2DownloadKeypairForInstance`: queries the appropriate keypair for an EC2 instance and downloads it
- `awsEc2ListNetworkInterfaceAddresses`: lists all ENIs along with their associated private IP addresses
- `awsEc2GetNetworkInterface`: gets the description for a given ENI

##### Route 53

Functions:

- `awsR53ListZones`: lists all hosted zones
- `awsR53GetZoneId`: finds the id of the Route 53 hosted zone the given name
- `awsR53GetRecords`: gets all records in the given hosted zone
- `awsR53GetARecords`: gets all A records in the given hosted zone

##### RDS

Functions:

- `awsRdsCheckSnapshotExistence`: checks the existence of an RDS snapshot with the given name
- `awsRdsWaitUntilSnapshotReady`: polls the status of the given RDS snapshot until it is available
- `awsRdsDeleteSnapshot`: waits for the RDS snapshot with the given name to be available, and then deletes it
- `awsRdsCheckInstanceExistence`: checks the existence of an RDS instance with the given name
- `awsRdsSnapshot`: snapshots the given RDS instance

##### S3

Functions:

- `awsS3ListBuckets`: lists existing S3 buckets
- `awsS3ReadObject`: downloads and reads the content of a particular S3 object
- `awsS3KeyExists`: check if the given key in the given s3 bucket exists

##### SSM

Functions:

- `awsSsmListParams`: lists all SSM parameter names
- `awsSsmGetParam`: fetches and decrypts an SSM parameter
- `awsSsmSetParam`: sets an SSM parameter
- `awsSsmDeleteParam`: deletes an SSM parameter

##### MSK

Functions:

- `awsMskListClusters`: lists all MSK clusters in the account, with names
- `awsMskFindClusterArnByName`: finds the ARN of the MSK cluster with the given name
- `awsMskGetConnection`: gets the connection string of the MSK cluster with the given identifier
- `awsMskGetZkConnection`: gets the Zookeeper connection string of the MSK cluster with the given identifier
- `awsMskGetBrokers`: gets the broker list of the given MSK cluster with the given identifier
- `awsMskGetBrokerArns`: gets the list of broker ARNs of the given MSK cluster with the given identifier
- `awsMskRebootBroker`: reboots the MSK broker with the given cluster identifier and broker ID

##### DynamoDB

Functions:

- `awsDynamoListTables`: lists all DyanmoDB tables
- `awsDynamoListTableItems`: lists all items in the given DynamoDB table
- `awsDynamoGetItem`: gets a specific DynamoDB item
- `awsDynamoUpdateItem`: updates the value of a specific DynamoDB item

#### Docker

Functions:

- `pruneDockerImages`: deletes all locally-cached Docker images not used in the last day
- `listDockerImageTags`: lists all available tags for a Docker image
- `getLatestDockerImageTag`: gets the latest available tag for a Docker image
- `getDockerImageTags`: gets a human-readable view of available tags for a Docker image
- `dockerArtifactoryPublish`: tags and pushes a locally-built Docker image to Artifactory
- `dockerArtifactoryPublishLast`: tags and pushes the last locally-built Docker image to Artifactory

#### Helm

Functions:

- `helmReadRepoConfig`: prints out the local Helm repository configuration
- `helmRepoChecConfigured`: s whether a given Helm repository is configured
- `helmRepoConfigureArtifactory`: configures the Artifactory Helm repository
- `helmRepoGetCredentials`: prints a JSON object containing the locally-configured credentials for the given repository
- `helmRepoGetArtifactoryCredentials`: prints a JSON object containing the locally-configured Artifactory credentials
- `helmChartGetLatestRemoteVersion`: gets the latest version of a given helm chart
- `helmChartCheckRemoteVersion`: checks whether the given version of the given helm chart exists
- `helmChartGetLocalVersion`: gets the version of a local Helm chart
- `helmChartGetLatestVersion`: gets the latest version of a given Helm chart
- `helmChartCheckVersion`: checks the version of a given Helm chart against a desired version

#### K8s

##### Env

The `k8s-env` helper sets up your Kubernetes configuration for working with our EKS environments. It works by adding the `eksconfig.yaml` file to your `KUBECONFIG` environment variable. This shell integration is disabled by default, but you can enable it by setting `DE_K8S_CONFIG_ENABLED=true` in step 2 of the setup. This is recommended, but not required. If you do choose to use it, however, you may want to delete any existing EKS-relevant config from your `~/.kube/config` file, to avoid conflicts.

Functions:

- `k8sGetCurrentContext`: gets the current k8s context config
- `k8sDeleteContext`: deletes a k8s context

##### Helpers

> Requires: `kubectl`, `yq`, `jq`, `fzf` (optional)

The K8s helper provides useful functions for interacting with clusters and various
associated administrative tasks.

> Note: these functions use the shell's current context/namespace. Please ensure you set them
> appropriately using `kubectx/kubens` before running.

Functions:

- `k8sDebugPod`: launches a debug pod in the cluster preloaded with common networking tools, drops you into its shell when created
- `k8sDownDeploy/k8sUpDeploy/k8sReDeploy`: stop/start/restart a deployment
- `k8sDownDeployAndWait`: scales down a deployment to 0 replicas, and awaits the operation's completion
- `k8sSecretEncode`: base64-encodes a string for use in a Secret
- `rds`: connects to an RDS instance from the service name
- `getServiceExternalUrl`: fetches the external url, with port, for a Service with a load balancer configured
- `getServiceEndpoint`: fetches the endpoint url for both services and proxies to zen garden
- `k8sKillDeploymentPods`: kills all pods for a deployment, useful for forcing a restart during dev
- `k8sGetImage`: gets the container image for a given resource
- `k8sGetServiceAccountToken`: gets the token for a given ServiceAccount
- `k8sCreateTmpSvcAccContext`: creates a temporary k8s context for a ServiceAccount
- `k8sRunAsServiceAccount`: impersonates a given ServiceAccount and runs a command
- `kubectlAsServiceAccount`: impersonates a given ServiceAccount and runs a kubectl command using its token
- `k8sGetResourceAnnotation`: gets an annotation value for the given resource
- `k8sGetServiceExternalHostname`: gets the external hostname created for a given Service
- `k8sGetDeploymentSelector`: gets the pod selector used for a given Deployment
- `k8sGetDeploymentPods`: gets the pods managed by a given Deployment
- `k8sDeploymentHasPods`: checks whether a given Deployment has running pods under management
- `k8sWaitForDeploymentScaleDown`: waits until all pods under management of a given Deployment have scaled down

##### Pipeline

The `k8s-pipeline` helper module adds functionality which helps deploy workloads to K8s clusters, please see [the README](shell/helpers/k8s-pipeline/README.md) for details

Functions:

- `k8sPipeline`: automates Helm operations, enabling simple deployments
- `k9sPipeline`: launches `k9s` preconfigured for the specified environment

#### Kafka

> Requires: `docker`, `python`

Functions:

- `kafkaListTopics`: lists all known topics
- `kafkaReadTopic`: reads from a topic at a certain offset
- `kafkaResetTopics`: resets an MSK cluster's topics by destroying and recreating using terraform
- `kafkacli`: tool to query tx-producer kafka topics

#### Coin Collection

> Requires: `jq`, `psql`, `kubectl`
> Depend on: `k8s`

Functions:

- `ccResetBackendDb`: pauses an `ib-backend`, recreates the db, and unpauses
- `ccCreateTransferDbs`: creates a transfer database for each coin name passed in
- `ccResetCoinTopic`: pauses `tx-producer`, and then resets the MSK cluster's coin-specific topics using terraform
- `ccGetLatestClusterVersion`: finds the latest cluster version by querying S3
- `ccUpgradeEnvironmentClusterVersion`: upgrades an environment's cluster version to either the specified or latest

#### P2P Nodes

> Requires: `node`, `kubectl`
> Depend on: `aws-auth`, `aws-ebs`

Functions:

- `p2pUpdateZCashParams`: ensures existence of an up-to-date EBS snapshot containing the latest ZCash encryption parameter files.
- `p2pCreateZCashParamsVolume`: creates an EBS volume containing the latest ZCash encryption parameter files
- `p2pSnapshotNodeState`: pauses a p2p node, snapshots the EBS volume backing it, and unpauses
- `p2pCloneNodeState`: clones an existing node's state by snapshotting and then creating a volume
- `p2pCloneNodeStateCrossAccount`: clones an existing node's state across accounts by snapshotting, authorizing, copying, and then creating a volume

#### SSH

Functions:

- `sshTunnel`: sets up an SSH tunnel to forward from a local port

#### Terraform

> Requires: `terraform`, `jq`

Functions:

- `tfRun`: runs the specified terraform command in on a particular module
- `tfShowDestroys`: generates a terraform plan and shows destructive actions
- `tfCopyState`: copies the Terraform remote state
- `tfBackupState`: backs up a Terraform remote state file
- `tfRestoreState`: restores a Terraform remote state file backup
- `tfDynamoLockKey`: get a specific TF remote state lock item
- `tfGetLockTableItem`: get a specific TF remote state lock digest
- `tfUpdateLockDigest`: set a specific TF remote state lock digest
- `tfSourceToLocal`: convert a terraform module source to a local path, useful for development
- `tgMigrate`: runs a tfMigrate migration using `terragrunt`
- `tgGetSource`: reads the terragrunt module source
- `tgSourceToLocal`: converts the terragrunt module source to a local path
- `tgSourceToRemote`: converts the terragrunt module source to a github URL
- `tgGoToLocalSource`: navigates to the terragrunt source module locally
- `tgGoToRemoteSource`: opens the terragrunt module source in the browser

#### Network

Functions:

- `checksumUrl`: downloads a file from a url and checksums it

#### Github

Functions:

- `githubOpenDirectory`: opens the current git repository directory in the Github UI

### Contributing

See `CONTRIBUTING.md` for more details about how to contribute.
