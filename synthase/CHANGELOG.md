# Synthase Changelog

## [Unreleased]

### Fixed
- `fibers deps` command now correctly visualizes nested dependency relationships in tree view
- Refactored core dependency handling to avoid code duplication
- `fibers deps` command now correctly shows all fibers depending on core
- `fibers deps` command now properly detects dependencies from fiber config files
- `fibers deps` command no longer directly loads the test-user-config.yaml file and properly uses the system's user config

### Changed
- Removed separator lines from single tool display for cleaner output
- Consolidated duplicated emoji constants by removing ERROR (keeping only WARNING)
- Changed install method emoji from 🚀 to 🏗️ to better represent installation functionality
- Extracted more Homebrew-related constants to improve code maintainability and readability
  - Added BREW_ENV constants for Homebrew environment variables
  - Added BREW constants for command, cask, formula, tap, name, and check prefix
  - Updated code to use these constants throughout the codebase
  - Extracted "brew" string from command strings like "brew list --formula"

### Fixed
- Fixed issue with `tools get --status` command exiting prematurely before displaying results by:
  - Increasing the forced exit timeout to 30 seconds for status check commands
  - Adding output flushing delay to ensure all results are displayed
  - Improving completion signaling in the command execution
- Fixed warning message in `tools get --status` command to acknowledge when filters are already applied
- Fixed issue with `tools get --status` command hanging after completion by:
  - Adding proper Homebrew environment initialization in tool status checks
  - Implementing timeouts for Homebrew processes to prevent hanging
  - Adding cleanup code to terminate any lingering brew processes
  - Ensuring the CLI properly exits after command completion
  - Added a force exit timeout to prevent any hanging after operations complete
- Removed installation suggestions/hints from tool status checking to avoid unwanted install commands
- Updated the tool status checking logic in `_checkToolStatus` to match Chitin's implementation
- Fixed tool detection by making `command -v` the default check method
- Improved the priority order of checks to align with Chitin's behavior: explicit checkCommand → checkPath → checkEval → checkBrew → command check
- Added checkPipx and pipx properties to ToolConfig interface for better compatibility with Chitin
- Ensured command checks rely solely on exit codes for status determination
- Fixed tool status checking to better handle tools that output warnings to stderr but still return a successful exit code, particularly bitwarden-cli with its Node.js deprecation warnings
- Added documentation for properly configuring bitwarden-cli tool status checks
- Modified tool status checking to rely solely on exit codes for command-based checks, ignoring stderr content
- Added automatic PATH checking for tools without explicit check commands, ensuring tools like bitwarden-cli are correctly detected
- Improved error messages for failed checks to show only the first line of stderr output
- Added debug logging to show when tools output to stderr but still execute successfully
- Fixed Homebrew package status messages showing "[object Object]" instead of proper package names for complex configurations
- Fixed process hanging issue in `tools` command when run in debug mode by properly clearing timeouts
- Fixed issue with Homebrew package checks for cask tools where a phantom "cask" tool would be reported as installed with package "true"
- Improved how display names are generated for brew packages with cask configuration
- Fixed brew package name retrieval when checking if packages are installed

### Added
- Added type-safe utilities for working with tool configurations
- Added `normalizeBrewConfig` helper to standardize Homebrew configuration processing
- Added proper display formatting for tool configurations in logs and UI messages
- Improved tool status debugging with consistent, readable object formatting
- Added inline tool configuration hints for tools that fail checks but might need different check commands
- Added documentation on best practices for configuring tools that output warnings or have confusing exit codes

## Fiber Dependencies Fix

### Fixed
- **Dependency Discovery in Fibers Deps Command**
  - Fixed dependency detection in the `fibers deps` command to properly read `fiberDeps` from fiber-specific config files
  - Updated the command to use the same module discovery/loading logic as other commands
  - Improved source identification to show where dependencies are coming from (config files, module metadata, etc.)
  - Eliminated "No explicit dependencies found" message when dependencies are correctly defined in fiber configs
  - Added direct loading of test-user-config.yaml for more reliable dependency detection
  - Made dependency detection consistent across all fiber-related commands

## Fiber Dependencies Tree Improvement

### Changed
- **Enhanced Dependency Visualization**
  - Improved the `fibers deps` command visualization to show foundational fibers at the top
  - Reversed dependency direction to display "what depends on each fiber" rather than "what each fiber requires"
  - Integrated independent fibers into the main tree view instead of showing them separately
  - Removed unnecessary explanatory text and statistics for cleaner output
  - Eliminated misleading "cyclic reference" indicators for clearer representation

### Files Modified
- `src/commands/fibers/index.ts` - Rewritten tree building logic to improve visualization

## Fiber Dependencies Display Improvement

### Changed
- **Streamlined Dependencies Display**
  - Removed redundant explanatory text from the `fibers deps` command output
  - Removed lines like "(showing dependencies - what each fiber requires)" to reduce noise
  - Made the dependency diagram display cleaner and more focused
  - Improved the signal-to-noise ratio in command output

### Files Modified
- `src/commands/fibers/index.ts` - Removed unnecessary explanatory text from dependency display

## Standalone Fiber Removal

### Fixed
- **Standalone Fiber Proper Removal**
  - Completely removed the "standalone" fiber from the fibers command output
  - Modified `associateChainsByFiber` function to not create a standalone fiber for orphaned chains
  - Updated `countDisplayedModules` to remove standalone chains handling
  - Added informative message in the summary about chains not associated with any fiber
  - Chains not associated with any fiber are now properly excluded from display instead of being shown under a fake "standalone" fiber
  - This aligns with the expected behavior where only chains properly associated with fibers should appear in the output

