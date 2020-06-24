## dataeng-tools

This repository contains tools and scripts used by Data Engineering, both
interactively and in scripting. The primary language is currently Bash but this
may change in the future.

### Prerequisites

Make sure the following programs are installed on your computer (not every helper
requires each one, but you may want to install them all to save time):
- `jq v1.6` [link](https://github.com/stedolan/jq)
- `yq v3.3.0` [link](https://github.com/mikefarah/yq)
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
automatically re-authenticating if needed. This shell integration is disabled by default, but you can enable it by setting `DE_AWS_AUTH_ENABLED=true` in step 2
of the setup. This is recommended, but not required.

Notable functions:
 - `awsId`: scriptable alias for `aws sts get-caller-identity`
 - `awsRole`: gets your currently-assumed IAM role

If you enable the shell integration, you can use the following aliases to assume roles:
 - `aws-dataeng-dev`
 - `aws-dataeng-prod`

##### EBS

Notable functions:
- `watchVolumeModificationProgress`: watches an EBS volume currently being modified and reports progress
- `checkAZ`: checks whether an availability zone with the given name exists
- `findSnapshot`: finds the id of an EBS snapshot with the given name
- `createVolume`: creates an EBS volume with the given name, either empty or from a snapshot
- `findVolumesByName`: finds the ids of the EBS volumes with the given name
- `resizeVolume`: resizes the EBS volume with the given name
- `deleteVolume`: deletes the EBS volumes with the given name

##### SSM

Notable functions:
 - `getSecureParam`: fetches and decrypts an SSM parameter

#### K8s

> Requires: `kubectl`, `yq`, `jq`, `fzf` (optional)

The K8s helper provides useful functions for interacting with clusters and various
associated administrative tasks.

Notable functions:
 - `debugPod`: launches a debug pod in the cluster preloaded with common networking tools, drops you into its shell when created
 - `downDeploy/upDeploy/reDeploy`: stop/start/restart a deployment
 - `secretEncode`: base64-encodes a string for use in a Secret
 - `rds`: connects to an rds instance from the service name
 - `getServiceExternalUrl`: fetches the external url, with port, for a Service with a load balancer configured

#### Kafka

> Requires: `docker`, `python`

Notable functions:
- `listTopics`: lists all known topics
- `readTopic`: reads from a topic at a certain offset
- `readTopic`: reads from a topic at a certain offset
- `readKafkaBlock`: reads protobuf encoded blocks

#### Coin Collection

> Requires: `jq`, `psql`, `kubectl`
> Depend on: `k8s`

Notable functions:

- `resetBackendDb`: pauses an ib-backend, recreates the db, and unpauses
- `createTransferDbs`: creates a transfer database for each coin name passed in
