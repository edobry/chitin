# Synthase - TypeScript Port of Chitin

Synthase is a TypeScript port of the [Chitin](https://github.com/edobry/chitin) initialization system, named after the enzyme that catalyzes chitin polymerization in nature.

## Round 1 Implementation

This repository contains Round 1 of the Synthase implementation, focusing on:

- TypeScript project setup using Bun runtime
- Configuration loading system for YAML files
- Bash-TypeScript interface for environment variables
- Initial CLI with configuration loading commands
- Unit tests for components

## Project Structure

```
synthase/
├── src/
│   ├── config/           # Configuration loading and processing
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── shell/            # Bash interface
│   ├── cli.ts            # Command line interface
│   └── index.ts          # Main module exports
├── tests/                # Test cases
├── package.json          # Project metadata
└── tsconfig.json         # TypeScript configuration
```

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0.0+)
- Node.js 18+

## Installation

```bash
# Clone the repository
git clone https://github.com/edobry/chitin.git
cd chitin/synthase

# Install dependencies
bun install
```

## Usage

### CLI Usage

```bash
# Load and display configuration
bun run src/cli.ts load-config

# Export configuration as environment variables
bun run src/cli.ts load-config --export-env

# Basic initialization (more functionality in future rounds)
bun run src/cli.ts init
```

### Programmatic Usage

```typescript
import { Synthase } from './src';

async function main() {
  // Create a new Synthase instance
  const synthase = new Synthase();
  
  // Initialize
  await synthase.initialize();
  
  // Get configuration
  const config = synthase.getConfig();
  console.log('Project directory:', config.projectDir);
  
  // Export environment
  const envPath = await synthase.exportEnvironment();
  console.log(`Exported environment to ${envPath}`);
}

main().catch(console.error);
```

## Running Tests

```bash
bun test
```

## Features

- Configuration loading and validation from YAML files
- Path expansion (~/path and localshare/path)
- Type-safe configuration interfaces
- Environment variable exchange with Bash
- Configuration merging system
- CLI with JSON/YAML output

## Future Rounds

- **Round 2**: Module system implementation (fibers and chains)
- **Round 3**: Tool management system
- **Round 4**: Shell integration and full CLI
- **Round 5**: Performance optimization and documentation

## License

Same as Chitin's original license