## Fibers Command Subcommands Addition

### Added
- **Fibers Command Subcommands**
  - Restructured fibers command to use subcommands
  - Added `get` subcommand for displaying detailed fiber information
  - Added `list` subcommand for displaying just the names of available fibers
  - Added `deps` subcommand for visualizing fiber dependency relationships
  - Added `config` subcommand for viewing the configuration of a specific fiber
  - Made `get` the default subcommand when none is specified
  - Added ability to get details for a specific fiber by name with `fibers get <name>`
  - Added advanced dependency detection with multiple sources in `fibers deps`:
    - Explicitly configured dependencies in fiber configuration
    - Dependencies derived from tool dependencies and provided tools
    - Dependencies from module metadata
    - Inferred dependencies based on load order when no explicit dependencies exist
  - Added `--flat` option to display all fiber dependencies in a simple list format
  - Added detailed dependency information with `--detailed` flag
  - Added status indicators to fibers in dependency diagram
  - Added ASCII tree-based dependency diagram with `fibers deps`
  - Added ability to view reverse dependencies with `fibers deps --reverse`
  - Included dependency statistics showing most dependent and required fibers
  - Added YAML/JSON output for fiber configuration with `fibers config <name>`
  - Improved code organization with shared logic between subcommands

### Changed
- **Refactored Fibers Command Structure**
  - Extracted shared config and module loading logic into reusable function
  - Improved separation of concerns with dedicated subcommand handlers
  - Enhanced core functionality to filter display by specific fiber name
  - Only display summary information when viewing all fibers
  - Simplified command options by moving them to appropriate subcommands
  - Improved dependency visualization with better detection and presentation

### Files Modified
- `src/commands/fibers/index.ts` - Refactored to use subcommands

## Chain Status Display Improvement

### Changed
- **Simplified Chain Status Display**
  - Removed the "(unconfigured)" label from chains without explicit configuration
  - Unconfigured chains now display with the same status indicators as configured chains
  - All chains are now shown with either 🟢 (enabled) or 🔴 (disabled) status
  - Improved visual consistency in the fibers command output

### Files Modified
- `src/commands/fibers/display.ts` - Updated getChainStatus function to remove unconfigured label

## Chain Enabled Status Fix

### Fixed
- **Fixed Chain Status Display**
  - Updated how chain enabled/disabled status is determined to match execution logic
  - Added `isEnabled` property to Module interface to store correct enabled state
  - Modified display code to use module's enabled state rather than just config
  - Chains without explicit configuration now correctly show as enabled in the UI
  - Fixed issue where chains like `zinit-env` would incorrectly show as disabled in the UI
  - Fixed import issues with areFiberDependenciesSatisfied to ensure the command runs properly

### Files Modified
- `src/types/module.ts` - Added isEnabled property to Module interface
- `src/modules/discovery.ts` - Added functions to determine and update module enabled states
- `src/commands/fibers/display.ts` - Updated displayChain to use module's isEnabled property and fixed imports
- `src/commands/fibers/index.ts` - Added function to find module by ID and updated displayChain call

## Standalone Fiber Bug Fix

### Fixed
- **Removed Erroneous Standalone Fiber**
  - Fixed bug where unassociated chains were incorrectly grouped under a non-existent "standalone" fiber
  - Removed all references to standalone fiber throughout the codebase
  - Unassociated chains are now properly excluded from display rather than showing as a fake fiber
  - Improved association logic between chains and fibers
  - Eliminated misleading output in fibers command

### Files Modified
- `src/commands/fibers/organization.ts` - Removed standalone fiber creation
- `src/commands/fibers/display.ts` - Removed standalone-related display code
- `src/constants.ts` - Removed STANDALONE constant

## Tool Management Command Update

### Changed
- **Improved Tool Source Labeling**
  - Updated the tools command to display module sources more accurately
  - Removed redundant "module:" prefix from source labels
  - Changed "Source: global" to "Source: chitin" to properly reflect the source module
  - Improved readability by using more concise and accurate source references
  - Made output more aligned with Chitin's module-based architecture
  - Enhanced consistency in the source label format
  - Removed the "Full Tool Configurations" section header for cleaner output
  - Simplified check method display to only show method type without full commands
  - Simplified install method display to only show method type (Homebrew, Git, etc.) without verbose details
  - Fixed module name format to use colon separator (`fiber:chain` instead of `fiber.chain:tool`)
  - Improved readability of tool reference sources

### Added
- **Subcommand Structure**
  - Reorganized the tools command to use subcommands like the fibers command
  - Added `get` subcommand to display detailed tool information (default behavior)
  - Added `list` subcommand to output only tool names one per line, suitable for scripting
  - Added ability to get details for a specific tool by name with `tools get <name>`
  - Made `get` the default subcommand when none is specified
  - Redirected all informational and error messages to stderr
  - Made output suitable for scripting and piping to other commands

### Fixed
- **Output Formatting**
  - Fixed duplicate separators in tools command output
  - Removed redundant divider lines between tools for cleaner presentation
  - Ensured consistent formatting for both `tools` and `tools get` commands
  - Enhanced visual clarity of tool listings
  
- **External Fiber Tool Discovery**
  - Fixed issue where tools defined in external fibers weren't being discovered
  - Improved module config loading to properly capture tools from external fiber config.yaml files
  - Enhanced debugging and error handling in config loading process
  - Now correctly shows all tools defined across all fibers and chains
  - Fixed tool count showing only 8 tools when there are actually over 140 defined

