# Synthase Documentation Guide

## Overview

This document serves as an entry point to all documentation for Synthase, the TypeScript implementation of the Chitin initialization and configuration system. It explains the purpose of each document and when to use it.

## Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [README.md](./README.md) | User-facing overview, installation and usage instructions | First contact with the project; learning how to use Synthase |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Comprehensive design and architecture overview | Understanding how Synthase is built and how it fits within Chitin |
| [PROCESS.md](./PROCESS.md) | Development processes and conventions | Making changes to Synthase; understanding project conventions |
| [CHANGELOG.md](./CHANGELOG.md) | History of changes, organized by component | Tracking changes; understanding project evolution |
| [test-user-config.yaml](./test-user-config.yaml) | Example configuration for testing | Reference for creating your own configuration |

## Additional Resources

Documentation available in the parent Chitin project:

| Document | Location | Purpose |
|----------|----------|---------|
| spec.md | `/process/spec.md` | Original specification for Synthase |
| typescript-structure.md | `/process/typescript-structure.md` | Initial planned structure for the TypeScript implementation |
| synthase-readme.md | `/process/synthase-readme.md` | Early overview of the project |
| implementation.md | `/process/implementation.md` | Implementation plan and phases |

## Documentation Purpose

### README.md
The main user-facing documentation that explains what Synthase is, its features, and how to use it. It provides installation instructions, command examples, and configuration formats. Start here if you're using Synthase for the first time.

Key sections include:
- Installation instructions
- CLI command usage
- Configuration format
- Tool check and installation methods
- Programmatic API examples

### ARCHITECTURE.md
This document provides a comprehensive overview of Synthase's design and architecture within the Chitin ecosystem. It explains:
- How Synthase relates to the broader Chitin framework
- The major architectural components and their interactions
- How the theoretical architecture maps to the implementation
- The organizational structure of the codebase

Use this document when you need to understand how Synthase works internally, especially when making substantial changes or extensions.

### PROCESS.md
Outlines the development processes and conventions for working on Synthase. It covers:
- How to approach understanding the codebase
- Best practices for making changes
- Project conventions for code style, organization, and documentation
- Testing and documentation requirements

Reference this document when making changes to ensure they align with project conventions.

### CHANGELOG.md
A detailed history of changes to Synthase, organized by component. Each entry includes:
- The component that was changed
- The type of change (Added, Changed, Fixed)
- Specific details about the change
- Files that were modified

Review the CHANGELOG to understand how the project has evolved and to follow the documentation standards when adding your own changes.

## Command Reference

### Configuration Commands

```bash
# config
# Loads and displays the user configuration
bun run src/cli.ts config

# Options:
#   --json, -j         Output as JSON instead of YAML
#   --export-env, -e   Export configuration as environment variables
#   --path <path>, -p  Custom path to user config file
```

### Initialization Commands

```bash
# init
# Initializes the Chitin environment
bun run src/cli.ts init

# Options:
#   --config <path>, -c   Path to user config file
#   --no-tools, -n        Skip tool dependency checking
```

### Fiber Commands

```bash
# fibers
# Manage fibers (top-level modules)
bun run src/cli.ts fibers [subcommand]

# Subcommands:
#   get [name]         Display fiber information (default)
#   list               List all fiber names
#   deps               Show dependency relationships between fibers
#   config <name>      Show configuration for a specific fiber

# Options:
#   --detailed, -d          Show detailed information
#   --base-dirs             Specify additional directories to scan for modules
#   --path <path>, -p       Custom path to user config file
```

### Tool Commands

```bash
# tools
# Manage tool configurations
bun run src/cli.ts tools [subcommand]

# Subcommands:
#   get [name]         Display tool information (default)
#   list               List only tool names (one per line)

# Options:
#   --json, -j              Output as JSON
#   --yaml, -y              Output as YAML
#   --path <path>, -p       Custom path to user config file
#   --parent-config <path>, -P  Path to parent project config.yaml
#   --detailed, -d          Show detailed information for each tool
#   --status                Check if tools are installed
#   --filter-source <src>   Filter tools by source module
#   --filter-check <method> Filter tools by check method
#   --filter-install <method> Filter tools by install method
```

## Finding Documentation

If you're looking for specific information:

1. **How to use Synthase** → README.md
2. **How Synthase works internally** → ARCHITECTURE.md
3. **How to contribute to Synthase** → PROCESS.md
4. **What has changed recently** → CHANGELOG.md
5. **Original project plans** → Parent project process documents
6. **Example configuration** → test-user-config.yaml
7. **Detailed command options** → Command Reference section in this guide
