# chitin

a modular and extensible shell framework

## Prerequisites

Make sure the following programs are installed on your computer (not every helper requires each one, but you may want to install them all to save time):

Required:

- `jq v1.6` [link](https://github.com/stedolan/jq)
- `nodejs v19.4.0`

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
- `pcregrep`

Linux only:

- `xclip`

## Setup

1. Install the prerequisites for the module(s) you want to use (see docs below)
2. Clone this repository to your `project dir` (the directory where you usually run `git clone`)
3. Add the following line to your profile (ie `.zshrc` or `.bashrc`), substituting `<project dir>`:

   `source <project dir>/chitin/shell/init.sh`

4. Start a new shell session, and follow the instructions to modify the config file at `~/.config/chitin/config.json5` (or equivalent).

> Note: if you would prefer to not automatically load these modules (for performance reasons), set CHI_AUTOINIT_DISABLED=true, and use the command `chiShell` when you want to use them

## Modules

### SSH

Functions:

- `sshTunnel`: sets up an SSH tunnel to forward from a local port

### Secret

This module provides a configurable secrets-management interface for other modules to use; it was designed with the [`pass` command](https://www.passwordstore.org/) in mind, but can be used with others, given a compatible CLI.

#### Configuration

Add a section to your chiConfig with the `command` to use:

```json
{
  "modules": {
    "chiSecret": {
      "command": "pass"
    }
  }
}
```

Functions:

- `chiSecretGet`: retrieves a secret with the given name from the secret store

### Terraform

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

### Network

Functions:

- `checksumUrl`: downloads a file from a url and checksums it

### Github

#### Configuration

This module leverages `chiSecret` for managing the Github PAT; add a section to your chiConfig with the name of the secret to use:

```json
{
  "modules": {
    "github": {
      "secretName": "gh-pat"
    }
  }
}
```

Functions:

- `githubListTeams`: lists all known Github teams
- `githubAppJwt`: generates a JWT for Github authentication for the specified app
- `jwtValidate`: validates the signature of the specified JWT
- `githubAppCreateInstallationToken`: creates an installation token for the given Github app installation
- `githubOpenDirectory`: opens the current git repository directory in the Github UI

## Contributing

See `CONTRIBUTING.md` for more details about how to contribute.

## Used By

This project is used in the following places:

- [konfigure](https://github.com/chainalysis/konfigure/blob/main/src/shell.ts), as an environmental dependency
- as a [JSL building block](https://github.com/chainalysis/jenkins-shared-library/blob/main/vars/withDataengTools.groovy)
- various JSL helpers as a Docker image:
  - [`withNodeBuildEnv`](https://github.com/chainalysis/jenkins-shared-library/blob/aaa7897aee0acac12f8886bd10c34bb405cb1ace/vars/withNodeBuildEnv.groovy#L14)
  - [`k8sPipeline`](https://github.com/chainalysis/jenkins-shared-library#k8spipelinemap-config)
    - used in [dataeng-pipeline CD](https://github.com/chainalysis/dataeng-pipeline/blob/89ee112cf026f39f31da2a1248a40726aca126f6/Jenkinsfile#L13)
  - [`terragruntPipeline`](https://github.com/chainalysis/jenkins-shared-library/blob/main/docs/terraform-functions.md#terragruntpipelinemap-config)
    - used in [dataeng-infra-live CD](https://github.com/chainalysis/dataeng-infra-live/blob/b97ee651a255fcc46faf93fede4e671e0bcc8ae6/Jenkinsfile#L21)
- certain dataeng-charts charts:
  - as an [`initContainer` image](https://github.com/chainalysis/dataeng-charts/blob/db09c6e103f3decb1b6c3189a3034c0a71c3af64/charts/cluster-script/src/main.ts#L50)
  - or in a [`Job` using a helper](https://github.com/chainalysis/dataeng-charts/blob/db09c6e103f3decb1b6c3189a3034c0a71c3af64/charts/coins/bitcoin/templates/job-snapshot.yaml#L24)