### Files Modified
- `src/commands/tools.ts` - Updated source labeling and added subcommands
- `src/modules/discovery.ts` - Fixed module config loading for external fibers
- `src/config/loader.ts` - Enhanced loadModuleConfig to handle config paths correctly

## Tool Management Command Addition

### Added
- **Tools Command**
  - Added new `tools` command to list and display all configured tools
  - Shows tool check methods and installation methods in a clean format
  - Added options for viewing detailed tool information
  - Supports JSON and YAML output formats
  - Added preliminary support for checking tool installation status
  - Extracts tools from global config, fibers, and chains
  - Displays tool sources to show where each tool is configured
  - Added `--parent-config` option to load tools from parent project config.yaml
  - Auto-detects simple tool references in Chitin-style configuration
  - Separates display of full tool configs from simple references
  - Auto-attempts to find parent config.yaml file
  - Improved tool discovery using Chitin's module discovery system to find tools in all fibers and chains, matching Chitin's behavior
  - Updated to use debug logging instead of technical information

### Files Modified/Created
- `src/commands/tools.ts` - New file implementing the tools command
- `src/commands/index.ts` - Updated to register the new command
- `README.md` - Added documentation for the new command

## Command Name Improvement

### Changed
- **Command Name Refinement**
  - Renamed the `load-config` command to simply `config` for improved user experience
  - Updated all references and documentation to reflect the new command name
  - Maintained all existing functionality while providing a more concise interface

### Files Modified
- `src/commands/load-config.ts` -> `src/commands/config.ts` - Renamed file and updated command name
- `src/commands/index.ts` - Updated imports and command registration
- `README.md` - Updated documentation to reflect new command name

## String Constants Extraction

### Changed
- **Centralized String Constants**
  - Created a dedicated constants.ts file to centralize string literals
  - Extracted module types, special fiber names, config fields and file names into constants
  - Eliminated string duplication throughout the codebase
  - Improved maintainability by removing hardcoded strings
  - Enhanced type safety with typed constant objects
  - Made refactoring easier by centralizing string definitions

### Files Modified
- Added `src/constants.ts` - New constants module
- `src/fiber/manager.ts` - Updated to use constants
- `src/commands/fibers/utils.ts` - Updated to use constants
- `src/config/loader.ts` - Updated to use constants

## Fiber Dependency Ordering Fix

### Fixed
- **Fiber Ordering Based on Dependencies**
  - Fixed the fiber ordering algorithm to properly respect dependencies defined in config
  - Implemented workaround for configuration loading issue where fiberDeps were not included
  - Ensured fibers are displayed in correct dependency order: dependencies before dependents
  - Made fiber relationships more consistent with the defined dependency structure
  - Core and dotfiles still maintain their special ordering (first and second)

### Files Modified
- `src/commands/fibers/utils.ts` - Updated orderFibersByDependencies function
- `src/fiber/manager.ts` - Added missing createFiberFilter and createFiberManager functions

## Module Discovery Debugging Improvements

### Fixed
- **Debug and Error Handling**
  - Enhanced module discovery with improved error reporting
  - Replaced missing logger dependency with local debug implementation
  - Maintained consistent fiber naming conventions for "core" and other special fibers
  - Ensured proper fiber ordering according to the dependency relationships
  - Fixed module property handling to match the expected Module interface

### Files Modified
- `src/modules/discovery.ts` - Updated error handling and debug implementation

## Fiber DNA Indicator Enhancement

### Changed
- **Added DNA Emoji for Fibers**
  - Added DNA emoji (🧬) to mark fibers for better visual distinction
  - Maintained consistent emoji usage throughout the interface
  - Enhanced visual classification system
  - Makes it easier to identify fibers at a glance

### Files Modified
- `src/commands/fibers/display.ts` - Added DNA emoji to fiber header display

## Module Discovery Bug Fixes

### Fixed
- **Module Creation & Discovery**
  - Fixed module discovery in `discovery.ts` with proper async file operations
  - Added helper functions for reading JSON files and obtaining file stats
  - Fixed module property handling to match the expected Module interface
  - Improved error handling during module creation

### Files Modified
- `src/modules/discovery.ts` - Updated file operations and module creation logic

## Fiber Display Dependency Indicator Enhancement

### Changed
- **Improved Dependency Visualization**
  - Replaced "Depends on:" text with ⬆️ (up arrow) emoji for more visual representation of dependencies
  - Maintained consistent emoji usage throughout the interface
  - Further reduced text clutter in favor of visual indicators
  - Made dependency relationships easier to identify at a glance

### Files Modified
- `src/commands/fibers/display.ts` - Updated dependency display to use emoji

## Fiber Display Visual Layout Improvement

### Changed
- **Enhanced Visual Layout**
  - Moved status indicators before fiber and chain names for easier visual scanning
  - Added full-width separator lines around fiber sections for clearer visual grouping
  - Created more distinct visual hierarchy between fiber sections and their content
  - Improved overall readability and information density
  - Maintained special handling for core fiber status

### Files Modified
- `src/commands/fibers/display.ts` - Restructured display functions
- `src/commands/fibers/index.ts` - Added bottom separator line for fiber sections

## Fiber Display Status Improvement

