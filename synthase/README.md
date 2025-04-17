# Synthase

## Overview

Synthase is a TypeScript-based configuration and initialization system for shell environments, part of the [Chitin](https://github.com/edobry/chitin) ecosystem. Named after the enzyme that catalyzes chitin polymerization in nature, it provides a modern approach to managing your development environment.

Synthase helps you:
- Maintain consistent shell environments across different machines
- Define your development setup in structured, version-controlled configuration files
- Access configuration through both command-line and programmatic interfaces
- Benefit from TypeScript's type safety and modern tooling in shell environment management

The project brings the reliability of static typing, better tooling, and improved cross-platform support to shell environment management while maintaining compatibility with existing Chitin configurations.

## Features

- **Version-Controlled Environment** - Define your development setup in code, allowing you to track changes, share configurations between machines, and onboard new team members faster.

- **Modular Organization** - Group related tools and settings into functional modules that can be enabled or disabled as needed, keeping your environment lean and purpose-specific.

- **Cross-Machine Consistency** - Write your configuration once and use it everywhere, with automatic path handling ensuring your setup works on any system without modifications.

- **Shell Integration** - Seamlessly export settings to any shell environment, making your configuration immediately available to all your tools and scripts.

- **Configuration Validation** - Catch configuration errors early with automatic validation, preventing frustrating runtime errors and mysterious tool failures.

- **Module System** - Discover, validate, and load modules with intelligent dependency resolution, ensuring modules are loaded in the correct order.

- **Fiber Management** - Activate and deactivate specific fibers to create focused environments for different contexts or projects.

## Installation

```bash
# Clone the repository
git clone https://github.com/edobry/chitin.git
cd chitin

# Install dependencies 
cd synthase
bun install
```

## Usage

### Command Line Interface

Synthase provides a CLI for working with Chitin configurations:

#### Configuration Commands

```bash
# load-config
# Loads and displays the user configuration
bun run src/cli.ts load-config

# Display options:
#   --json, -j         Output as JSON instead of YAML
#   --export-env, -e   Export configuration as environment variables
#   --path <path>, -p  Custom path to user config file

# Examples:
# View configuration in YAML format (default)
bun run src/cli.ts load-config

# Output configuration as JSON
bun run src/cli.ts load-config --json

# Export configuration to environment variables
# Creates a .chitin_env_ts file that can be sourced by Bash
bun run src/cli.ts load-config --export-env

# Use a custom configuration file
bun run src/cli.ts load-config --path /path/to/userConfig.yaml
```

#### Initialization Commands

```bash
# init
# Initializes the Chitin environment
# This will load configuration and export environment variables
bun run src/cli.ts init

# Options:
#   --config <path>, -c   Path to user config file
#   --no-tools, -n        Skip tool dependency checking

# Examples:
# Basic initialization
bun run src/cli.ts init

# Initialize with a custom config file
bun run src/cli.ts init --config /path/to/userConfig.yaml

# Initialize without checking tool dependencies
bun run src/cli.ts init --no-tools
```

#### Module System Commands

```bash
# validate
# Validates module configurations
bun run src/cli.ts validate

# Display options:
#   --json, -j         Output as JSON
#   --yaml, -y         Output as YAML
```

#### Fiber Management Commands

```bash
# fibers
# List fibers and their modules in load order
bun run src/cli.ts fibers

# Options:
#   --list, -l              List all fibers (default)
#   --available, -a         List only available fibers (enabled with satisfied dependencies)
#   --check-dependencies, -c Check dependencies for all fibers
#   --detailed, -d          Show detailed information for fibers and chains

# Examples:
# List all fibers and their chains
bun run src/cli.ts fibers

# List only available fibers
bun run src/cli.ts fibers --available

# Check fiber dependencies
bun run src/cli.ts fibers --check-dependencies

# Show detailed information
bun run src/cli.ts fibers --detailed
```

Fibers determine which chains (modules) get loaded. The core fiber is always loaded, while other fibers are loaded based on their enabled status and tool dependencies.

### Configuration Format

Synthase uses a structured YAML format with fibers and chains:

```yaml
# Core fiber - has special treatment during initialization
core:
  projectDir: ~/Projects
  dotfilesDir: localshare/chezmoi
  checkTools: true
  moduleConfig:        # These are chains within the core fiber
    secret:
      tool: pass
    auth:
      enabled: true

# Other fibers
dev:
  moduleConfig:        # These are chains within the dev fiber
    docker:
      enabled: true
    web:
      enabled: true

ops:
  enabled: true
  toolDeps: [docker, kubectl]
  moduleConfig:        # These are chains within the ops fiber
    kubernetes:
      enabled: true
```

In this configuration:
- `core` is a special fiber that's always enabled and loaded first
- `dev` and `ops` are additional fibers - separate functional groups that can be enabled or disabled
- Each fiber contains one or more chains (under `moduleConfig`)
- Fibers control which chains are loaded based on:
  1. Whether the fiber is enabled in configuration (enabled: true/false)
  2. Whether the fiber's tool dependencies are satisfied

### Tool Configuration

Tools are dependencies that chains and fibers may require. Each tool configuration can specify how to check for its presence and how to install it if missing:

```yaml
tools:
  # Simple tool with default check (will use 'git --version')
  git: {}
  
  # Tool with explicit check command
  node:
    checkCommand: node --version
  
  # Tool with alternative check methods
  homebrew:
    checkPath: /opt/homebrew/bin/brew
    
  # Tool with installation method
  jq:
    checkCommand: jq --version
    brew: true
    
  # Optional tool
  fancy-tool:
    optional: true
```

#### Tool Check Methods

Tools can be checked for existence in several ways:

1. **Default Check**: 
   - If no check method is specified and the tool is not marked as optional, Synthase will automatically use `command -v <toolname>` as the check command, matching the behavior of the original Chitin implementation.

2. **Check Command**: `checkCommand: "command-to-run"` - Specify a command that should return zero exit code if the tool exists
3. **Check Brew**: `checkBrew: true` - Check if the tool is installed via Homebrew
4. **Check Path**: `checkPath: "/path/to/tool"` - Check if a specific file path exists
5. **Check Eval**: `checkEval: "command -v tool"` - Evaluate a shell expression

If no check method is provided and the tool is not marked as optional, Synthase will use `command -v <toolname>` to verify the tool's existence in PATH, exactly matching the behavior of the original Chitin implementation.

#### Tool Installation Methods

Synthase supports several ways to install missing tools:

1. **Homebrew**: `brew: true` - Install via Homebrew
2. **Git**: Clone a git repository
3. **Script**: Run a custom installation script
4. **Artifact**: Download and extract an archive
5. **Command**: Run a specified installation command

For complex tools, you can also specify version requirements and post-installation steps.

### Programmatic API

Synthase can be used programmatically in your TypeScript/JavaScript projects:

```typescript
import { Synthase } from './synthase';

async function main() {
  // Create a new Synthase instance
  const synthase = new Synthase();
  
  // Initialize
  await synthase.initialize();
  
  // Access configuration
  const config = synthase.getConfig();
  console.log('Project directory:', synthase.getCoreValue('projectDir'));
  
  // Export environment variables
  const envPath = await synthase.exportEnvironment();
  console.log(`Environment exported to ${envPath}`);
}

main().catch(console.error);
```

#### Key API Methods

- `new Synthase(configPath?)` - Create a new instance, optionally with a custom config path
- `initialize()` - Load and validate configuration
- `getConfig()` - Get the full configuration object
- `getCoreValue(field)` - Get a value from the core configuration section
- `exportEnvironment(includeCurrentEnv?)` - Export config as environment variables

#### Module System API

```typescript
import { discoverModulesFromConfig, loadModule, validateModule } from './synthase';

async function main() {
  // Load configuration
  const userConfig = await loadUserConfig();
  const fullConfig = getFullConfig(userConfig);
  
  // Discover modules
  const result = await discoverModulesFromConfig(fullConfig);
  console.log(`Discovered ${result.modules.length} modules`);
  
  // Validate modules
  const validationResults = validateModules(result.modules);
  
  // Load a module with its dependencies
  for (const module of result.modules) {
    const loadResult = await loadModule(module, { 
      loadDependencies: true 
    });
    
    if (loadResult.success) {
      console.log(`Loaded module ${module.id}`);
    } else {
      console.error(`Failed to load module ${module.id}: ${loadResult.error}`);
    }
  }
}
```

#### Fiber Management API

```typescript
import { createFiberManager } from './synthase';

async function main() {
  // Create a fiber manager
  const fiberManager = createFiberManager();
  
  // Load saved fiber state
  await fiberManager.loadFiberState();
  
  // Register fibers
  fiberManager.registerFiber('dev', ['web-dev', 'db-tools']);
  fiberManager.registerFiber('ops', ['docker', 'kubernetes']);
  
  // Activate a fiber
  fiberManager.activateFiber('dev');
  
  // Get active fibers
  const activefibers = fiberManager.getActiveFibers();
  console.log('Active fibers:', activefibers.map(f => f.id).join(', '));
  
  // Save fiber state
  await fiberManager.persistFiberState();
}
```

## Development

### Requirements

- [Bun](https://bun.sh/) runtime v1.0.0+
- Node.js 18+

### Project Structure

```
synthase/
├── src/
│   ├── config/           # Configuration management
│   ├── modules/          # Module system
│   │   ├── discovery.ts  # Module discovery
│   │   ├── dependency.ts # Dependency resolution
│   │   ├── loader.ts     # Module loading
│   │   ├── validator.ts  # Module validation
│   │   └── state.ts      # Module state tracking
│   ├── fiber/            # Fiber management
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utility functions 
│   ├── shell/            # Shell integration
│   ├── cli.ts            # Command-line interface
│   └── index.ts          # Main module exports
├── tests/                # Test cases
```

### Running Tests

```bash
bun test
```

## License

Same as [Chitin](https://github.com/edobry/chitin)'s license.
