# chitin

a modular and extensible shell framework inspired by the natural composition of [chitin](https://en.wikipedia.org/wiki/Chitin) — the material forming the shells of many organisms

## Structure

The framework's taxonomy mirrors how chitin builds shells:

- `helpers`: Individual shell functions
- `chains`: Collections of helpers focused on specific domains. Chains are composed of interlinked chitin molecules.
- `fibers`: Top-level modules grouped by domain. Fibers provide structure by linking chains together.

```
chitin-core
├── chitin-dev [fiber]
│   ├── docker [chain]
│   │   ├── build_image() [helper]
│   │   ├── run_container() [helper]
│   ├── git [chain]
│       ├── clone_repo() [helper]
│       ├── commit_changes() [helper]
├── chitin-cloud [fiber]
    ├── aws [chain]
    │   ├── launch_instance() [helper]
    │   ├── list_buckets() [helper]
    ├── kubernetes [chain]
        ├── deploy_pod() [helper]
        ├── scale_deployment() [helper]
```

## Dependencies

Required:

- `jq v1.6` [link](https://github.com/stedolan/jq)
- `yq v4.11.2` [link](https://github.com/mikefarah/yq)
  - make sure you install from `brew` and not `pip`

MacOS only:

- `watch`
- `pcregrep`

Linux only:

- `xclip`

## Setup

1. Install the dependencies
2. Clone this repository to your `project dir` (the directory where you usually run `git clone`)
3. Add the following line to your profile (ie `.zshrc` or `.bashrc`), substituting `<project dir>`:

   `source <project dir>/chitin/init.sh`

4. Start a new shell session, and follow the instructions to configure `chitin` by running `chiConfigModify`

> Note: if you would prefer to not automatically load fibers (such as for performance reasons), set `CHI_AUTOINIT_DISABLED=true`, and use the command `chiShell` when you want to load them on-demand

## Chains

### Secret

This chain provides a configurable secrets-management interface for other chains to use; it was designed with the [`pass` command](https://www.passwordstore.org/) in mind, but can be used with others, given a compatible CLI.

#### Configuration

Add a section to your chiConfig with the `command` to use:

```json
{
  "chains": {
    "chiSecret": {
      "command": "pass"
    }
  }
}
```

Functions:

- `chiSecretGet`: retrieves a secret with the given name from the secret store

## Used By

This project is used by:

- [konfigure](https://github.com/edobry/konfigure/blob/main/src/shell.ts), as an environmental dependency
