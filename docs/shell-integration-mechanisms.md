# Shell Integration Mechanisms

This document explains how Chitin handles shell integration, with practical examples and clear explanations.

---

## Overview

1. Shell Environment Setup:
   - Shell detection and adaptation
   - Environment variable management
   - Path manipulation

2. Command Execution:
   - Command parsing and execution
   - Error handling and logging
   - Exit code management

3. Shell-Specific Features:
   - Shell-specific settings
   - Shell-specific completions
   - Shell-specific error handling

4. Environment Variable Management:
   - Variable setting and retrieval
   - Variable expansion
   - Variable cleanup

5. Shell Completion:
   - Completion registration
   - Completion generation
   - Completion loading

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/init/1-os.sh  
  - `isMacOS`: Detects if running on macOS
  - Various OS-specific utility functions

- chains/init/2-util-path.sh  
  - `chiToolsAddDirToPath`: Adds a path to the PATH
  - `chiToolsRemoveDirFromPath`: Removes a path from the PATH
  - `chiExpandPath`: Expands path variables

- chains/init/2-util-var.sh  
  - `chiSetDynamicVariable`: Sets dynamic variables
  - `chiReadDynamicVariable`: Retrieves dynamic variables
  - `chiShowEnvvars`: Shows environment variables

- chains/init/2-util.zsh
  - ZSH-specific utility functions and overrides

- chains/core/meta.sh
  - `chiRegisterCompletion`: Registers completion directories
  - `chiDebug`: Provides debug information on the current shell
  - `chiGetVersion`: Gets the version of chitin

---

## Common Usage Examples

### 1. Shell Detection

```bash
# Shell detection in init.sh
if [[ -z "$ZSH_VERSION" ]]; then
    # Bash-specific settings
    shopt -s globstar
else
    # Zsh-specific settings
    setopt ksh_glob
    setopt shwordsplit
fi
```

### 2. Path Manipulation

```bash
# Add a directory to PATH
chiToolsAddDirToPath "/usr/local/bin"

# Remove a directory from PATH
chiToolsRemoveDirFromPath "/old/path"

# Expand a path
expandedPath=$(chiExpandPath "~/bin")
```

### 3. Environment Variable Management

```bash
# Set a dynamic variable
chiSetDynamicVariable "value" "PREFIX" "segment1" "segment2"

# Get a dynamic variable
value=$(chiReadDynamicVariable "PREFIX_segment1_segment2")

# Show environment variables
chiShowEnvvars
```

### 4. Shell-Specific Code Examples

#### Bash
```bash
# Bash-specific array handling
declare -a tools=("git" "node" "npm")
for tool in "${tools[@]}"; do
    command -v "$tool" &>/dev/null || echo "$tool not found"
done

# Bash-specific pattern matching
if [[ -z "$ZSH_VERSION" ]]; then
    shopt -s extglob
fi
```

#### Zsh
```zsh
# Zsh-specific array handling
tools=("git" "node" "npm")
for tool in $tools; do
    command -v "$tool" &>/dev/null || echo "$tool not found"
done

# Zsh-specific pattern matching
if [[ -n "$ZSH_VERSION" ]]; then
    setopt extended_glob
fi
```

### 5. ZSH-specific Adaptations

ZSH requires special handling for certain operations compared to Bash. Chitin handles ZSH-specific adaptations in `2-util.zsh`:

```zsh
# ZSH-specific variable expansion handling
# In Bash, ${!varname} expands to the value of the variable named by varname
# In ZSH, ${(P)varname} is used instead

# Example from chiReadDynamicVariable function:
if [[ -z "$ZSH_VERSION" ]]; then
    echo "${!1}"
else
    echo "${(P)1}"
fi
```

Additional ZSH adaptations include:
- Setting ZSH-specific options like `ksh_glob` and `shwordsplit`
- Handling arrays differently in ZSH and Bash
- Loading ZSH-specific script files with .zsh extension

