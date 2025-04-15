# Bash Script Patterns

This document outlines the core Bash script patterns used in Chitin, with practical examples and clear explanations.

---

## Overview

1. Dynamic Variable Management:
   - Environment variable handling
   - Path manipulation
   - Configuration variable expansion

2. Module State Management:
   - Module loading and unloading
   - State tracking
   - Dependency management

3. Error Handling:
   - Error logging
   - Error recovery
   - Exit code management

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/init/2-util-var.sh  
  - `chiVarSet`: Sets environment variables
  - `chiVarGet`: Retrieves environment variables
  - `chiVarUnset`: Removes environment variables

- chains/core/module.sh  
  - `chiFiberLoad`: Loads a fiber module
  - `chiChainLoad`: Loads a chain module
  - `chiModuleUnload`: Unloads a module

- chains/init/3-log.sh  
  - `chiLogError`: Logs error messages
  - `chiBail`: Handles fatal errors
  - `chiLogInfo`: Logs informational messages

---

## Common Usage Examples

### 1. Dynamic Variable Management

```bash
# Setting a variable
chiVarSet "CHI_PROJECT_DIR" "/path/to/project"

# Getting a variable
projectDir=$(chiVarGet "CHI_PROJECT_DIR")

# Using variables in path manipulation
chiPathAdd "$(chiVarGet "CHI_PROJECT_DIR")/bin"
```

### 2. Module State Management

```bash
# Loading a fiber module
chiFiberLoad "core"

# Loading a chain within a fiber
chiChainLoad "core" "tools"

# Checking if a module is loaded
if chiModuleIsLoaded "core:tools"; then
    chiLogInfo "Tools module is loaded"
fi
```

### 3. Error Handling

```bash
# Logging an error
chiLogError "Failed to load module" "core"

# Handling a fatal error
if ! chiToolsCheck "git"; then
    chiBail "Git is required but not installed"
fi

# Logging information
chiLogInfo "Module loaded successfully" "core"
```

---

## Implementation Patterns

1. Variable Management:
   a. Use `chiVarSet` for setting variables
   b. Use `chiVarGet` for retrieving variables
   c. Use `chiVarUnset` for removing variables

2. Module Management:
   a. Use `chiFiberLoad` for loading fibers
   b. Use `chiChainLoad` for loading chains
   c. Use `chiModuleUnload` for unloading modules

3. Error Handling:
   a. Use `chiLogError` for non-fatal errors
   b. Use `chiBail` for fatal errors
   c. Use `chiLogInfo` for informational messages

---

## Common Pitfalls

1. Variable Management:
   - Always check if a variable exists before using it
   - Use proper quoting when setting variables
   - Clean up variables when they're no longer needed

2. Module Management:
   - Check dependencies before loading modules
   - Handle module loading failures gracefully
   - Clean up resources when unloading modules

3. Error Handling:
   - Use appropriate log levels for different situations
   - Provide clear error messages
   - Handle errors at the appropriate level

---

## Considerations for TypeScript Port

1. Variable Management:
   - Implement environment variable handling
   - Support path manipulation
   - Handle configuration variable expansion

2. Module Management:
   - Implement module loading and unloading
   - Support state tracking
   - Handle dependency management

3. Error Handling:
   - Implement error logging
   - Support error recovery
   - Handle exit code management

---

By understanding these patterns and their practical usage, developers can effectively work with Chitin's Bash implementation and port it to TypeScript. The examples provided should help junior engineers understand how these patterns are used in practice. 
