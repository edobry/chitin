# Synthase Changelog

## Round 2 - Module System and Fiber Management

### Added
- **Module System**
  - Implemented module discovery with directory traversal and config detection
  - Added dependency resolution with topological sorting and circular dependency detection
  - Created module validation against configuration schemas with detailed error reporting
  - Implemented module loading with proper lifecycle management and dependency handling
  - Added module state persistence and history tracking for load counts and errors
  - Implemented generic dependency graph with strong typing support

- **Fiber Management**
  - Created fiber activation/deactivation functionality with state management
  - Implemented fiber state persistence to XDG cache directory
  - Added event system for fiber state changes (activation, deactivation, registration)
  - Implemented filtering modules based on fiber state for selective loading
  - Added support for fiber-based module organization

- **Command Line Interface Extensions**
  - Added `discover-modules` command with JSON/YAML output options
  - Added `validate-modules` command with detailed validation reporting
  - Created `fibers` command for fiber management (list, activate, deactivate)
  - Improved error handling and user feedback in CLI commands

- **Testing Infrastructure**
  - Added module discovery tests with fixture generation
  - Created dependency resolution tests for graph operations and cycle detection
  - Implemented fiber management tests for state operations and event handling
  - Added fixtures for testing with realistic module configurations

### Files Created
- `src/types/module.ts` - Module system type definitions
- `src/types/dependency.ts` - Dependency graph type definitions
- `src/types/fiber.ts` - Fiber management type definitions
- `src/modules/discovery.ts` - Module discovery implementation
- `src/modules/dependency.ts` - Dependency resolution implementation
- `src/modules/loader.ts` - Module loading implementation
- `src/modules/validator.ts` - Module validation implementation
- `src/modules/state.ts` - Module state persistence
- `src/modules/index.ts` - Module system exports
- `src/fiber/manager.ts` - Fiber management implementation
- `src/fiber/index.ts` - Fiber system exports
- `tests/modules/discovery.test.ts` - Module discovery tests
- `tests/modules/dependency.test.ts` - Dependency resolution tests
- `tests/fiber/manager.test.ts` - Fiber management tests
- `tests/fixtures/modules/*` - Test fixtures for module testing

### Improved
- Enhanced error handling in file utilities with better error messages
- Improved path handling with filesystem abstractions for cross-platform support
- Updated main exports to expose new functionality with backward compatibility
- Refactored configuration output for better display and organization
- Fixed file existence detection for better cross-platform support
- Optimized directory scanning with recursive depth control
- Improved test reliability with better fixture handling

### Technical Details
- Implemented a generic dependency graph with topological sorting algorithm
- Added circular dependency detection using depth-first search
- Created event-based module lifecycle with proper state transitions
- Implemented persistent state storage using JSON serialization
- Added file system abstraction layer to handle platform differences
- Created module type detection based on directory structure and config
- Implemented comprehensive module validation with detailed error reporting

## Round 1 - Project Setup and Configuration System

### Added
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

### Files Created
- `src/types/config.ts` - Configuration type definitions
- `src/utils/{file.ts, yaml.ts, path.ts}` - Utility functions
- `src/shell/environment.ts` - Bash interface
- `src/config/{loader.ts, merger.ts, validator.ts}` - Configuration system
- `src/cli.ts` - Command-line interface
- `src/index.ts` - Main entry point and API
- `tests/config/loader.test.ts` - Configuration system tests

### Improved
- Updated configuration system to use XDG standard paths (~/.config/chitin)
- Enhanced configuration output to match the original chitin shell format
- Added support for fiber-based configuration structure
- Preserved symbolic path representation (~/Projects, localshare/chezmoi)
- Removed empty objects from configuration output
- Fixed type safety issues with fiber interfaces
- Moved environment exports to XDG cache directory (~/.cache/chitin)
- Changed boolean environment variables to use 'true'/'false' format 