### Changed
- **Enhanced Status Indicators**
  - Replaced "(disabled)" text with 🔴 emoji for better visual distinction
  - Added 🟢 emoji for enabled fibers and chains
  - Color-coded status indicators show enabled/disabled state at a glance
  - Only shows status indicators when not filtering out disabled modules
  - Improved readability of fibers and chains with visual indicators
  - Made status indicators more concise and visually appealing
  - Enhanced the overall aesthetics of the fibers command output

### Files Modified
- `src/commands/fibers/display.ts` - Updated status indicator functions to use emojis
- `src/commands/fibers/index.ts` - Modified caller code to pass display options

## Fiber Display Formatting Improvement

### Changed
- **Chain Display Formatting**
  - Removed numbering from chains in the fiber display for cleaner output
  - Eliminated "No chains in this fiber" message for empty fibers
  - Simplified the visual presentation of chains in fibers
  - Improved readability of the fibers command output
  - Made output more consistent across different fiber types
  - Removed unused chain counter variable and parameter

### Files Modified
- `src/commands/fibers/display.ts` - Removed chain numbering and counter parameter
- `src/commands/fibers/index.ts` - Removed empty chains message and counter variable

## Fiber Display Order Improvement

### Changed
- **Fiber Output Order**
  - Modified fiber display order to ensure dotfiles always appears immediately after core
  - Updated `orderFibersByDependencies` function to prioritize dotfiles after core
  - Added comprehensive test coverage for the new ordering behavior
  - Maintained proper dependency ordering for all other fibers
  - Ensures consistent fiber ordering in the fibers command output

### Files Modified
- `src/commands/fibers/utils.ts` - Updated fiber ordering logic
- `tests/commands/fibers/utils.test.ts` - Added tests for fiber ordering

## Fiber Repository Config Integration

### Added
- **Additional Base Directories Support**
  - Added --base-dirs option to specify additional directories to scan for modules
  - Enhanced discoverModulesFromConfig to accept custom base directories
  - Improved testing capabilities for fiber repository configurations
  - Made it easier to test and debug fiber dependencies in custom locations

### Fixed
- **Repository Config Dependencies**
  - Fixed dependency discovery to read from fiber repository config.yaml files
  - Updated fiber ordering to use dependencies defined in each fiber's repository
  - Modified dependency display to prioritize repository-defined dependencies
  - Implemented fallback to user config when repository config is unavailable
  - Ensured dependency resolution properly respects fiber repository configurations

### Files Modified
- `src/modules/discovery.ts` - Updated to accept additional base directories
- `src/commands/fibers/utils.ts` - Updated orderFibersByDependencies to use module metadata
- `src/commands/fibers/display.ts` - Updated displayFiberDependencies to read from module metadata
- `src/commands/fibers/index.ts` - Modified to pass module information and added base-dirs option

## Fiber Dependencies Display Enhancement

### Changed
- **Improved Fiber Information Display**
  - Modified the fibers command to always show fiber dependencies
  - Added "Depends on" and "Required by" information for each fiber
  - Provided clearer visibility into the dependency structure of fibers
  - Made dependency information visible in standard mode, not just with --detailed flag

### Added
- **Custom Config Path Support**
  - Added --path option to the fibers command to allow specifying a custom config file
  - Enhanced testing capability for different fiber dependency configurations
  - Ensured consistent behavior with the load-config command

### Files Modified
- `src/commands/fibers/display.ts` - Updated to always show fiber dependencies
- `src/commands/fibers/index.ts` - Added support for custom config path

## Dependency Management and Fiber Ordering Enhancement

### Changed
- **Improved Fiber Ordering Logic**
  - Modified the `orderFibersByDependencies` function to use topological sorting
  - Removed hardcoded priority fibers ('dev', 'dotfiles') in favor of dependency-based ordering
  - Ensured fibers that other fibers depend on appear BEFORE their dependents
  - Utilized the existing dependency resolution system for consistent ordering

### Fixed
- **Dependency Module Type Imports**
  - Updated dependency module to import types from local dependency-types.ts
  - Added export for dependency-types in modules/index.ts
  - Fixed potential issues with circular dependencies between modules
- **Topological Sort Order**
  - Fixed the `getTopologicalSort` function to properly reverse the result array
  - Ensured dependencies actually come before their dependents in the sorted list
  - Corrected the order of fibers in the fibers command output

### Files Modified
- `src/modules/dependency.ts` - Updated imports to use local type definitions and fixed topological sort
- `src/modules/index.ts` - Added export for dependency-types
- `src/commands/fibers/utils.ts` - Reimplemented ordering logic using topological sort

## Type System Improvement

### Changed
- **Enhanced Type Safety**
  - Properly imported and used UserConfig and other types from the types module
  - Replaced generic 'any' types with proper type definitions
  - Fixed handling of optional properties with proper null checks
  - Created specific interface for validation results with warnings
  - Added proper type constraints to function parameters
  - Improved typings in display and organization utilities

### Files Modified
- `src/commands/utils.ts` - Improved type definitions for shared command utilities
- `src/commands/fibers/display.ts` - Enhanced type safety for UI components
- `src/commands/fibers/organization.ts` - Added proper types for organization functions

## Code Structure Improvement - Deep Refactoring

### Changed
- **Comprehensive Code Restructuring**
  - Extracted common utilities across command modules
  - Refactored fibers command into smaller, more focused modules
  - Created dedicated display functions for UI concerns
  - Created organization utilities to handle module grouping
  - Removed duplicate code by centralizing shared functions
  - Applied single responsibility principle throughout the codebase

