# Configuration System Details

This document explains how Chitin manages configuration at different levels, with practical examples and clear explanations.

---

## Overview

1. Configuration Levels:
   - User Configuration: Global settings and machine-specific overrides
   - Fiber Configuration: Top-level module settings and child chain defaults
   - Chain Configuration: Individual chain settings and tool configurations

2. Configuration Files:
   - `userConfig.yaml`: User-specific settings and overrides
   - `config.yaml`: Module-specific configurations
   - Tool configurations: Declared within module configs

3. Configuration Merging:
   - User config overrides module defaults
   - Fiber config provides defaults for chains
   - Chain config can override fiber settings

4. Special Fields:
   - `*Dir` fields support path expansions
   - Tool configurations include installation methods and checks

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/core/config-user.sh  
  - `chiConfigUserLoad`: Loads and initializes user configuration
  - `chiConfigUserModify`: Allows user to edit their configuration
  - `chiConfigUserRead`: Reads specific fields from user config

- chains/core/config.sh  
  - `chiConfigModuleMergeFromFile`: Merges module config with defaults
  - `chiConfigChainMerge`: Merges chain config with fiber defaults
  - `chiConfigGetVariableValue`: Retrieves module-specific config

- chains/core/module-deps.sh  
  - `chiModuleLoadToolConfigs`: Loads tool configurations from module config
  - `chiModuleCheckToolDepsMet`: Verifies tool dependencies are met

---

## Common Usage Examples

### 1. User Configuration

```bash
# Load user configuration
chiConfigUserLoad

# Read a specific field
projectDir=$(chiConfigUserRead "core" "projectDir")

# Modify user configuration
chiConfigUserModify "core.projectDir" "/new/path"
```

### 2. Module Configuration

```bash
# Load module configuration
chiConfigModuleMergeFromFile "core" "/path/to/config.yaml"

# Read module-specific config
toolVersion=$(chiConfigGetVariableValue "core:tools" "version")

# Merge chain configuration
chiConfigChainMerge "core" "tools"
```

### 3. Tool Configuration

```bash
# Load tool configurations
chiModuleLoadToolConfigs "core:tools"

# Check tool dependencies
if chiModuleCheckToolDepsMet "core:tools"; then
    chiLogInfo "All tool dependencies are met"
fi
```

### 4. Configuration Examples

#### User Config (userConfig.yaml)
```yaml
core:
  projectDir: ~/projects
  enabled: true
tools:
  git:
    version: 2.30.0
    autoInstall: true
```

#### Module Config (config.yaml)
```yaml
core:
  tools:
    git:
      version: 2.30.0
      checkCommand: git --version
      versionCommand: git --version | cut -d' ' -f3
```

#### Merged Config
```yaml
core:
  projectDir: ~/projects
  enabled: true
  tools:
    git:
      version: 2.30.0
      checkCommand: git --version
      versionCommand: git --version | cut -d' ' -f3
      autoInstall: true
```

---

## Implementation Patterns

1. User Configuration:
   a. Use `chiConfigUserLoad` to load user config
   b. Use `chiConfigUserModify` to edit user config
   c. Use `chiConfigUserRead` to read user config fields

2. Module Configuration:
   a. Use `chiConfigModuleMergeFromFile` to merge module config
   b. Use `chiConfigChainMerge` to merge chain config
   c. Use `chiConfigGetVariableValue` to retrieve config values

3. Tool Configuration:
   a. Use `chiModuleLoadToolConfigs` to load tool configs
   b. Use `chiModuleCheckToolDepsMet` to verify tool deps
   c. Use `chiConfigGetVariableValue` to retrieve tool configs

---

## Common Pitfalls

1. User Configuration:
   - Always check if config exists before reading
   - Handle path expansions properly
   - Validate user input

2. Module Configuration:
   - Handle missing config files gracefully
   - Validate config structure
   - Handle merge conflicts

3. Tool Configuration:
   - Check tool dependencies before loading
   - Handle tool version mismatches
   - Validate tool configurations

---

## Considerations for TypeScript Port

1. Configuration Types:
   - Define TypeScript interfaces for each config level
   - Provide type-safe access to configuration values

2. Configuration Loading:
   - Implement YAML parsing with proper error handling
   - Support configuration file watching for live updates

3. Path Expansion:
   - Create a robust path expansion system
   - Handle platform-specific path separators

4. Configuration Validation:
   - Implement schema validation for config files
   - Provide clear error messages for invalid configs

5. Configuration Merging:
   - Create a type-safe deep merge implementation
   - Handle conflicts between different config levels

---

By understanding these configuration patterns and their practical usage, developers can effectively work with Chitin's configuration system and port it to TypeScript. The examples provided should help junior engineers understand how configurations are managed in practice. 
