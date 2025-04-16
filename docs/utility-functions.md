# Utility Functions

This document outlines the utility functions in Chitin that don't fit cleanly into other categories but are essential for the framework's operation.

---

## Overview

1. Meta and Debugging:
   - Version and location information
   - Debug output utilities
   - Shell environment inspection

2. Path and File Management:
   - Path expansion and manipulation
   - File extension handling
   - Directory operations

3. String and Array Handling:
   - String manipulation
   - Array operations
   - Character encoding

4. Command and Process Utilities:
   - Command execution
   - Process management
   - Exit code handling

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/core/meta.sh  
  - `chiDebug`: Provides debug information about the environment
  - `chiGetVersion`: Gets the Chitin version
  - `chiGetLocation`: Gets the Chitin installation location
  - `chiCd`: Changes to the Chitin directory
  - `chiCheckVersion`: Checks if Chitin meets a minimum version
  - `chiRegisterCompletion`: Registers a completion directory

- chains/init/2-util.sh
  - String and array manipulation functions
  - Helper functions for common operations
  - General-purpose utility functions

- chains/init/2-util-path.sh  
  - Path manipulation functions
  - Functions for adding/removing from PATH
  - Path expansion and normalization

- chains/init/2-util-color.sh
  - Functions for colorizing terminal output
  - Color escaping and encoding
  - Terminal formatting helpers

---

## Common Usage Examples

### 1. Meta and Debugging

```bash
# Get Chitin version
version=$(chiGetVersion)

# Check if version meets minimum
if ! chiCheckVersion "1.0.0"; then
    echo "Chitin version is too old"
fi

# Get Chitin location
location=$(chiGetLocation)

# Change to Chitin directory
chiCd

# Show debug information
chiDebug
```

### 2. Path and File Management

```bash
# Expand paths with variables
expandedPath=$(chiExpandPath "~/projects")

# Expand specific path segments
expandedPath=$(chiExpandPathSegment "~" "$HOME" "$path")

# Add directories to PATH
chiToolsAddDirToPath "/usr/local/bin"

# Remove directories from PATH
chiToolsRemoveDirFromPath "/old/path"

# Get file extension
extension=$(fileGetExtension "file.txt")

# Strip file extension
basename=$(fileStripExtension "file.txt")
```

### 3. String and Array Handling

These utility functions help with common string and array operations:

```bash
# From chains/init/2-util.sh (examples)

# Random string generation
randomString=$(randomString 10)

# Join array with delimiter
joined=$(joinWith "," "item1" "item2" "item3")

# Split string on character
splitOnChar "a:b:c" ":"

# Convert newlines to characters
result=$(echo -e "a\nb\nc" | newlinesToChar ",")

# Escape special characters
escaped=$(escapeSlashes "/path/to/file")
```

### 4. Color and Formatting

```bash
# Colorize text for terminal output
redText=$(chiColorRed "Error message")
greenText=$(chiColorGreen "Success message")
yellowText=$(chiColorYellow "Warning message")

# Log with color
chiLogError "Something went wrong!" "module"
chiLogGreen "Operation completed successfully!" "module"
```

---

## Meta Module Functionality

The `meta.sh` file contains important functions for system information and debugging:

```bash
function chiCd() {
    cd "$CHI_DIR"
}

function chiGetVersion() {
    pushd $CHI_PROJECT_DIR/chitin > /dev/null
    git describe HEAD --tags
    popd > /dev/null
}

function chiGetLocation() {
    echo $CHI_PROJECT_DIR/chitin
}

function chiGetReleasedVersion() {
    chiGetVersion | cut -d '-' -f 1
}

function chiCheckVersion() {
    requireArg "the minimum version" "$1" || return 1

    local minimumVersion="$1"
    local installedVersion="$(chiGetVersion)"

    if ! checkVersion $minimumVersion $installedVersion; then
        chiLogError "Installed chitin version $installedVersion does not meet minimum of $minimumVersion!" core
        return 1
    fi
}

function chiDebug() {
    chiLogInfo "configuration"
    chiLogInfo "version: $(chiGetVersion)"
    chiConfigUserShow

    chiLogInfo "tool status:"
    chiToolsShowStatus

    chiLogInfo "envvars:"
    chiShowEnvvars
    
    echo
    hr

    chiLogInfo "configuration:" "aws"
    awsShowEnvvars
}
```

