# Synthase Architecture

## Overview

Synthase is a TypeScript implementation of Chitin's environment management system. Named after the enzyme that catalyzes chitin polymerization in nature, it provides a modern approach to managing shell environments with improved type safety, better tooling, and enhanced cross-platform support while maintaining compatibility with existing Chitin configurations.

This document explains Synthase's architecture and its role within the broader Chitin ecosystem.

## Chitin Ecosystem Context

### What is Chitin?

Chitin is a modular and extensible shell framework inspired by the natural composition of chitin (the material forming shells of many organisms). The framework follows a hierarchical structure:

- **Helpers**: Individual shell functions
- **Chains**: Collections of helpers focused on specific domains
- **Fibers**: Top-level modules grouped by domain that link chains together
- **Modules**: General term that applies to both chains and fibers

The original Chitin implementation is primarily written in Bash shell scripts, while Synthase represents a modernized reimplementation in TypeScript.

### Taxonomy Example

```plain
chitin-core
├── chitin-dev [fiber]
│   ├── docker [chain]
│   │   ├── build_image() [helper]
│   │   ├── run_container() [helper]
│   ├── git [chain]
│       ├── clone_repo() [helper]
│       ├── commit_changes() [helper]
├── chitin-cloud [fiber]
    ├── aws [chain]
    │   ├── launch_instance() [helper]
    │   ├── list_buckets() [helper]
    ├── kubernetes [chain]
        ├── deploy_pod() [helper]
        ├── scale_deployment() [helper]
```

## Synthase's Role

Synthase serves as the configuration and initialization system for shell environments within the Chitin ecosystem. It's responsible for:

1. Loading and validating user configuration
2. Discovering, validating, and loading modules (fibers and chains)
3. Managing tool dependencies
4. Exporting environment variables for shell use
5. Providing a CLI for environment management

## Core Architectural Components

Synthase follows a modular architecture with these key components:

### 1. Configuration System (`/src/config/`)

Handles loading, validating, and merging configuration from various sources:

- **loader.ts**: Loads configuration from YAML files
- **validator.ts**: Validates configuration against schemas
- **merger.ts**: Merges configurations from different sources
- **types.ts**: Defines TypeScript interfaces for configuration

The configuration system follows a priority order:
1. Module metadata (highest priority)
2. Fiber-specific config files
3. Global config (lowest priority)

Special cases include the `core` fiber, which is always loaded first, and the `dotfiles` fiber, which has special handling rules.

### 2. Module System (`/src/modules/`)

Manages the discovery, validation, and loading of modules:

- **discovery.ts**: Discovers modules in the filesystem
- **loader.ts**: Loads modules with their dependencies
- **dependency.ts**: Manages dependency resolution
- **validator.ts**: Validates module configuration
- **state.ts**: Tracks module state during runtime

The module system ensures that modules are loaded in the correct dependency order and only enabled modules with satisfied dependencies are activated.

### 3. Fiber Management (`/src/fiber/`)

Provides specialized handling for fibers, including:

- Dependency ordering
- Status tracking
- Chain association
- Configuration management

The fiber system recognizes special fibers like `core` and handles them appropriately.

### 4. Command Line Interface (`/src/commands/`)

Exposes Synthase's functionality through a CLI:

- **config.ts**: Commands for configuration management
- **init.ts**: Commands for environment initialization
- **tools.ts**: Commands for tool management
- **fibers/**: Commands for fiber management

The CLI provides various subcommands and options to control Synthase's behavior.

### 5. Shell Integration (`/src/shell/`)

Enables seamless integration with shell environments:

- Environment variable export
- Path expansion
- Shell script execution
- Platform detection

## Component Interactions

The following diagram illustrates how the main components interact:

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│     CLI       │────▶│ Configuration │────▶│  Module       │
└───────┬───────┘     │   System      │     │  System       │
        │             └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Shell      │◀────│     Fiber     │◀────│     Tool      │
│  Integration  │     │   Management  │     │  Management   │
└───────────────┘     └───────────────┘     └───────────────┘
```

1. The CLI receives user commands and options
2. The Configuration System loads and validates configuration
3. The Module System discovers and loads modules
4. Fiber Management handles dependency resolution and activation
5. Tool Management verifies and installs required tools
6. Shell Integration exports the environment for shell use

## Integration with Original Chitin

Synthase integrates with the existing Bash-based Chitin system through multiple modes:

1. **Standalone Mode**: Runs independently of Bash scripts
2. **Hybrid Mode**: Coordinates with Bash scripts for select operations
3. **Legacy Wrapper Mode**: Acts as a wrapper around existing Bash functionality

This flexibility allows for gradual adoption while maintaining compatibility with existing configurations.

## Implementation Details

### File Structure

The current implementation follows this structure:

```
synthase/
├── src/
│   ├── cli.ts                  # CLI entry point
│   ├── index.ts                # Main module exports
│   ├── constants.ts            # Global constants
│   ├── commands/               # CLI commands
│   │   ├── config.ts
│   │   ├── fibers/
│   │   ├── init.ts
│   │   └── tools.ts
│   ├── config/                 # Configuration system
│   │   ├── loader.ts
│   │   ├── merger.ts
│   │   ├── types.ts
│   │   └── validator.ts
│   ├── fiber/                  # Fiber management
│   ├── modules/                # Module system
│   │   ├── discovery.ts
│   │   ├── dependency.ts
│   │   ├── loader.ts
│   │   ├── state.ts
│   │   └── validator.ts
│   ├── shell/                  # Shell integration
│   ├── types/                  # Type definitions
│   └── utils/                  # Utility functions
├── tests/                      # Test cases
```

### Key Types and Interfaces

```typescript
// Configuration
interface Config {
  core: CoreConfig;
  fibers: Record<string, FiberConfig>;
  chains: Record<string, ChainConfig>;
  tools: Record<string, ToolConfig>;
}

// Module
interface Module {
  id: string;
  type: 'fiber' | 'chain';
  config: ModuleConfig;
  dependencies: string[];
  tools: ToolConfig[];
  scripts: string[];
  isEnabled: boolean;
}

// Tool
interface Tool {
  name: string;
  version?: string;
  checkCommand?: string;
  checkPath?: string;
  checkBrew?: boolean;
  optional?: boolean;
  brew?: boolean;
  installCommand?: string;
}
```

## Runtime Flow

1. User invokes the CLI command
2. Configuration is loaded from YAML files
3. Modules are discovered in the filesystem
4. Dependencies are resolved
5. Modules are loaded in the correct order
6. Tool dependencies are checked and installed if needed
7. Environment variables are exported for shell use

## Design Principles

Synthase follows these key design principles:

1. **Type Safety**: Using TypeScript to catch errors at compile time
2. **Modularity**: Separating concerns into distinct components
3. **Compatibility**: Maintaining compatibility with existing Chitin configurations
4. **Performance**: Optimizing for fast initialization and low resource usage
5. **User Experience**: Providing clear, concise output and helpful error messages

## Future Directions

1. **Enhanced Performance**: Further optimization of module loading and tool checking
2. **Extended Plugin System**: Allowing custom plugins for specialized environments
3. **UI Improvements**: Adding interactive CLI features and visual indicators
4. **Cross-Platform Support**: Improving support for Windows and other platforms
5. **Integration APIs**: Enhancing the programmatic API for third-party tools

## Conclusion

Synthase represents an evolution of Chitin's architecture, bringing modern development practices while maintaining compatibility with the existing ecosystem. Its modular design, type safety, and improved tooling make it a powerful tool for managing shell environments across different machines and platforms. 
