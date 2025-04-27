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

4. Argument Validation:
   - Function parameter validation
   - Type checking and enforcement
   - Path and file validation

5. Module Naming Conventions:
   - Hierarchical module naming
   - Variable namespacing
   - State tracking through dynamic variables

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/init/2-util-var.sh  
  - `chiSetDynamicVariable`: Sets dynamic variables
  - `chiReadDynamicVariable`: Retrieves dynamic variables
  - `chiMakeDynamicVariableName`: Creates dynamic variable names

- chains/core/module.sh  
  - `chiFiberLoad`: Loads a fiber module
  - `chiChainLoad`: Loads a chain module
  - `chiShellReload`: Reloads specified modules

- chains/init/3-log.sh  
  - `chiLogError`: Logs error messages
  - `chiBail`: Handles fatal errors
  - `chiLogInfo`: Logs informational messages

- chains/init/2-util-require.sh
  - `requireArg`: Validates that a required argument is provided
  - `requireDirectoryArg`: Validates that a path exists and is a directory
  - `requireFileArg`: Validates that a path exists and is a file
  - `requireArgOptions`: Validates that an argument matches one of the provided options

---

## Common Usage Examples

### 1. Dynamic Variable Management

```bash
# Setting a dynamic variable
chiSetDynamicVariable "value" "PREFIX" "segment1" "segment2"

# Getting a dynamic variable
value=$(chiReadDynamicVariable "PREFIX_segment1_segment2")

# Creating a dynamic variable name
varName=$(chiMakeDynamicVariableName "PREFIX" "segment1" "segment2")
```

### 2. Module State Management

```bash
# Loading a fiber module
chiFiberLoad "core"

# Loading a chain within a fiber
chiChainLoad "core" "tools"

# Checking if a module is loaded
if [[ -n "$(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "core:tools")" ]]; then
    chiLogInfo "Tools module is loaded" "core"
fi
```

### 3. Error Handling

```bash
# Logging an error
chiLogError "Failed to load module" "core"

# Handling a fatal error
if ! command -v git &> /dev/null; then
    chiBail "Git is required but not installed"
fi

# Logging information
chiLogInfo "Module loaded successfully" "core"
```

### 4. Argument Validation

```bash
# Validate a required argument is provided
function myFunction() {
    requireArg "a configuration file" "$1" || return 1
    
    # Function implementation
}

# Validate a path exists and is a directory
function loadConfigFromDir() {
    requireDirectoryArg "configuration directory" "$1" || return 1
    
    # Function implementation
}

# Validate a path exists and is a file
function loadConfigFromFile() {
    requireFileArg "configuration file" "$1" || return 1
    
    # Function implementation
}

# Validate an argument matches one of the provided options
function setLogLevel() {
    requireArgOptions "a log level" "$1" INFO DEBUG TRACE || return 1
    
    # Function implementation
}
```

### 5. Module Naming and Namespacing

```bash
# Export module name prefix
export CHI_MODULE_PREFIX="CHI_MODULE"
export CHI_MODULE_PATH_PREFIX="${CHI_MODULE_PREFIX}_PATH"
export CHI_MODULE_TOOLS_PREFIX="${CHI_MODULE_PREFIX}_TOOLS"
export CHI_MODULE_LOADED_PREFIX="${CHI_MODULE_PREFIX}_LOADED"

# Creating a namespaced variable for a module
chiSetDynamicVariable "$fiberName" "$CHI_MODULE_NAME_PREFIX" "$fiberName"

# Creating a namespaced variable for a chain
chiSetDynamicVariable "$moduleName" "$CHI_MODULE_NAME_PREFIX" "$fiberName" "$chainName"

# Marking a module as loaded
chiSetDynamicVariable true "$CHI_MODULE_LOADED_PREFIX" "$moduleName"

# Checking if a module is loaded
if [[ -n $(chiModuleGetDynamicVariable "$CHI_MODULE_LOADED_PREFIX" "$moduleName") ]]; then
    # Module is loaded
fi
```

---

## Implementation Patterns

1. Variable Management:
   a. Use `chiSetDynamicVariable` for setting variables
   b. Use `chiReadDynamicVariable` for retrieving variables
   c. Use `chiMakeDynamicVariableName` for creating variable names

2. Module Management:
   a. Use `chiFiberLoad` for loading fibers
   b. Use `chiChainLoad` for loading chains
   c. Use `chiShellReload` for reloading modules

3. Error Handling:
   a. Use `chiLogError` for non-fatal errors
   b. Use `chiBail` for fatal errors
   c. Use `chiLogInfo` for informational messages

4. Argument Validation:
   a. Use `requireArg` for basic argument validation
   b. Use specialized validators like `requireDirectoryArg` for type-specific validation
   c. Use early returns to fail fast when arguments are invalid

5. Module Naming:
   a. Use hierarchical naming with fiber and chain components
   b. Use prefixes to separate variable namespaces
   c. Use dynamic variable names to track module state

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

4. Argument Validation:
   - Always validate function arguments to fail fast
   - Use helpful error messages that explain what was expected
   - Keep validation consistent across all functions

5. Module Naming:
   - Be consistent with naming conventions
   - Avoid name collisions between modules
   - Use namespacing to isolate module variables

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

4. Argument Validation:
   - Use TypeScript's type system for parameter validation
   - Implement runtime checks where needed
   - Create reusable validation functions

5. Module Naming:
   - Design a hierarchical class/namespace structure
   - Use TypeScript modules for isolation
   - Implement state tracking with proper scoping

---

By understanding these patterns and their practical usage, developers can effectively work with Chitin's Bash implementation and port it to TypeScript. The examples provided should help junior engineers understand how these patterns are used in practice. 