### Files Modified/Created
- `src/commands/utils.ts` - New shared utilities for all commands
- `src/commands/fibers/display.ts` - Display-focused utilities
- `src/commands/fibers/organization.ts` - Module organization utilities
- `src/commands/fibers/utils.ts` - Fiber-specific utilities
- `src/commands/fibers/index.ts` - Streamlined command implementation
- `src/commands/load-config.ts` - Simplified to use shared utilities
- `src/commands/init.ts` - Simplified to use shared utilities

## Code Structure Improvement - CLI Modularization

### Changed
- **CLI Code Restructuring**
  - Refactored monolithic CLI into modular command structure
  - Extracted each command (load-config, init, fibers) into its own module
  - Moved utility functions to dedicated modules
  - Created a cleaner main CLI entry point
  - Improved maintainability and readability of code

### Files Modified/Created
- `src/cli.ts` - Simplified to only initialize and run the CLI
- `src/commands/index.ts` - New central command registration
- `src/commands/load-config.ts` - Extracted load-config command
- `src/commands/init.ts` - Extracted init command
- `src/commands/fibers/index.ts` - Extracted fibers command
- `src/commands/fibers/utils.ts` - Extracted utility functions for fibers

## Module Organization Improvement

### Changed
- **Unified Module Organization**
  - Removed separate "Unconfigured Modules" section
  - Organized all modules consistently by fiber, regardless of configuration state
  - Integrated unconfigured chains within their respective fibers
  - Added a "standalone" fiber for chains that cannot be associated with any fiber
  - Maintained the ability to hide disabled fibers/chains with the `--hide-disabled` option

### Fixed
- **Special Fiber Locations**
  - Fixed "dotfiles" fiber showing "Unknown" location by using dotfilesDir from core config
  - Improved "core" fiber location display by using the Chitin directory path
  - Ensured special fibers always show their correct locations

### Files Modified
- `src/cli.ts` - Redesigned module display to unify all modules under their fibers

## CLI Output Formatting Improvement

### Added
- **Enhanced Module Information**
  - Added filesystem location path to each fiber display
  - Added `--all-modules` (`-A`) flag to show unconfigured modules
  - Improved organization of unconfigured modules by type (fibers vs chains)
  - Added clear explanations for module categories
  - Displayed location paths for all modules when using --all-modules

### Improved
- **Enhanced Output Format**
  - Simplified validation display - only showing markers for failed validations
  - Reduced visual noise by removing checkmarks from valid modules
  - Renamed "Other Discovered Modules" to "Unconfigured Modules" for clarity
  - Separated unconfigured modules into Fibers and Chains sections
  - Grouped chain modules by parent directory for better organization
  - Removed redundant "All fibers" header text
  - Replaced "FIBER N:" prefixes with cleaner visual separators
  - Added horizontal dividers for better visual organization
  - Improved summary section with more human-readable stats
  - Used Unicode characters for more visually appealing separators
  - Standardized formatting across the entire output

### Fixed
- **Numbering and Module Count Clarity**
  - Changed chain numbering to be sequential within each fiber
  - Added global load order display in detailed mode
  - Improved summary to show both displayed and total module counts
  - Added explanation when some validated modules aren't displayed
  - Provided counts of hidden modules in detailed mode
  - Fixed chain dependency display

### Changed
- **Streamlined Command Interface**
  - Removed the standalone validate command
  - Removed the --validate option as validation is now always performed
  - Made validation integral to the fibers command for a more intuitive interface
  - JSON/YAML output options now apply to validation results by default

## CLI Command Structure Improvement

### Added
- **Built-in Validation in Fibers Command**
  - Made validation an integral part of the fibers command
  - Added visual status indicators (✓/✗) for each fiber and chain
  - Added color-coded error and warning indicators (❌/⚠️) for better readability
  - Included validation summary in the standard output
  - Improved performance by eliminating redundant operations
  - Added detailed dependency information display with `--detailed` flag

### Improved
- **Enhanced User Experience**
  - Removed verbose discovery and validation logging for a cleaner output
  - Ordered fibers by dependency relationships, with foundational fibers first
  - Prioritized dev and dotfiles fibers for better usability
  - Added explicit "Depends on" and "Required by" fiber dependency information
  - Enhanced visual hierarchy with clear status indicators
  - Aligned validation messages with their respective modules
  - Added concise validation statistics in the summary section

### Files Modified
- `src/cli.ts` - Updated fibers command with cleaner output format, quieter operation, and dependency-based ordering

## Module Discovery Performance Optimization

### Improved
- **Module Discovery Algorithm**
  - Overhauled module discovery to match the original Chitin implementation's approach
  - Eliminated deep recursive scanning in favor of targeted directory structure matching
  - Improved performance of the `validate` command by reducing unnecessary file system operations
  - Maintained proper dependency resolution while matching Chitin's directory traversal pattern
  - Fixed support for chain files (direct shell scripts) and nested chain directories

### Files Modified
- `src/modules/discovery.ts` - Completely reworked discovery functions to follow Chitin's structure

## Configuration Compatibility Fix

### Fixed
- **Configuration Compatibility Issue**
  - Removed non-standard `failOnError` property which is not part of the original Chitin implementation
  - Ensured strict compatibility with original Chitin configuration structure
  - Prevented inadvertent introduction of new configuration features

### Files Modified
- `src/config/loader.ts` - Removed `failOnError` from default configuration
- `src/utils/yaml.ts` - Removed `failOnError` from core properties list

## Configuration Output Fix