---

## Path Utilities

The path utilities provide consistent path handling across different environments:

```bash
function chiExpandPath() {
    requireArg "a path" "$1" || return 1

    local localShare="localshare"
    local xdgHome="xdghome"
    
    local expandedPath="$(chiExpandHome "$(echo $1 | envsubst)")"
    expandedPath="$(chiExpandPathSegmentStart "$xdgHome" "$(xdgHome)" "$expandedPath")"
    expandedPath="$(chiExpandPathSegmentStart "$localShare" "$(xdgData)" "$expandedPath")"

    echo "$expandedPath"
}

function chiExpandHome() {
    requireArg "a path" "$1" || return 1
    
    chiExpandPathSegmentStart "~" "$HOME" "$1"
}

function chiAddToPathVar() {
    requirePathlikeVarArg "$1" || return 1
    requireArg "an existing path" "$2" || return 1

    local currentValue="$(chiReadDynamicVariable "$1")"

    # check if the variable already contains the dir
    [[ ":${currentValue}:" == *":$2:"* ]] && return 0

    export "${1}=:${2}:${currentValue}"
}

function chiRemoveFromPathVar() {
    requirePathlikeVarArg "$1" || return 1
    requireArg "an existing path" "$2" || return 1

    export "${1}=$(showPathVar "$1" | grep -v "$2" | newlinesToChar ':')"
}
```

---

## Color Utilities

The color utilities make terminal output more readable:

```bash
function chiColorEscape() {
    local text="$1"; shift
    local colorCode="$1"; shift
    
    echo -e "\e[${colorCode}m${text}\e[0m"
}

function chiColorRed() {
    local text="$1"; shift
    
    chiColorEscape "$text" "31"
}

function chiColorGreen() {
    local text="$1"; shift
    
    chiColorEscape "$text" "32"
}

function chiColorYellow() {
    local text="$1"; shift
    
    chiColorEscape "$text" "33"
}
```

---

## Implementation Patterns

1. Meta and Debugging:
   a. Use `chiGetVersion` to check version compatibility
   b. Use `chiDebug` to inspect the current state
   c. Use `chiCd` for convenient navigation

2. Path Management:
   a. Use `chiExpandPath` to handle path variables
   b. Use `chiToolsAddDirToPath` for PATH manipulation
   c. Use proper path normalization for cross-platform support

3. String and Array Handling:
   a. Use `joinWith` and `splitOnChar` for data manipulation
   b. Use proper escaping for special characters
   c. Handle platform-specific path separators

4. Error Handling:
   a. Use consistent return codes
   b. Validate all function arguments
   c. Provide helpful error messages

---

## Common Pitfalls

1. Meta and Debugging:
   - Version checking might fail in non-git installations
   - Debug output may be excessive
   - Directory changes might affect subsequent commands

2. Path Management:
   - Path variable formats differ between shells
   - Path expansion might have unexpected results
   - File operations might fail due to permissions

3. String and Array Handling:
   - Arrays are handled differently in Bash and Zsh
   - Special characters might cause issues
   - String manipulation might not be portable

4. Color and Formatting:
   - Colors might not work in all terminals
   - Escape sequences might affect output parsing
   - Color output might interfere with automation

---

## Considerations for TypeScript Port

1. Meta and Debugging:
   - Implement version checking using semver
   - Create structured debug output
   - Provide type-safe navigation utilities

2. Path Management:
   - Use Node.js path module for cross-platform support
   - Implement robust path expansion
   - Handle permissions gracefully

3. String and Array Handling:
   - Use TypeScript's strong typing for data structures
   - Implement platform-agnostic string functions
   - Create utilities for common operations

4. Color and Formatting:
   - Use established libraries for terminal colors
   - Create type-safe logging utilities
   - Support disabling colors for automation

---

By understanding these utility functions and their practical usage, developers can effectively work with Chitin's core functionality and port it to TypeScript. The examples provided should help junior engineers understand how to use these utilities in their own code. 
