# Synthase Round 1 Changelog

## Added
- **Project Setup**
  - Initialized Bun+TypeScript project structure
  - Set up package.json with dependencies (js-yaml, commander)
  - Configured TypeScript compilation settings
  - Added ESLint and Prettier for code quality

- **Type System**
  - Created TypeScript interfaces for all configuration objects
  - Added types for tool configurations and validation
  - Implemented utility types for configuration operations

- **Configuration System**
  - Added YAML loading and parsing with js-yaml
  - Implemented path expansion for special paths (~ and localshare)
  - Created configuration merging system with deep merge support
  - Added validation for user, fiber, chain, and tool configurations
  - Improved config output formatting to match original chitin
  - Added support for preserving symbolic path representation

- **Shell Integration**
  - Created environment variable exchange between TypeScript and Bash
  - Implemented file-based environment sourcing mechanism
  - Added utility functions for finding Chitin directory
  - Created environment merging capability
  - Used XDG-compliant cache directory for environment exports
  - Improved boolean environment variables ('true'/'false' format)

- **CLI Implementation**
  - Created `load-config` command with JSON/YAML output options
  - Added environment variable export functionality
  - Implemented configuration validation in CLI
  - Created minimal initialization command with environment setup

- **Testing Framework**
  - Set up Bun's testing environment
  - Added configuration loader tests
  - Created test fixtures and helpers

- **Documentation**
  - Created comprehensive README with usage examples
  - Documented current and target relationship with Chitin
  - Added detailed CLI command documentation
  - Provided programmatic API reference
  - Included configuration format examples

## Files Created
- `src/types/config.ts` - Configuration type definitions
- `src/utils/{file.ts, yaml.ts, path.ts}` - Utility functions
- `src/shell/environment.ts` - Bash interface
- `src/config/{loader.ts, merger.ts, validator.ts}` - Configuration system
- `src/cli.ts` - Command-line interface
- `src/index.ts` - Main entry point and API
- `tests/config/loader.test.ts` - Configuration system tests

## Core Functionality
- Load and validate configuration from YAML files
- Expand path variables in configuration
- Export configuration as environment variables
- Provide both CLI and programmatic API access
- Set up foundation for future rounds of implementation

## Improved
- Updated configuration system to use XDG standard paths (~/.config/chitin)
- Enhanced configuration output to match the original chitin shell format
- Added support for fiber-based configuration structure
- Preserved symbolic path representation (~/Projects, localshare/chezmoi)
- Removed empty objects from configuration output
- Fixed type safety issues with fiber interfaces
- Moved environment exports to XDG cache directory (~/.cache/chitin)
- Changed boolean environment variables to use 'true'/'false' format