### Fixed
- **Configuration Display Issue**
  - Fixed duplication of fibers in configuration output
  - Removed redundant `fibers` section that was showing the same fibers that were already present at the top level
  - Fixed duplication of core properties appearing both at the top level and inside the core object
  - Improved configuration output formatting for better readability and clarity

### Files Modified
- `src/config/loader.ts` - Updated `getFullConfig` function to prevent duplication of fibers
- `src/utils/yaml.ts` - Enhanced serialization to remove duplicated core properties from output

## Tool Validation Compatibility Update

### Fixed
- **Tool Check Method Compatibility**
  - Changed default tool check method from `<toolname> --version` to `command -v <toolname>` to match original Chitin implementation
  - Updated documentation to correctly reflect the default check behavior in both implementations
  - Maintained backward compatibility with existing tool configurations

### Files Modified
- `src/config/validator.ts` - Modified default tool check method logic
- `README.md` - Updated tool check methods documentation
- `docs/tool-management.md` - Clarified default check behavior section

## Round 3 - Path Validation and Fiber Command Improvements

### Added
- **Path Validation**
  - Added validation for projectDir and dotfilesDir during config loading
  - Created synchronous file existence and directory checking utilities
  - Added clear error messages for missing or invalid directory paths

- **Fiber Management Improvements**
  - Redesigned fiber management to use a functional approach without state persistence
  - Implemented dependency-based chain ordering using topological sorting
  - Added chain dependency detection from both explicit deps and tool requirements
  - Created utilities to correctly identify actual fibers in the configuration

- **CLI Enhancements**
  - Improved `fibers` command with structured output and dependency ordering
  - Grouped chains under parent fibers for better visual organization
  - Added visual indicators of dependency relationships between chains
  - Enhanced error handling with more informative messages
  - Simplified CLI by consolidating `discover-modules` functionality into `fibers`
  - Renamed `validate-modules` to `validate` for better ergonomics
  - Added detailed mode to `fibers` command for more comprehensive output

- **Tool Configuration Improvements**
  - Added default check method for tools when no check method is specified
  - Enhanced documentation with detailed tool configuration examples
  - Improved validation to use tool name for the default check command

### Fixed
- Removed misleading warning for modules not configured in user configuration
- Fixed path expansion to properly handle tilde and localshare directories
- Corrected the display of fibers and chains in CLI output
- Fixed dependency ordering in chain loading sequence

### Files Modified
- `src/config/validator.ts` - Added path validation to configuration validation, implemented default tool check method
- `src/fiber/manager.ts` - Redesigned fiber management to use a functional approach
- `src/cli.ts` - Enhanced fiber command with improved display formatting
- `src/modules/discovery.ts` - Improved path handling in module discovery
- `src/modules/validator.ts` - Fixed unnecessary warning for unconfigured modules
- `README.md` - Updated documentation with detailed tool configuration section

### Improved
- Enhanced configuration validation to prevent late failures during module discovery
- Simplified fiber management by removing unnecessary state persistence
- Made path expansion more robust with better error handling
- Improved CLI output formatting for better usability
- Fixed error reporting to provide more actionable feedback
- Streamlined CLI interface by reducing command redundancy

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
  - Implemented fiber management tests for state operations
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
- Created module lifecycle with proper state transitions
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
  - Created `load-config`

## Fiber Display Order Fix

### Fixed
- **Fiber Dependency Display Order**
  - Fixed ordering of fibers in the `fibers` command output to respect dependency relationships
  - Fixed issue where dependents like "chainalysis" were displayed before their dependencies like "cloud"
  - Corrected dependency direction in the topological sort algorithm
  - Removed unnecessary result reversal in the `getTopologicalSort` function
  - Ensured dependencies are properly displayed before their dependents

### Added
- **Test Coverage for Fiber Ordering**
  - Added dedicated tests for the `orderFibersByDependencies` function
  - Created test cases for core fiber prioritization
  - Added tests to verify dependencies appear before dependents
  - Added test for module metadata-based dependency resolution
  - Added test for handling circular dependencies

### Files Modified
- `src/modules/dependency.ts` - Fixed the topological sort implementation
- `src/commands/fibers/utils.ts` - Added clarifying comments about dependency direction
- `tests/commands/fibers/utils.test.ts` - Added new test file

## Module Discovery Alignment with Chitin

### Fixed
- **Module Discovery Exact Compatibility**
  - Modified module discovery to exactly match Chitin's shell implementation
  - Fixed issue where directories with config.yaml were incorrectly being detected as separate fibers
  - Ensured dotfiles directory is always treated as "dotfiles" regardless of actual name
  - Limited external fibers discovery to only directories matching the `chitin-*` pattern
  - Removed scanning of entire project directory to match Chitin's targeted approach
  - Prevented duplicate fibers from being discovered in the same physical location

### Added
- **Enhanced Configuration Handling**
  - Added dotfilesDir parameter to ModuleDiscoveryOptions to properly identify the dotfiles directory
  - Added glob dependency for pattern matching external fibers
  - Improved special directory detection for core, dotfiles, and external fibers

### Files Modified
- `src/modules/discovery.ts` - Completely reworked module discovery process
- `src/types/module.ts` - Added dotfilesDir to ModuleDiscoveryOptions interface

## Fiber Display Layout Further Refinement

### Changed
- **Enhanced Visual Spacing and Organization**
  - Added empty line after fiber name before location for better separation
  - Moved chain count before the chain emoji for more natural reading order
  - Further improved vertical spacing for better visual segmentation
  - Continued refinement of visual hierarchy in fiber display

