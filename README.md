### dataeng-tools

This repository contains tools and scripts used by Data Engineering, both
interactively and in scripting. The primary language is currently Bash but this
may change in the future.

#### Prerequisites

Make sure the following programs are installed on your computer:
- jq
- AWS CLI
- terraform
- docker
- kubectl/kubectx
- helm

Linux only:
 - xclip

#### Setup

1. Clone (if you have not already) the `chainalysis/terraform` repository
2. Copy the contents of `chainalysis-env-template.sh` into your profile, however
you prefer (ie, into your existing configuration, or by copying the file and sourcing),
and then set your own values
3. Add `source $PROJECT_DIR/dataeng-tools/shell/init.sh` to your profile, AFTER
the line(s) you added in the previous step

#### Helpers

##### AWS

The AWS helper is designed to reduce friction during development, providing
useful functions for introspecting, and switching between roles, including
automatically re-authenticating if needed. This shell integration is disabled by default, but you can enable it by setting `DE_AWS_AUTH_ENABLED=true` in step 2
of the setup. This is recommended, but not required.

##### K8s

The K8s helper provides useful functions for interacting with clusters and various
associated administrative tasks. To use it, you must ensure that the `dataeng-pipeline`
repository is available in your `$PROJECT_DIR`.
