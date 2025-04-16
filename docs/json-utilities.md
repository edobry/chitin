# JSON Utilities

This document explains Chitin's extensive JSON processing capabilities, which form the foundation of its configuration system.

---

## Overview

1. JSON/YAML Conversion:
   - YAML to JSON transformation
   - JSON to YAML transformation
   - Support for multiple file formats

2. JSON Data Access:
   - Path-based access to JSON values
   - jq query support
   - Handling missing values gracefully

3. JSON Manipulation:
   - Basic and deep merging
   - Array handling
   - Setting values at specific paths

4. Type Validation and Handling:
   - JSON validation
   - Type checking
   - Boolean operations

5. JSON State Management:
   - Temporary file handling
   - Error recovery
   - Format detection

---

## Key Scripts and Functions

Below is an overview of the relevant scripts and functions:

- chains/init/5-json.sh
  - **Conversion Functions**:
    - `yamlFileToJson`: Converts YAML file to JSON
    - `yamlToJson`: Converts YAML content to JSON
    - `jsonToYamlConvert`: Converts JSON file to YAML file
    - `prettyJson`: Pretty-prints JSON
    - `prettyYaml`: Pretty-prints YAML
  
  - **Data Access Functions**:
    - `jsonRead`: Reads JSON using jq queries
    - `jsonReadPath`: Reads values at specific paths in JSON
    - `jsonReadFilePath`: Reads values at specific paths in JSON files
    - `yamlReadFilePath`: Reads values at specific paths in YAML files
  
  - **Manipulation Functions**:
    - `jsonMerge`: Merges JSON objects
    - `jsonMergeDeep`: Deep merges JSON objects
    - `jsonMergeArraysDeep`: Deep merges JSON arrays
    - `yamlFileSetField`: Sets a field in a YAML file
    - `yamlFileSetFieldWrite`: Sets a field and writes to a YAML file
  
  - **Validation Functions**:
    - `validateJson`: Validates JSON string
    - `validateJsonFile`: Validates JSON file
    - `jsonValidateFields`: Validates presence of fields
    - `jsonCheckBool`: Checks boolean values
    - `jsonCheckBoolPath`: Checks boolean values at a specific path

---

## Common Usage Examples

### 1. JSON/YAML Conversion

```bash
# Convert YAML file to JSON
jsonData=$(yamlFileToJson "config.yaml")

# Convert JSON file to YAML file
yamlFile=$(jsonToYamlConvert "data.json")

# Pretty-print JSON
echo '{"key":"value"}' | prettyJson

# Pretty-print YAML
echo 'key: value' | prettyYaml
```

### 2. JSON Data Access

```bash
# Read value using jq query
toolNames=$(jsonRead "$configJson" '.tools | keys[]')

# Read value at specific path
gitVersion=$(jsonReadPath "$configJson" "tools" "git" "version")

# Read value from JSON file at path
fileGitVersion=$(jsonReadFilePath "config.json" "tools" "git" "version")

# Read value from YAML file at path
yamlGitVersion=$(yamlReadFilePath "config.yaml" "tools" "git" "version")
```

### 3. JSON Manipulation

```bash
# Merge JSON objects
merged=$(jsonMerge '{"a":1}' '{"b":2}')

# Deep merge JSON objects
deepMerged=$(jsonMergeDeep '{"a":{"x":1}}' '{"a":{"y":2}}')

# Set field in YAML file (returns new YAML content)
updatedYaml=$(yamlFileSetField "config.yaml" "2.0.0" "version")

# Set field in YAML file and write back
yamlFileSetFieldWrite "config.yaml" "2.0.0" "version"
```

### 4. JSON Validation

```bash
# Validate JSON string
if validateJson '{"valid":true}'; then
    echo "Valid JSON"
fi

# Validate JSON file
if validateJsonFile "config.json"; then
    echo "Valid JSON file"
fi

# Validate fields exist
if jsonValidateFields '{"tools":{"git":{}}}' "tools" "git"; then
    echo "Fields exist"
fi

# Check boolean value
if jsonCheckBool '{"enabled":true}' "enabled"; then
    echo "Feature is enabled"
fi
```

### 5. Advanced JSON Examples

```bash
# Convert JSON5 to standard JSON
standardJson=$(json5Convert "config.json5")

# Create a JSON array from command arguments
jsonArray=$(jsonMakeArray "item1" "item2" "item3")

# Convert an item to a key-value entry
entry=$(jsonToEntry "toolName" '{"version":"1.0.0"}')

# Parse a stream of JSON data
cat "data.json" | jsonParseStream
```

