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

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/init/1-os.sh  
  - `chiOsDetect`: Detects the operating system
  - `chiOsGetName`: Gets the operating system name
  - `chiOsGetVersion`: Gets the operating system version

- chains/init/2-util-path.sh  
  - `chiPathAdd`: Adds a path to the PATH
   - `chiPathRemove`: Removes a path from the PATH
   - `chiPathGet`: Gets the current PATH

- chains/init/2-util-var.sh  
  - `chiVarSet`: Sets an environment variable
   - `chiVarGet`: Gets an environment variable
   - `chiVarUnset`: Unsets an environment variable

- chains/core/meta.sh  
  - `chiMetaGetShell`: Gets the current shell
   - `chiMetaGetShellVersion`: Gets the shell version
   - `chiMetaGetShellFeatures`: Gets the shell features

---

## Common Usage Examples

### 1. Shell Detection

```bash
# Detect the current shell
shell=$(chiMetaGetShell)

# Handle shell-specific features
if [[ "$shell" == "zsh" ]]; then
    # Zsh-specific settings
    setopt ksh_glob
    setopt shwordsplit
elif [[ "$shell" == "bash" ]]; then
    # Bash-specific settings
    shopt -s globstar
fi
```

### 2. Path Manipulation

```bash
# Add a directory to PATH
chiPathAdd "/usr/local/bin"

# Remove a directory from PATH
chiPathRemove "/old/path"

# Get the current PATH
currentPath=$(chiPathGet)
```

### 3. Environment Variable Management

```bash
# Set an environment variable
chiVarSet "CHI_PROJECT_DIR" "/path/to/project"

# Get an environment variable
projectDir=$(chiVarGet "CHI_PROJECT_DIR")

# Unset an environment variable
chiVarUnset "CHI_PROJECT_DIR"
```

### 4. Shell-Specific Code Examples

#### Bash
```bash
# Bash-specific array handling
declare -a tools=("git" "node" "npm")
for tool in "${tools[@]}"; do
    chiToolsCheck "$tool"
done

# Bash-specific pattern matching
if [[ "$CHI_SHELL" == bash* ]]; then
    shopt -s extglob
fi
```

#### Zsh
```zsh
# Zsh-specific array handling
tools=("git" "node" "npm")
for tool in $tools; do
    chiToolsCheck "$tool"
done

# Zsh-specific pattern matching
if [[ "$CHI_SHELL" == zsh* ]]; then
    setopt extended_glob
fi
```

---

## Implementation Patterns

1. Shell Environment Setup:
   a. Use `chiOsDetect` to detect the OS
   b. Use `chiMetaGetShell` to detect the shell
   c. Use `chiPathAdd` to modify the PATH

2. Command Execution:
   a. Use `chiVarSet` to set environment variables
   b. Use `chiVarGet` to get environment variables
   c. Use `chiVarUnset` to unset environment variables

3. Shell-Specific Features:
   a. Use `chiMetaGetShellFeatures` to get shell features
   b. Use `chiMetaGetShellVersion` to get shell version
   c. Use `chiOsGetVersion` to get OS version

4. Environment Variable Management:
   a. Use `chiVarSet` to set variables
   b. Use `chiVarGet` to get variables
   c. Use `chiVarUnset` to unset variables

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

---

By understanding these shell integration patterns and their practical usage, developers can effectively work with Chitin's shell integration features and port them to TypeScript. The examples provided should help junior engineers understand how shell integration is implemented in practice. 
