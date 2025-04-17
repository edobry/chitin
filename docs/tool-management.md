# Tool Management

This document explains how Chitin manages tool dependencies, with practical examples and clear explanations.

---

## Overview

1. Tool Configuration:
   - Tool dependency declarations
   - Version requirements
   - Installation methods

2. Tool Status Management:
   - Tool presence checking
   - Version validation
   - Status caching

3. Tool Installation:
   - Automatic installation of missing tools
   - Multiple installation methods
   - Post-installation configuration

4. Tool Environment Integration:
   - PATH management
   - Environment variable setup
   - Shell completion generation

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/core/tools.sh
  - `chiToolsGetConfig`: Gets a tool's configuration
  - `chiToolsGetStatus`: Gets a tool's installation status
  - `chiToolsCheckStatus`: Checks a tool's installation and version status
  - `chiToolsLoad`: Loads tool configurations and prepares environment
  - `chiToolsLoadFromCache`: Loads tool status from cache
  - `chiToolsUpdateStatus`: Updates tool status cache
  - `chiToolsShowStatus`: Displays status of all tools

- chains/core/tools-install.sh
  - `chiToolsInstallBrew`: Installs tools using Homebrew
  - `chiToolsInstallGit`: Installs tools using Git
  - `chiToolsInstallScript`: Installs tools using a script
  - `chiToolsInstallArtifact`: Installs tools by downloading artifacts
  - `chiToolsInstallCommand`: Installs tools using custom commands

- chains/init/4-tools.sh
  - `chiToolsInstallTemporary`: Installs tools temporarily
  - `chiToolsInstallFromUrl`: Downloads and installs tools from URLs
  - `chiToolsInstallExecutableFromUrl`: Installs executable tools from URLs

- chains/core/module-deps.sh
  - `chiModuleLoadToolConfigs`: Loads tool configurations for a module
  - `chiModuleCheckToolDepsMet`: Checks if tool dependencies are met
  - `chiModuleInstallTools`: Installs missing tool dependencies

---

## Common Usage Examples

### 1. Tool Configuration

Tool configurations are defined in module configurations:

```yaml
# config.yaml
tools:
  jq:
    version: 1.6
    versionCommand: jq --version | awk -F '-' '{ print $2 }'
    checkBrew: true
    brew: true
  yq:
    version: 4.44.3
    versionCommand: yq --version 2>&1 | awk '{ print $4 }' | sed 's/v//'
    checkBrew: true
    brew: true
  pipx:
    brew: true
    postInstall: pipx ensurepath

toolDeps:
  - jq
  - yq
  - pipx
```

### 2. Tool Status Management

```bash
# Check status of all tools
chiToolsShowStatus

# Load tool status from cache
chiToolsLoadFromCache

# Check a tool's status
if ! chiToolsCheckStatus "jq" "$(chiToolsGetConfig "jq")"; then
    chiLogInfo "jq is not installed or has wrong version" "core"
fi

# Update status cache after changes
chiToolsUpdateStatus
```

### 3. Tool Installation

```bash
# Check if tool dependencies are met
if ! chiModuleCheckToolDepsMet "core:tools"; then
    chiLogInfo "Not all tool dependencies are met" "core:tools"
fi

# Install missing tools
chiModuleInstallTools "core:tools" "jq" "yq"

# Install a tool temporarily during bootstrap
chiToolsInstallTemporary "jq" "1.6" "https://example.com/jq-1.6"
```

### 4. Tool Environment Integration

```bash
# Load tools for a module (adds to PATH, sets env vars)
chiToolsLoad "core:tools"

# Generate completion for a tool
chiGenerateCompletion "tool-name" "$(chiToolsGetConfig "tool-name")"
```

---

## Tool Configuration Options

Chitin supports several methods for checking and installing tools:

### 1. Check Methods

```yaml
# Use command line checking
tool:
  checkCommand: tool --version

# Check if a brew package is installed
tool:
  checkBrew: true

# Check if a file exists at path
tool:
  checkPath: bin/executable

# Check using a custom command
tool:
  checkEval: command -v tool > /dev/null
```

#### Default Check Behavior

When no check method is specified, Chitin checks for tool existence:

- **Shell Implementation**: By default, if no check method is specified, Chitin will fall back to using `command -v <toolname>` (via the `checkCommand` function) to check if the tool exists in the PATH.

- **TypeScript Implementation (Synthase)**: If no check method is specified and the tool is not marked as optional, Synthase will also use `command -v <toolname>` as the default check command, maintaining full compatibility with the original Chitin implementation.

This consistent behavior across implementations ensures that tool validation works the same way regardless of which implementation is used.

### 2. Installation Methods

```yaml
# Install with Homebrew
tool:
  brew: true
  # or with more options
  brew:
    name: package-name  # if different from tool name
    cask: true          # if it's a cask
    tap: username/repo  # if from a tap
    tapUrl: git@github.com:username/repo.git  # if tap requires URL

# Install from Git
tool:
  git:
    url: https://github.com/user/repo.git
    target: ~/tools/repo

# Install from script
tool:
  script: https://example.com/install-script.sh

# Install from URL
tool:
  artifact:
    url: https://example.com/tool.tar.gz
    target: ~/tools/bin
    appendFilename: true
    isExec: true  # if executable

# Install with custom command
tool:
  command: curl -s https://example.com/install.sh | bash
```

### 3. Version Management

```yaml
# Specify version and command to check it
tool:
  version: 1.6
  versionCommand: tool --version | cut -d' ' -f2
```

### 4. Post-Installation and Environment

