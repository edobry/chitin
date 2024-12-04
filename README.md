# chitin

a modular and extensible shell framework inspired by the natural composition of [chitin](https://en.wikipedia.org/wiki/Chitin) — the material forming the shells of many organisms

## Structure

The framework's taxonomy mirrors how chitin builds shells:

- `helper`: individual shell functions
- `chain`: collections of `helpers` focused on specific domains. Chains are composed of interlinked chitin molecules.
- `fiber`: top-level modules grouped by domain. Fibers provide structure by linking `chains` together.
- `module`: general term for for `chains` and `fibers`, used when something is applicable to either

```plain
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

## Setup

1. Clone this repository to your `project dir` (the directory where you usually run `git clone`)
2. Add the following line to your profile (ie `.zshrc` or `.bashrc`), substituting `<project dir>`:

   ```shell
   source <project dir>/chitin/init.sh
   ```

3. Start a new shell session, and follow the instructions to configure `chitin` by running `chiConfigUserModify`

> Note: if you would prefer to not automatically load fibers (such as for performance reasons), set `CHI_AUTOINIT_DISABLED=true`, and use the command `chiShell` when you want to load them on-demand

## Configuration

The framework can be configured at three levels: `user`, `fiber`, and `chain`.

### Special Fields

`*Dir` fields support path expansions:

- `~`: -> `$HOME`
- `localshare` -> `$HOME/.local/share`

### User Configuration

The `user` configuration contains global settings, and allows you to set machine-specific overrides:

- `dotfilesDir`: directory where you store your dotfiles (absolute path)
- `projectDir`: directory you clone git repositories to (absolute path)
- `installToolDeps`: whether any missing tool dependencies should be automatically installed

Modify this config by running `chiConfigUserModify`.

### Module Configuration

Both `fiber` and `chain` configurations support the following fields:

- `enabled`: whether this module should be loaded (default: true)
- `tools`: allows you to declare and configure tools that modules can depend on
  - see [Tool Configuration](#tool-configuration) for details
- `toolDeps`: which tools this module depends on, and should not be loaded without

#### Tool Configuration

Tools can be declared in any module, and then referenced in the `toolDeps` of that module or any depenendent ones, such as a child `chain` or a dependent `fiber` and its `chains`.

Tools can be configured with:

- an [install method](#install-method) (optional)
- a [presence check](#presence-checks)
  - required, unless the tool is set as `optional`.
- a [version check](#version-checks) (optional)

In addition, the following configuration options can be set:

- `optional`: whether this tool should be checked for presence
- `postInstall`: a command to be run after a successful install

##### Install Method

Tools can be automatically installed if `installToolDeps` is set, using the following install methods:

- `brew`: install with [brew](https://brew.sh/); all subfields are optional
  - `name`: can be used to override the tool name
  - `cask`: indicates that the tool is a `brew cask`
  - `tap`: set to the name of a `brew tap` if the formula requires it
  - `tapUrl`: set if the `tap` requires a specific URL
- `git`: install with a `git clone`
  - `url`: the URL of the git repo to clone
  - `target`: the directory to clone the repo into
- `script`: install by fetching and running a `bash` script
- `artifact`: install by fetching an artifact to a certain path
  - `url`: the URL of the artifact to fetch
  - `target`: the directory to fetch the artifact into
  - `appendFilename`: whether to append the last `url` segment to the `target`
- `command`: install by running a given `bash` command

##### Presence Checks

On module load, all tools will be checked for presence on the system, even if they are not explicitly set in `toolDeps`, unless the tool is marked as `optional`.

The following checks can be configured:

- `checkCommand`: check for the presence of an executable in the `PATH` (default)
  - the default check method. if not explicitly set, will use the tool name
  - can be set to `true` to explicitly override one of the other check methods, such as when using the `brew` install method
- `checkBrew`: check with `brew` if its been installed
  - automatically used when the tool is using the `brew` install method with the `cask` option set to `true`
- `checkPath`: check for the presence of the given file
- `checkEval`: run the given command and check the exit code

##### Version Checks

In addition to presence checking, a tool can optionally be configured to require a specific version (or range):

- `version`: the expected [semantic version](https://semver.org/)
  - will validate up to the `minor` version, not checking `patch`
- `versionCommand`: the command with which to get the tool's installed version

### Fiber Configuration

The following fields are unique to `fiber` configurations:

- `fiberDeps`: which `fibers` must be loaded prior to this one
- `chainConfig`: allows you to set overrides for child chains' configuration

Modify this config by running `chiConfigModuleModify <fiber name>`.

### Chain Configuration

`chain` configurations are optional, and are merged with any matching parent `chainConfig` fields, higher-level ones overriding lower.

Modify this config by running `chiConfigModuleModify <fiber name:chain name>`.

## Chains

### Secret

This chain provides a configurable secrets-management interface for other chains to use; it was designed with the [`pass` command](https://www.passwordstore.org/) in mind, but can be used with others, given a compatible CLI.

Configuration:

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

- [konfigure](https://github.com/edobry/konfigure/blob/main/src/shell.ts)
- [edobry/dotfiles](https://github.com/edobry/dotfiles)
