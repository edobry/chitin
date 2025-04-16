# Synthase

Synthase is a TypeScript-based configuration and initialization system for shell environments. It loads, validates, and manages configurations from YAML files to set up your development environment consistently across machines.

Named after the enzyme that catalyzes chitin polymerization in nature, Synthase works alongside [Chitin](https://github.com/edobry/chitin) to provide a robust shell environment.

## Relationship with Chitin

### Current Role

Synthase currently functions as a TypeScript-powered configuration loader for Chitin:

- Loads and validates user configuration from YAML files
- Handles path expansion and environment variable integration
- Provides a modern, type-safe API for accessing configuration
- Can be invoked by Chitin's bash scripts to handle configuration loading

### Target Role

Synthase is designed to eventually take over core initialization functions from Chitin's shell scripts:

- Provide a complete TypeScript implementation of Chitin's initialization system
- Handle module loading, dependency resolution, and lifecycle management
- Manage tool dependencies, installation, and validation 
- Offer improved performance through parallelization and caching
- Enable better cross-platform support and extensibility

The goal is to have Synthase become the primary entry point for Chitin initialization while maintaining compatibility with existing configuration files and shells.

## Features

- **Powerful Configuration System**
  - Loads configuration from structured YAML files
  - Supports XDG standards (`~/.config/chitin`)
  - Validates configuration structure and values
  - Expands special paths (`~` and `localshare`)

- **Environment Management**
  - Exports configuration to environment variables
  - Interfaces with Bash for environment synchronization
  - Maintains consistent development environments

- **Type-Safe Implementation**
  - Built with TypeScript for reliability and IDE support
  - Provides programmatic API with full type definitions
  - Ensures configuration integrity through validation

- **Bun Runtime**
  - Fast execution with Bun's optimized JavaScript runtime
  - Compact package with minimal dependencies
  - First-class TypeScript support

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

### Configuration Format

Synthase uses a structured YAML format with fibers and chains:

```yaml
# Example configuration
core:
  projectDir: ~/Projects
  dotfilesDir: localshare/chezmoi
  checkTools: true
  moduleConfig:
    secret:
      tool: pass

dev:
  moduleConfig:
    docker:
      enabled: true
```

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

## Development

### Requirements

- [Bun](https://bun.sh/) runtime v1.0.0+
- Node.js 18+

### Project Structure

```
synthase/
├── src/
│   ├── config/           # Configuration management
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
