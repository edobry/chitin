# Chitin TypeScript Program Structure: Synthase

## Project Location

The TypeScript implementation, called Synthase, will be located in a new `synthase` directory at the project root:

```
chitin/
├── chains/
├── docs/
├── process/
└── synthase/         # TypeScript implementation
    ├── src/
    ├── dist/
    ├── tests/
    ├── package.json
    └── tsconfig.json
```

## Package Structure

```
synthase/
├── src/
│   ├── index.ts                  # Main entry point
│   ├── cli.ts                    # CLI implementation
│   ├── config/                   # Configuration management
│   │   ├── loader.ts             # Configuration loading
│   │   ├── validator.ts          # Configuration validation
│   │   └── merger.ts             # Configuration merging
│   ├── module/                   # Module system
│   │   ├── discovery.ts          # Module discovery
│   │   ├── loader.ts             # Module loading
│   │   └── validator.ts          # Module validation
│   ├── tool/                     # Tool management
│   │   ├── discovery.ts          # Tool discovery
│   │   ├── installer.ts          # Tool installation
│   │   ├── validator.ts          # Tool validation
│   │   └── version.ts            # Version checking
│   ├── shell/                    # Shell integration
│   │   ├── executor.ts           # Script execution
│   │   ├── environment.ts        # Environment management
│   │   └── platform.ts           # Platform detection
│   ├── types/                    # Type definitions
│   │   ├── config.ts             # Configuration types
│   │   ├── module.ts             # Module types
│   │   └── tool.ts               # Tool types
│   └── utils/                    # Utility functions
│       ├── file.ts               # File operations
│       ├── log.ts                # Logging
│       └── error.ts              # Error handling
├── tests/                        # Test files
│   ├── config/                   # Configuration tests
│   ├── module/                   # Module tests
│   ├── tool/                     # Tool tests
│   └── shell/                    # Shell tests
├── dist/                         # Compiled output
├── package.json                  # Package definition
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Jest configuration
└── .eslintrc.js                  # ESLint configuration
```

## Key Components

### 1. CLI Interface

The CLI interface will be the main entry point for the Synthase program. It will handle command-line arguments and dispatch to the appropriate functionality.

```typescript
// cli.ts
import { Command } from 'commander';
import { loadConfig } from './config/loader';
import { init } from './index';

const program = new Command();

program
  .name('synthase')
  .description('Chitin initialization engine in TypeScript')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize chitin')
  .option('--mode <mode>', 'Operation mode (standalone, hybrid, legacy-wrapper)', 'standalone')
  .option('--config <path>', 'Path to configuration file')
  .option('--no-tools', 'Skip tool checking')
  .option('--no-color', 'Disable color output')
  .action(init);

program
  .command('load-config')
  .description('Load configuration')
  .option('--config <path>', 'Path to configuration file')
  .action(loadConfig);

// Additional commands...

export function run() {
  program.parse(process.argv);
}
```

### 2. Configuration System

Responsible for loading, validating, and merging configuration from various sources.

```typescript
// config/loader.ts
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { Config } from '../types/config';

export async function loadConfigFromFile(path: string): Promise<Config> {
  const content = await fs.readFile(path, 'utf8');
  const config = yaml.load(content) as Config;
  // Validate and process config
  return config;
}

export async function loadConfig(options: { config?: string }): Promise<string> {
  // Implementation as described in implementation plan
}
```

### 3. Module System

Handles module discovery, loading, and validation.

```typescript
// module/discovery.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { Module } from '../types/module';

export async function discoverModules(basePath: string): Promise<Module[]> {
  // Implementation to discover modules from chains directory
}
```

### 4. Tool Management

Manages tool discovery, installation, and validation.

```typescript
// tool/discovery.ts
import { Tool } from '../types/tool';

export async function discoverTools(modules: Module[]): Promise<Tool[]> {
  // Implementation to extract tool requirements from modules
}
```

### 5. Shell Integration

Handles shell script execution and environment management.

```typescript
// shell/executor.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function executeScript(script: string, env: Record<string, string>): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  // Implementation to execute scripts
}
```

## Development Tools

### Build System
- **TypeScript**: For type checking and transpilation
- **esbuild**: For fast bundling
- **npm**: For package management

### Testing
- **Jest**: For unit and integration testing
- **ts-jest**: For TypeScript support in Jest

### Code Quality
- **ESLint**: For linting
- **Prettier**: For code formatting

### Additional Libraries
- **commander**: For CLI argument parsing
- **js-yaml**: For YAML parsing
- **chalk**: For terminal coloring
- **shelljs**: For cross-platform shell commands

## Installation and Usage

The Synthase program will be installable via npm:

```bash
# Global installation
npm install -g synthase

# Local installation
cd chitin
npm install ./synthase
```

When installed, it will provide the `synthase` CLI command that can be used directly or from the bash scripts.

## Distribution

The Synthase implementation will be distributed in several ways:

1. As an npm package named "synthase"
2. As a bundled executable via pkg
3. As part of the chitin repository

## Development Workflow

1. Setup development environment
   ```bash
   cd chitin/synthase
   npm install
   ```

2. Build the project
   ```bash
   npm run build
   ```

3. Test the project
   ```bash
   npm test
   ```

4. Run in development mode
   ```bash
   npm run dev
   ```

## Integration with Bash

As detailed in the implementation plan, the Synthase program will integrate with the existing bash scripts through a phased approach:

1. Phase 1: Synthase is called by bash for specific functionality
2. Phase 2: Synthase handles more components with bash as coordinator
3. Phase 3: Synthase becomes the primary entry point with bash as a thin wrapper 