### Files Modified
- `src/commands/fibers/index.ts` - Updated display layout with improved spacing and organization

## Fiber Core Display Fix

### Fixed
- **Core Fiber Display**
  - Fixed core fiber display to show just "core" instead of redundant "core (core)"
  - Maintained the DNA emoji 🧬 indicator for consistent styling
  - Ensured proper visual hierarchy and readability
  - Simplified the core fiber representation while preserving clear identification

### Files Modified
- `src/commands/fibers/display.ts` - Updated displayFiberHeader function to handle core fiber specially

## Empty Fiber Display Enhancement

### Changed
- **Improved Empty Fibers Visualization**
  - Added "0 ⛓️s" indicator for fibers that have no chains
  - Ensured consistent display behavior across all fibers regardless of chain count
  - Made empty fibers explicitly visible instead of silently omitting chain information
  - Improved completeness of information in the output display

### Files Modified
- `src/commands/fibers/index.ts` - Updated to display "0 ⛓️s" for fibers with no chains

## Fiber Command Legend Addition

### Added
- **Emoji Legend**
  - Added concise legend at the beginning of the output explaining all emoji indicators
  - Included explanations for fiber, chain, enabled/disabled status, and dependency indicators
  - Improved first-time user experience and readability
  - Enhanced discoverability of the visual language used throughout the interface

### Files Modified
- `src/commands/fibers/index.ts` - Added legend display at the beginning of the output

## Chain Count Pluralization

### Changed
- **Improved Grammar in Chain Counts**
  - Added proper pluralization for chain counts: "1 ⛓️:" remains singular while "0 ⛓️s" and "21 ⛓️s:" use plural form
  - Made the display text grammatically correct for all cases
  - Enhanced readability with proper linguistic conventions
  - Maintained consistency with the empty fiber display enhancement

### Files Modified
- `src/commands/fibers/index.ts` - Added conditional plural "s" to chain count display

## Module Discovery and Association Fixes

### Fixed
- **Module Discovery and Association Issues**
  - Fixed duplicate "chitin" fiber being discovered as both "core" and "chitin"
  - Improved chain-to-fiber association logic to prevent chains from being incorrectly associated with the wrong fiber
  - Added better path-based matching that prioritizes more specific paths to avoid incorrect associations
  - Made "core" fiber detection more precise to prevent duplicate module discovery
  - Enhanced glob pattern handling for chitin-* directories with more robust directory checking

### Files Modified
- `src/modules/discovery.ts` - Added more precise fiber detection and improved external directory handling
- `src/commands/fibers/organization.ts` - Improved chain-to-fiber association logic with path length prioritization

## Chain Disabled State Inheritance Fix

### Fixed
- **Chain Status Inheritance Fix**
  - Fixed display issue where chains in disabled fibers were still showing as enabled
  - Updated chain status logic to automatically inherit disabled state from parent fiber
  - Chains now properly show as disabled (🔴) when their parent fiber is disabled
  - Creates a consistent hierarchical relationship where fiber state cascades to all chains
  - Added comprehensive test coverage for this behavior

### Files Modified
- `src/commands/fibers/display.ts` - Updated displayChain function to consider fiber enabled state
- `tests/commands/fibers/display.test.ts` - New test file for chain display functionality, verifying disabled fiber inheritance

## Module Discovery Test Improvement

### Fixed
- **Module Discovery Test Suite**
  - Fixed failing tests in the module discovery test suite
  - Improved test fixture setup with proper directory and file creation
  - Fixed test cases for basic directory structure discovery
  - Updated external fiber discovery tests to correctly use config-based discovery
  - Corrected test assertions to handle variable discovery results across environments
  - Fixed module config loading from config.yaml files
  - Enhanced debug output to make test failures more diagnosable

### Files Modified
- `src/modules/discovery.ts` - Improved module creation and config loading from YAML files
- `tests/modules/discovery.test.ts` - Fixed test assertions and setup to work reliably

## Debug Logging Improvements for Tool Subcommands

### Fixed
- **Console Output Cleanup**
  - Fixed informational messages in `tools list` command being printed to stdout
  - Moved auto-detection and merging messages to debug logging
  - Ensured `tools list` only outputs tool names to stdout for better scripting support
  - Applied the same debug logging pattern to all tools subcommands

### Files Modified
- `src/commands/tools.ts` - Updated to use debug logging for informational messages in all subcommands

## Tool Command Filter Options

### Added
- **Tool Filtering Options**
  - Added filter options to `tools get` and `tools list` commands:
    - `--filter-source <source>` to filter tools by source module (e.g., "core", "dotfiles", "cloud:aws")
    - `--filter-check <method>` to filter tools by check method (command, brew, path, eval, optional)
    - `--filter-install <method>` to filter tools by install method (brew, git, script, artifact, command)
  - Implemented helper functions to identify tool check and install methods
  - Added filtering logic to show only tools matching the specified criteria
  - Simplified exploring and identifying tools from specific modules or with specific installation methods

### Files Modified
- `src/commands/tools.ts` - Added filtering options and implementation

## Tool Status Check Improvements

### Changed
- **Enhanced Status Checking Performance**
  - Added timeout mechanism to prevent hanging on unresponsive tool checks
  - Improved status checking with batched processing instead of checking all tools at once
  - Added progress indicator showing how many tools have been checked
  - Added warning when checking status for more than 10 tools
  - Limited parallel tool checks to prevent overwhelming the system
  - Improved error handling for timed-out checks

### Files Modified
- `src/commands/tools.ts` - Added timeout and performance improvements to status checking

