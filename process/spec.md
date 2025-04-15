# Chitin Node.js TypeScript Port Specification: Synthase

## Overview

This document specifies the Node.js TypeScript implementation of the chitin initialization process, called Synthase (named after the enzyme that catalyzes chitin polymerization in nature), maintaining the same structure and interactions as the current shell implementation.

## Core Architecture

### 1. Initialization Engine

The initialization engine follows the same sequence as `init.sh`:

1. Environment setup (`CHI_DIR`, shell options)
2. Load init chain files (`chains/init/**/*.sh`)
3. Load core chain files (`chains/core/**/*.sh`)
4. Load user configuration (`chiConfigUserLoad`)
5. Load fibers and chains
6. Run initialization commands

### 2. Module System

```typescript
interface Module {
  name: string;
  type: 'fiber' | 'chain';
  config: ModuleConfig;
  dependencies: string[];
  tools: ToolConfig[];
  scripts: string[];
}

interface ModuleConfig {
  enabled: boolean;
  version?: string;
  tools?: ToolConfig[];
  dependencies?: string[];
}
```

### 3. Configuration System

```typescript
interface Config {
  core: CoreConfig;
  fibers: Record<string, FiberConfig>;
  chains: Record<string, ChainConfig>;
  tools: Record<string, ToolConfig>;
}

interface CoreConfig {
  projectDir: string;
  dotfilesDir?: string;
  checkTools: boolean;
  autoInitDisabled?: boolean;
  failOnError?: boolean;
}
```

### 4. Tool Management

```typescript
interface Tool {
  name: string;
  version?: string;
  type: 'brew' | 'git' | 'npm' | 'executable';
  config: ToolConfig;
  status: ToolStatus;
}

interface ToolStatus {
  installed: boolean;
  validVersion: boolean;
  lastChecked: Date;
}
```

## Key Components

### 1. Initialization Engine
- Handles the main initialization sequence
- Manages environment variables
- Coordinates loading of other components
- Runs initialization commands

### 2. Module Loader
- Loads and parses module configurations
- Manages module dependencies
- Handles module lifecycle
- Supports both fibers and chains

### 3. Configuration Manager
- Loads and validates configurations
- Manages environment variables
- Handles user configuration
- Merges configurations

### 4. Tool Manager
- Installs and verifies tools
- Manages tool versions
- Checks tool dependencies
- Caches tool status

## Porting Strategy

### Phase 1: Configuration System
- Replace `chiConfigUserLoad`
- Handle user configuration
- Manage environment variables
- Support configuration merging

### Phase 2: Module System
- Replace module loading from `chains/`
- Handle fiber and chain loading
- Manage module dependencies
- Support module lifecycle

### Phase 3: Tool Management
- Replace tool checking and installation
- Handle tool versions
- Manage tool dependencies
- Support tool caching

### Phase 4: Shell Integration
- Replace shell script execution
- Handle environment variables
- Support cross-platform execution
- Manage command output

## API Design

```typescript
class Synthase {
  constructor(options: SynthaseOptions);
  
  async initialize(): Promise<void>;
  async loadModule(name: string): Promise<Module>;
  async installTool(name: string): Promise<Tool>;
  async checkDependencies(): Promise<DependencyStatus>;
  
  getConfig(): Config;
  getModule(name: string): Module | undefined;
  getTool(name: string): Tool | undefined;
}

interface SynthaseOptions {
  projectDir: string;
  configPath?: string;
  autoInit?: boolean;
  failOnError?: boolean;
}
```

## Error Handling

1. **Configuration Errors**
   - Validation errors
   - Missing required fields
   - Invalid values

2. **Module Errors**
   - Missing dependencies
   - Load failures
   - Circular dependencies

3. **Tool Errors**
   - Installation failures
   - Version mismatches
   - Dependency conflicts

## Testing Strategy

1. **Unit Tests**
   - Individual components
   - Configuration handling
   - Tool management

2. **Integration Tests**
   - Module loading
   - Dependency resolution
   - Tool installation

3. **End-to-End Tests**
   - Complete initialization
   - Cross-platform compatibility
   - Performance benchmarks

## Performance Considerations

1. **Module Loading**
   - Lazy loading where possible
   - Caching of loaded modules
   - Parallel loading of independent modules

2. **Tool Management**
   - Caching of tool status
   - Parallel tool checking
   - Incremental updates

3. **Configuration**
   - Caching of parsed configs
   - Efficient validation
   - Minimal file reads

## Security Considerations

1. **Tool Installation**
   - Verify tool sources
   - Validate checksums
   - Sandbox execution

2. **Configuration**
   - Validate user input
   - Sanitize environment variables
   - Handle sensitive data

3. **Module Loading**
   - Validate module sources
   - Check module integrity
   - Handle malicious modules 

## TypeScript-Bash Interface

