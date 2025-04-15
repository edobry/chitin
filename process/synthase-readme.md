# Synthase

> TypeScript implementation of the Chitin initialization process

Synthase is a Node.js TypeScript library that implements and extends the Chitin project's initialization system, providing type safety, improved error handling, and enhanced performance.

[![TypeScript](https://img.shields.io/badge/TypeScript-4.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16.x-green.svg)](https://nodejs.org/)

## Features

- **Type-safe configuration** - Strongly typed configuration with validation
- **Module management** - Discover and load modules from the chains directory
- **Tool verification** - Install and validate required development tools
- **Cross-platform support** - Run consistently across different operating systems
- **Bash integration** - Seamless interaction with existing shell scripts
- **Performance optimization** - Caching and parallel operations

## Installation

```bash
# Using npm
npm install synthase

# Using yarn
yarn add synthase

# From the Chitin project root
npm install ./synthase
```

## Quick Start

```bash
# Initialize Chitin environment
synthase init

# Check for required tools
synthase check-tools

# Run with specific configuration
synthase init --config /path/to/config.yaml
```

## API

### CLI Commands

```bash
# Full initialization
synthase init [options]

# Load configuration only
synthase load-config [options]

# Check tools
synthase check-tools [options]

# List modules
synthase list-modules [options]
```

### CLI Options

```bash
--mode <mode>           Operation mode (standalone, hybrid, legacy-wrapper)
--config <path>         Path to configuration file
--no-tools              Skip tool checking
--no-color              Disable color output
--help                  Display help
--version               Display version
```

### Programmatic Usage

```typescript
import { Synthase } from 'synthase';

// Initialize synthase
const synthase = new Synthase({
  projectDir: '/path/to/project',
  configPath: '/path/to/config.yaml',
  autoInit: true,
  failOnError: true
});

// Run initialization
await synthase.initialize();

// Load module
const module = await synthase.loadModule('module-name');

// Check tools
const tools = await synthase.checkTools();
```

## Architecture

Synthase has a modular architecture with the following components:

- **Configuration System** - Loads and validates configurations
- **Module System** - Discovers and loads modules
- **Tool Management** - Verifies and installs tools
- **Shell Integration** - Executes shell scripts

## Integration with Chitin

Synthase integrates with the existing Chitin bash-based system through these modes:

- **Standalone Mode** - Runs independently of bash scripts
- **Hybrid Mode** - Coordinates with bash scripts for select operations
- **Legacy Wrapper Mode** - Acts as a thin wrapper around existing bash functionality

## Development

### Prerequisites

- Node.js 16.x or later
- npm 7.x or later

### Setup

```bash
# Clone the repository
git clone https://github.com/username/chitin.git
cd chitin/synthase

# Install dependencies
npm install

# Build the project
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run specific tests
npm test -- --grep "Configuration"

# Check code coverage
npm run coverage
```

### Build

```bash
# Development build
npm run build

# Production build
npm run build:prod
```

## Contributing

Please read [CONTRIBUTING.md](../CONTRIBUTING.md) for details on the code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## About the Name

Synthase comes from the enzyme chitin synthase that catalyzes the formation of chitin polymers in nature, reflecting this library's role in building Chitin environments. 
