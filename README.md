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

### Network

Functions:

- `checksumUrl`: downloads a file from a url and checksums it

## Contributing

See `CONTRIBUTING.md` for more details about how to contribute.

## Used By

This project is used in the following places:

- [konfigure](https://github.com/edobry/konfigure/blob/main/src/shell.ts), as an environmental dependency