---

## Implementation Patterns

1. JSON/YAML Conversion:
   a. Use `yamlFileToJson` to read configuration files
   b. Use `prettyYaml` to write human-readable output
   c. Use `jsonToYamlConvert` for format conversion

2. JSON Data Access:
   a. Use `jsonReadPath` for simple path-based access
   b. Use `jsonRead` for complex jq queries
   c. Use error handling to deal with missing values

3. JSON Manipulation:
   a. Use `jsonMergeDeep` to combine configuration objects
   b. Use `yamlFileSetField` to update configuration files
   c. Use `jsonMakeArray` to create arrays from function arguments

4. JSON Validation:
   a. Use `validateJson` before processing JSON data
   b. Use `jsonValidateFields` to ensure required fields exist
   c. Use `jsonCheckBool` for feature flags and boolean options

---

## Implementation Details

### Bootstrapping the JSON System

The JSON utilities require `jq` and `yq` to function. Chitin includes a bootstrap process to ensure these tools are available:

```bash
function chiJsonInstallJqTemporary() {
    local jqVersion="1.7.1"
    local jqUrl="https://github.com/jqlang/jq/releases/download/jq-{{version}}/jq-macos-arm64"
    
    chiJsonInstallTemporary "jq" "$jqVersion" "$jqUrl"
}

function chiJsonInstallYqTemporary() {
    local yqVersion="4.44.3"
    local yqUrl="https://github.com/mikefarah/yq/releases/download/v{{version}}/yq_darwin_arm64"

    chiJsonInstallTemporary "yq" "$yqVersion" "$yqUrl"
}

function chiJsonInitBootstrapDeps() {
    # we need jq and yq to bootstrap
    if ! checkCommand jq; then
        chiLogInfo "dep 'jq' missing!" init json
        chiJsonInstallJqTemporary
    fi
    
    if ! checkCommand yq; then
        chiLogInfo "dep 'yq' missing!" init json
        chiJsonInstallYqTemporary
    fi
}
```

### Error Handling

The JSON utilities include robust error handling:

```bash
function jsonReadPath() {
    requireJsonArg "" "$1" || return 1
    local jsonString="$1"; shift

    local output
    output="$(jq -cr 'getpath($ARGS.positional)' --args $* <<< "$jsonString")"
    local jqExit=$?

    if [[ $jqExit -ne 0 ]]; then
        # jq encountered a runtime error
        return $jqExit
    elif [[ "$output" == "null" ]] || [[ -z "$output" ]]; then
        return 1
    else
        # Output exists; print it and return with code 0
        echo "$output"
        return 0
    fi
}
```

### Function Argument Validation

All JSON functions include argument validation:

```bash
function requireJsonArg() {
    requireArgWithCheck "$1" "$(echo "$2" | escapeSingleQuotes)" validateJson "a valid minified JSON string "
}

function validateJson() {
    requireArg "a minified JSON string" "$1" || return 1

    echo "$1" | jq -e 'if type == "object" then true else false end' &>/dev/null
}
```

---

## Common Pitfalls

1. JSON/YAML Conversion:
   - Be careful with quotes and special characters in YAML
   - Handle multi-document YAML files properly
   - Be aware of YAML's indentation requirements

2. JSON Data Access:
   - Always check if a path exists before accessing it
   - Handle null values appropriately
   - Use proper error codes to indicate missing values

3. JSON Manipulation:
   - Be careful with deep merges of complex structures
   - Validate updated JSON before writing it back
   - Handle type conversions (string to number, etc.) carefully

4. JSON Validation:
   - Validate JSON structure before processing
   - Use specific validation for critical fields
   - Handle validation errors gracefully

---

## Considerations for TypeScript Port

1. JSON/YAML Conversion:
   - Use established libraries like js-yaml
   - Provide type-safe conversion functions
   - Handle conversion errors gracefully

2. JSON Data Access:
   - Use TypeScript's type system for path access
   - Implement a path-based access utility with type safety
   - Handle undefined/null values with optional chaining

3. JSON Manipulation:
   - Implement immutable update patterns
   - Create type-safe deep merge utilities
   - Support JSON Schema validation

4. JSON Validation:
   - Use JSON Schema for validation
   - Create TypeScript interfaces for configuration objects
   - Implement runtime type checking where necessary

---

By understanding these JSON utilities and their usage patterns, developers can effectively work with Chitin's configuration system and other JSON-based components. The examples provided should help junior engineers understand how to process, validate, and manipulate JSON data in the codebase. 
