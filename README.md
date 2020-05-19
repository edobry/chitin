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
you prefer (ie, into your existing configuration, or by copying the file and sourcing)
3. Add `source $PROJECT_DIR/dataeng-tools/shell/init.sh` to your profile, AFTER
the line(s) you added in the previous step
