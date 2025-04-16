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

5. JSON/YAML Utilities:
   - YAML to JSON conversion
   - Configuration validation
   - Path-based access to configuration values

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

- chains/init/5-json.sh
  - `yamlFileToJson`: Converts YAML file to JSON object
  - `jsonRead`: Reads values from JSON objects using jq queries
  - `jsonReadPath`: Reads values at specific paths from JSON objects
  - `jsonMergeDeep`: Performs deep merges of JSON objects
  - `yamlFileSetField`: Updates fields in YAML files

---

## Common Usage Examples

### 1. User Configuration

```bash
# Load user configuration
chiConfigUserLoad

# Read a specific field
projectDir=$(chiConfigUserRead "core" "projectDir")

# Modify user configuration
chiConfigUserModify # Opens editor with the config file
```

### 2. Module Configuration

```bash
# Load module configuration from file
chiConfigModuleMergeFromFile "/path/to/module" "core"

# Read module-specific config
toolConfig=$(chiConfigGetVariableValue "core:tools")

# Read a specific path in config
gitVersion=$(chiModuleConfigReadVariablePath "core:tools" "git" "version")
```

### 3. Tool Configuration

```bash
# Load tool configurations for a module
chiModuleLoadToolConfigs "core:tools"

# Check tool dependencies
if chiModuleCheckToolDepsMet "core:tools"; then
    chiLogInfo "All tool dependencies are met" "core:tools"
fi
```

### 4. JSON/YAML Utilities

```bash
# Convert YAML file to JSON
configJson=$(yamlFileToJson "config.yaml")

# Read a value using jq query
jqValue=$(jsonRead "$configJson" '.tools | keys[]')

# Read a value at a specific path
pathValue=$(jsonReadPath "$configJson" "tools" "git" "version")

# Merge configurations deeply
mergedConfig=$(jsonMergeDeep "$defaultConfig" "$userConfig")

# Update a field in a YAML file
yamlFileSetField "config.yaml" "1.0.0" "version"
```

### 5. Configuration Examples

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

4. JSON/YAML Handling:
   a. Use `yamlFileToJson` to load YAML files into JSON objects
   b. Use `jsonReadPath` to access nested configuration values
   c. Use `jsonMergeDeep` to merge configuration objects
   d. Use `yamlFileSetField` to update configuration files

---

## JSON Processing Flow

The configuration system relies heavily on JSON processing to read, manipulate, and merge configurations:

1. **Loading Configuration**:
   ```bash
   # YAML file is read and converted to JSON
   configJson=$(yamlFileToJson "config.yaml")
   
   # JSON is validated
   validateJson "$configJson"
   ```

2. **Reading Values**:
   ```bash
   # Using jq path lookup
   configValue=$(jsonReadPath "$configJson" "section" "subsection" "key")
   
   # Using jq query
   configValues=$(jsonRead "$configJson" '.section.subsection | keys[]')
   ```

3. **Merging Configurations**:
   ```bash
   # Deep merge preserves nested structure
   mergedConfig=$(jsonMergeDeep "$defaultConfig" "$userConfig")
   ```

4. **Writing Values**:
   ```bash
   # Update a field at a specific path
   updatedConfig=$(jsonRead "$configJson" 'setpath(["section","subsection","key"]; "new-value")')
   
   # Write back to YAML
   echo "$updatedConfig" | prettyYaml > "config.yaml"
   ```

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

4. JSON/YAML Handling:
   - Check for valid JSON/YAML before processing
   - Handle missing keys gracefully
   - Ensure proper type handling (strings vs numbers vs booleans)

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

6. JSON Processing:
   - Use native JavaScript object handling instead of jq
   - Implement type-safe path access
   - Create structured validation tools

---

By understanding these configuration patterns and their practical usage, developers can effectively work with Chitin's configuration system and port it to TypeScript. The examples provided should help junior engineers understand how configurations are managed in practice. 