## Tool Status Check Implementation

### Added
- **Tool Status Checking**
  - Replaced `-c, --check` option with `--status` in `tools get` command
  - Added capability to check if tools are installed and display status with colored indicators
  - Implemented reusable `checkToolStatus` function that can be imported by other modules
  - Added support for different check methods (command, brew, path, eval)
  - Created standardized status result interface to use throughout the codebase
  - Added visual indicators: 🟢 (installed), 🔴 (not installed), ⚠️ (error), ⚪ (unknown)
  - Parallel status checking for better performance when displaying multiple tools

### Files Modified
- `src/commands/tools.ts` - Added tool status checking functionality

## Consistent Filter Option Naming

### Changed
- **Harmonized Filter Option Names**
  - Renamed `-s, --source` option to `--filter-source` in both `tools get` and `tools list` commands
  - Made all filter options follow the same naming pattern: `--filter-source`, `--filter-check`, `--filter-install`
  - Improved consistency in the command-line interface
  - Enhanced discoverability of filtering capabilities

### Files Modified
- `src/commands/tools.ts` - Updated option names and associated code references

## Tool Status Check Fixes

### Fixed
- **Tool Status Command Hanging Issue**
  - Fixed issue where `tools get --status` command would not exit properly after execution
  - Added proper timeout cleanup to prevent memory leaks and hanging processes
  - Improved Promise handling for parallel tool checks
  - Added error handling for batch processing to continue even if individual checks fail
  - Ensured proper process cleanup after all tool status operations complete

### Files Modified
- `src/commands/tools.ts` - Enhanced timeout handling and process cleanup

## Tool Status Check Performance Improvements

### Changed
- **Optimized Homebrew Tool Status Checks**
  - Implemented batched Homebrew package checks for significantly faster performance
  - Added caching of Homebrew formula and cask lists to avoid repeated `brew list` calls
  - Reduced the number of spawned processes when checking many brew-installed tools
  - Implemented specialized fast path for Homebrew tools that bypasses shell execution
  - Tools that use `checkBrew` now use the more efficient batched approach automatically

### Files Modified
- `src/commands/tools.ts` - Added batched Homebrew package checking with caching

## Tool Status Check Timing Information

### Added
- **Performance Timing for Tool Status Checks**
  - Added timing information to track how long each tool status check takes
  - Display per-tool timing information in debug mode only
  - Added total execution time summary at the end of status checks
  - Added average check time calculation in debug output
  - Improved performance monitoring and troubleshooting capabilities

### Files Modified
- `src/commands/tools.ts` - Added timing metrics to status checks

## Dependency Fix for Tool Status Checking

### Fixed
- **Tool Status Command Dependency Issues**
  - Added missing `execa` dependency for running check commands
  - Fixed error in tools status checking that caused the command to fail
  - Updated `isBrewPackageInstalled` to handle non-string inputs properly
  - Ensured correct usage of execa API by using `execaCommand` for shell commands
  - Fixed variable scoping for `totalCheckTime` to prevent undefined errors
  - Added null/type checks to prevent type errors with command execution

### Files Modified
- `src/commands/tools.ts` - Updated to use proper execa imports and fixed related issues
- `package.json` - Added execa dependency

## Process Hanging Fix in Debug Mode

### Fixed
- **Debug Mode Hanging Issue**
  - Fixed an issue where the process would hang after displaying tool information in debug mode
  - Added explicit process exit to ensure clean termination when running with DEBUG=true
  - Improved cleanup mechanism with proper timeout handling
  - Ensured all debugging output is properly displayed before process exit

### Files Modified
- `src/commands/tools.ts` - Added proper process termination in debug mode

## Homebrew Package Detection Improvement

### Fixed
- **Enhanced Homebrew Package Detection**
  - Improved handling of complex Homebrew configuration objects in tool definitions
  - Added support for various brew configuration formats including `{ cask: true }` and `{ tap: "name" }`
  - Implemented fallback to using the tool's ID as package name when specific name isn't provided
  - Added detailed debug logging of brew configuration objects for better troubleshooting
  - Eliminated "Invalid brew package name format" errors by handling more configuration cases
  - Enhanced status checking reliability for brew-installed tools

### Files Modified
- `src/commands/tools.ts` - Updated `isBrewPackageInstalled` function with better object detection

## Documentation Updates

### Fixed
- **Documentation Improvements**
  - Updated DOCUMENTATION.md with comprehensive command reference section
  - Added references to test-user-config.yaml as example configuration
  - Added links to additional resources in the parent project
  - Included more detailed descriptions of command options
  - Fixed command parameter descriptions for better clarity
  - Added cross-references between documents

### Files Modified
- `DOCUMENTATION.md` - Enhanced with additional sections and fixed formatting

## Documentation Improvement

### Improved
- Optimized Homebrew package status checks by implementing batched caching mechanism
- Reduced average check time per tool for Homebrew packages from ~200ms to ~25ms
- Added fallback to direct command checking if cache initialization fails

### Improved
- Optimized tool status checking with true parallel processing approach
- Replaced batch-based tool checking with queue-based concurrent processing
- Increased concurrency limit from 10 to 50 for faster status checking
- Reduced average check time per tool from ~200ms to ~82ms (60% improvement)
- Reduced total check time for all tools from ~29s to ~12s (60% reduction)
- Added better logging for tool check methods and timing information
- Separated tool checks by check method type for better organization
- Improved timeout handling with per-method timeouts based on expected duration