### 1. Initialization Handoff
```typescript
interface BashInterface {
  // Execute a bash script and capture its output
  executeScript(scriptPath: string, env: Record<string, string>): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;

  // Load environment variables from bash
  loadEnvironment(): Promise<Record<string, string>>;

  // Execute a bash function and capture its output
  executeFunction(functionName: string, args: string[]): Promise<string>;
}
```

### 2. Migration Strategy
1. **Phase 1: Coexistence**
   - Synthase loads bash environment
   - Executes existing bash scripts through wrapper
   - Maintains compatibility with current structure
   - Gradually replaces bash functionality

2. **Phase 2: Hybrid Operation**
   - Synthase handles configuration and module loading
   - Bash scripts handle tool installation and execution
   - Shared environment between both systems
   - Common logging and error handling

3. **Phase 3: Full Migration**
   - Synthase becomes primary entry point
   - Bash scripts are ported to TypeScript
   - Legacy bash support maintained for compatibility
   - Full feature parity achieved

### 3. Environment Management
```typescript
interface EnvironmentManager {
  // Export environment to bash
  exportToBash(env: Record<string, string>): void;
  
  // Import environment from bash
  importFromBash(): Promise<Record<string, string>>;
  
  // Merge environments
  mergeEnvironments(tsEnv: Record<string, string>, bashEnv: Record<string, string>): Record<string, string>;
}
```

### 4. Script Execution
```typescript
interface ScriptExecutor {
  // Execute a bash script with environment
  execute(script: string, env: Record<string, string>): Promise<ExecutionResult>;
  
  // Execute a bash function
  executeFunction(name: string, args: string[]): Promise<string>;
  
  // Source a bash file
  source(file: string): Promise<void>;
}
```

### 5. Compatibility Layer
```typescript
interface CompatibilityLayer {
  // Convert bash paths to platform-specific paths
  normalizePath(path: string): string;
  
  // Handle platform-specific differences
  handlePlatformDifferences(): void;
  
  // Manage shell-specific features
  handleShellFeatures(shell: string): void;
}
```

### 6. Error Handling
```typescript
interface ErrorHandler {
  // Convert bash errors to TypeScript errors
  convertBashError(error: string): Error;
  
  // Handle mixed environment errors
  handleMixedEnvironmentError(error: Error): void;
  
  // Provide error context
  provideErrorContext(error: Error): string;
}
```

### 7. Entry Point and Handoff Mechanism

#### Phase 1: Coexistence (Bash Primary)
```bash
# in init.sh
if command -v synthase &>/dev/null; then
  # Export current environment to a temp file
  export -p > "${CHI_DIR}/.chitin_env_export"
  
  # Call Synthase for configuration loading
  CHITIN_CONFIG=$(synthase load-config)
  
  # Source environment changes from Synthase
  source "${CHI_DIR}/.chitin_env_ts"
else
  # Legacy bash implementation
  chiConfigUserLoad
fi
```

- Bash (`init.sh`) remains the primary entry point
- Synthase is invoked by bash for specific functionality
- Environment variables are exchanged via temp files and stdout
- Synthase outputs changes that bash then sources

#### Phase 2: Hybrid Operation
```bash
# in init.sh
if command -v synthase &>/dev/null; then
  # Export all env vars needed by Synthase
  export CHI_DIR CHITIN_CONFIG_PATH
  
  # Let Synthase handle module loading and tool management
  synthase init --mode=hybrid
  
  # Source updated environment
  source "${CHI_DIR}/.chitin_env_ts"
  
  # Continue with bash-specific operations
else
  # Full legacy implementation
fi
```

- Both entry points are supported
- Synthase CLI (`synthase init`) can be used directly
- Bash delegates more functionality to Synthase
- Synthase handles configuration, module loading, and tool management

#### Phase 3: Full Migration
```bash
# in init.sh
if command -v synthase &>/dev/null; then
  export CHI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec synthase init "$@"
else
  # Legacy fallback
fi
```

- Synthase becomes the primary recommended entry point
- `init.sh` becomes a thin wrapper around Synthase
- Both paths provide identical functionality
- Legacy bash support is maintained for backward compatibility

### 8. TypeScript CLI Interface
```typescript
interface CLI {
  // Main initialization command
  init(options: InitOptions): Promise<void>;
  
  // Load configuration subcommand
  loadConfig(options: ConfigOptions): Promise<string>;
  
  // Module management subcommands
  loadModule(name: string): Promise<void>;
  listModules(): Promise<void>;
  
  // Tool management subcommands
  installTool(name: string): Promise<void>;
  checkTools(): Promise<void>;
}

interface InitOptions {
  mode: 'standalone' | 'hybrid' | 'legacy-wrapper';
  configPath?: string;
  noTools?: boolean;
  noColor?: boolean;
} 
