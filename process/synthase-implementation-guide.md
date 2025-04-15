# Synthase Implementation Guide

This guide complements the specification and structural documents, focusing on concrete implementation details and addressing common challenges an engineer might face when implementing Synthase.

## Quick Setup

```bash
# Create project structure
mkdir -p chitin/synthase/src/{config,module,tool,shell,types,utils}
cd chitin/synthase
npm init -y
npm install --save commander js-yaml chalk shelljs
npm install --save-dev typescript @types/node jest ts-jest
```

Basic `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Key Implementation Examples

### Bash-TypeScript Interface

The most critical component is the environment variable exchange between bash and TypeScript:

```typescript
// src/shell/environment.ts
import * as fs from 'fs/promises';

// Parse bash exported environment
export async function importEnvironmentFromFile(filePath: string): Promise<Record<string, string>> {
  const content = await fs.readFile(filePath, 'utf8');
  const env: Record<string, string> = {};
  
  content.split('\n').forEach(line => {
    const match = line.match(/declare -x ([^=]+)="(.*)"/);
    if (match) {
      const [, name, value] = match;
      env[name] = value;
    }
  });
  
  return env;
}

// Create sourceable bash file with environment changes
export async function exportEnvironmentToFile(env: Record<string, string>, filePath: string): Promise<void> {
  const content = Object.entries(env)
    .map(([key, value]) => `export ${key}="${value.replace(/"/g, '\\"')}"`)
    .join('\n');
  
  await fs.writeFile(filePath, content);
}
```

### Error Communication Pattern

For error handling between bash and TypeScript:

```typescript
// TypeScript side
try {
  const result = await operation();
  console.log('SYNTHASE_SUCCESS=true');
  console.log(`SYNTHASE_RESULT=${JSON.stringify(result)}`);
  process.exit(0);
} catch (error) {
  console.error(`SYNTHASE_ERROR=${error.message}`);
  process.exit(1);
}
```

```bash
# Bash side
if output=$(synthase command); then
  result=$(echo "$output" | grep SYNTHASE_RESULT | cut -d= -f2-)
  # Process result
else
  error=$(echo "$output" | grep SYNTHASE_ERROR | cut -d= -f2-)
  echo "Error: $error"
  # Fallback to legacy implementation
fi
```

## Critical Environment Variables

Pay special attention to these environment variables:

- `CHI_DIR` - Chitin root directory
- `CHI_PROJECT_DIR` - User's project directory
- `CHI_DOTFILES_DIR` - User's dotfiles (if configured)
- `CHI_ENV_INITIALIZED` - Initialization state flag
- `CHI_FAIL_ON_ERROR` - Error handling behavior

When passing environment between systems, preserve all `CHI_*` variables plus standard ones like `HOME`, `PATH`, `USER`, etc.

## Common Pitfalls

1. **Path Handling** - Use `path.join()` for cross-platform compatibility
2. **Environment Mismatch** - Bash is case-sensitive while Windows environment variables aren't
3. **Shell Detection** - Different shells have different syntax for environment exports
4. **Error Propagation** - Ensure proper error exit codes for bash to detect
5. **Script Execution** - Consider shell differences when executing scripts

## Testing Bash Integration

Create mock bash environments for testing:

```typescript
// Test setup
const bashEnv = 'declare -x HOME="/home/user"\ndeclare -x CHI_DIR="/path/to/chitin"\n';
await fs.writeFile(tempFile, bashEnv);

// Test the parser
const env = await importEnvironmentFromFile(tempFile);
expect(env.CHI_DIR).toEqual('/path/to/chitin');
```

## Performance Optimizations

1. **Caching**
```typescript
// Simple caching example
const cache = new Map<string, {data: any, timestamp: number}>();

function getCached(key: string, ttl: number): any | null {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp) < ttl) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, {data, timestamp: Date.now()});
}
```

2. **Parallel Operations**
```typescript
// Run independent operations in parallel
await Promise.all([
  checkTools(),
  discoverModules(),
  loadConfigurations()
]);
```

## Implementation Strategy

1. **Start small** - Begin with configuration loading and bash integration
2. **Test thoroughly** - Each component should have tests, especially bash integration
3. **Incremental adoption** - Phase 1 should work alongside existing bash scripts
4. **Environment consistency** - Ensure environment variables are preserved between systems
5. **Error handling** - Provide clear error messages and fallback paths

## Distribution

For easy distribution, configure `package.json`:

```json
{
  "bin": {
    "synthase": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "build:prod": "tsc && esbuild dist/cli.js --bundle --platform=node --outfile=bin/synthase"
  }
}
```

And ensure the CLI entry point has a shebang:

```typescript
#!/usr/bin/env node
import { program } from 'commander';
// ... commander setup
```

## Recommended Implementation Sequence

1. Configuration system
2. Environment handling between bash and TypeScript
3. Module discovery
4. Bash integration for Phase 1
5. Tool verification
6. Complete shell integration
7. Performance optimization
8. Documentation and tests

Focus on maintaining compatibility with the existing system while gradually enhancing it with TypeScript's benefits. 