### 6. Shell Completion

Chitin includes a completion system that automatically generates and loads completions for tools:

```bash
# Register a completion directory
function chiRegisterCompletion() {
    requireArg "\$0" "$1" || return 1
    
    # If ZSH's compdef is available, we're done
    checkCommand compdef && return 0
    
    # Otherwise, add the directory to fpath
    local dirName="$([[ -f "$1" ]] && dirname "$1" || echo "$1")"
    export fpath=($dirName $fpath)
}

# Generate completion for a tool
function chiGenerateCompletion() {
    requireArg "a tool name" "$1" || return 1
    requireArg "a tool config JSON string" "$2" || return 1

    # Get the completion command from tool config
    local completionCommand=($(jsonReadPath "$2" completionCommand 2>/dev/null))
    if [[ -n "$completionCommand" ]]; then
        mkdir -p "$CHI_COMPLETION_DIR"
        local completionPath="$CHI_COMPLETION_DIR/_$1"

        if [[ ! -f "$completionPath" ]]; then
            chiLogDebug "generating completion for '$1'..." "meta:tools"
            eval "${completionCommand[@]} $(basename $(echo $SHELL)) > $completionPath"
        fi
    fi
}
```

Completions are:
1. Generated automatically for tools that define a `completionCommand` in their configuration
2. Stored in `$CHI_COMPLETION_DIR` (defaults to `$CHI_SHARE/completions`)
3. Registered with the shell using `chiRegisterCompletion`
4. Lazily loaded to improve startup performance

---

## Implementation Patterns

1. Shell Environment Setup:
   a. Check for shell type using ZSH_VERSION
   b. Set shell-specific options
   c. Use `chiToolsAddDirToPath` to modify the PATH

2. Command Execution:
   a. Use `chiSetDynamicVariable` to set variables
   b. Use `chiReadDynamicVariable` to get variables
   c. Use proper exit code handling

3. Shell-Specific Features:
   a. Use shell-specific conditionals
   b. Set appropriate shell options
   c. Handle array differences between shells

4. Environment Variable Management:
   a. Use `chiSetDynamicVariable` to set variables
   b. Use `chiReadDynamicVariable` to get variables
   c. Use `chiShowEnvvars` to debug environment

5. Shell Completion:
   a. Generate completions using commands from tool configs
   b. Register completion directories with the shell
   c. Lazily generate completions to improve performance

---

## Common Pitfalls

1. Shell Detection:
   - Handle unknown shells gracefully
   - Check shell version compatibility
   - Test shell-specific features

2. Path Manipulation:
   - Avoid duplicate PATH entries
   - Handle PATH separator differences
   - Clean up temporary PATH additions

3. Environment Variables:
   - Handle variable name conflicts
   - Clean up variables when done
   - Handle variable expansion properly

4. Shell-Specific Code:
   - Test code in multiple shells
   - Handle shell feature differences
   - Provide fallbacks for missing features

5. Shell Completion:
   - Handle different completion systems (zsh vs bash)
   - Generate completions only when needed
   - Clean up outdated completions

---

## Considerations for TypeScript Port

1. Shell Detection:
   - Implement shell detection logic
   - Handle shell-specific features
   - Support shell-specific completions

2. Environment Variable Management:
   - Implement variable setting and retrieval
   - Handle variable expansion
   - Support variable cleanup

3. Command Execution:
   - Implement command parsing and execution
   - Handle error handling and logging
   - Support exit code management

4. Shell Integration:
   - Implement shell-specific settings
   - Handle shell-specific completions
   - Support shell-specific error handling

5. ZSH Support:
   - Implement ZSH-specific adaptations
   - Handle ZSH completion system
   - Support ZSH-specific features

---

By understanding these shell integration patterns and their practical usage, developers can effectively work with Chitin's shell integration features and port them to TypeScript. The examples provided should help junior engineers understand how shell integration is implemented in practice. 