```yaml
# Run a command after installation
tool:
  postInstall: tool setup

# Set environment variables
tool:
  setEnv:
    TOOL_HOME: target
    TOOL_CONFIG: ~/config/tool

# Add directories to PATH
tool:
  addToPath:
    - bin
    - ~/tools/bin

# Source a script
tool:
  sourceScript: completion.sh

# Run a command and eval the output
tool:
  evalCommand: tool init
```

---

## Implementation Details

### 1. Tool Status Caching

Tool status is cached to improve performance:

```bash
export CHI_CACHE_TOOLS="$CHI_CACHE/tool-status.json"

function chiToolsLoadFromCache() {
    [[ ! -f "$CHI_CACHE_TOOLS" ]] && return 1
    [[ -n "$CHI_TOOL_STATUS" ]] && return 0

    export CHI_TOOL_STATUS="$(cat "$CHI_CACHE_TOOLS")"
}

function chiToolsUpdateStatus() {
    requireArg "at least one tool status JSON string" "$1" || return 1
    local toolStatus=("$@")

    export CHI_TOOL_STATUS="$(jsonMerge "${CHI_TOOL_STATUS:-"{}"}" $toolStatus "{}")"
    
    mkdir -p "$CHI_CACHE"
    echo "$CHI_TOOL_STATUS" > "$CHI_CACHE_TOOLS"
}
```

### 2. Tool Status Checking

Tools are checked for both presence and correct version:

```bash
function chiToolsCheckStatus() {
    requireArg "a tool name" "$1" || return 1
    requireJsonArg "a tool config" "$2" || return 1

    local toolName="$1"
    local toolConfig="$2"

    local moduleName="$(jsonReadPath "$toolConfig" meta definedIn)"
    
    local expectedVersion="$(jsonReadPath "$toolConfig" version)"
    local versionCommand="$(jsonReadPath "$toolConfig" versionCommand)"

    local installed="false"
    local validVersion="false"

    chiLogDebug "checking status for '$toolName'..." "meta:tools"

    if chiToolsCheckInstalled "$toolName" "$toolConfig"; then
        if [[ -z "$versionCommand" ]]; then
            installed="true"
            validVersion="true"
        elif [[ -z "$expectedVersion" ]]; then
            chiLogInfo "expected version not set for $toolName!" "$moduleName"
            installed="true"
        else
            local currentVersion="$(eval "$versionCommand")"
            
            if checkVersionAndFail "$toolName" "$expectedVersion" "$currentVersion"; then
                installed="true"
                validVersion="true"
            else
                installed="true"
            fi
        fi
    fi

    chiToolsMakeStatus "$toolName" "$installed" "$validVersion"
}
```

### 3. Tool Loading

When a tool is loaded, it can modify the environment:

```bash
function chiToolsLoad() {
    requireArg "a module name" "$1" || return 1

    local moduleName="$1"; shift

    chiLogDebug "loading tools..." "$moduleName"

    local tools
    
    if [[ $# -gt 0 ]]; then
        tools="$*"
    else
        tools="$(chiModuleGetDynamicVariable "$CHI_MODULE_TOOLS_PREFIX" "$moduleName")"
        
        [[ -z "$tools" ]] && return 0
    fi

    echo "$tools" | jq -c 'select(
        (.value | to_entries | map(.key)) as $actualKeys
        | $ARGS.positional | any(. as $k | $actualKeys | index($k))
    )' --args \
        $CHI_META_TOOLS_CONFIG_ARTIFACT_KEY \
        $CHI_META_TOOLS_CONFIG_GIT_KEY \
        $CHI_META_TOOLS_CONFIG_ADDTOPATH_KEY \
        $CHI_META_TOOLS_CONFIG_SOURCESCRIPT_KEY \
        $CHI_META_TOOLS_CONFIG_EVALCOMMAND_KEY |\
    while read -r toolEntry; do
        local toolName="$(jsonReadPath "$toolEntry" key)"
        local toolConfig="$(jsonReadPath "$toolEntry" value)"

        chiLogDebug "loading tool '$toolName'..." "$moduleName"

        # Set environment, add to PATH, source scripts, etc.
        # ...
    done

    chiLogDebug "tools loaded" "$moduleName"
}
```

---

## Common Pitfalls

1. Tool Configuration:
   - Be careful with tool names and versions
   - Ensure version commands work correctly
   - Test installation methods before deploying

2. Tool Status Management:
   - Cache may become stale if tools are installed manually
   - Version checking depends on consistent version formats
   - Tool status is cached at the environment level, not globally

3. Tool Installation:
   - Some installation methods may require internet access
   - Installation may fail due to permission issues
   - Post-installation steps might need specific environment

4. Tool Environment Integration:
   - PATH modifications are session-specific
   - Environment variables set by tools may conflict
   - Sourced scripts might assume specific shell features

---

## Considerations for TypeScript Port

1. Tool Configuration:
   - Create TypeScript interfaces for tool configuration
   - Implement validators for configuration schema
   - Support multiple installation methods

2. Tool Status Management:
   - Use persistent cache with proper validation
   - Implement async status checking
   - Support cancellation of long-running checks

3. Tool Installation:
   - Use Node.js child_process for installation
   - Implement progress reporting for long installations
   - Handle permissions gracefully

4. Tool Environment Integration:
   - Manage PATH modifications cross-platform
   - Handle environment variables consistently
   - Support shell-specific integrations

---

By understanding these tool management patterns and their practical usage, developers can effectively work with Chitin's tool management system and port it to TypeScript. The examples provided should help junior engineers understand how tools are configured, checked, installed, and integrated into the shell environment. 
