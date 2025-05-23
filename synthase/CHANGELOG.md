# Synthase Changelog

## [Unreleased]

### Fixed
- Fixed issue where the base `tools get` command without `--status` hangs for a few seconds at the end by conditionally initializing the shell pool only when needed for status checks
- Fixed issue where warning about checking many tools is displayed twice in `tools get --status` command
- Fixed duplicate implementation of `_checkToolStatus` function that was causing type errors and inconsistent behavior
- Resolved TypeScript errors with configurable command checks by properly handling string/boolean type checking
- Fixed compatibility issues in `handleGetStatusCommand` by correctly handling ModuleDiscoveryResult type
- Fixed issue where status check timing summary appears twice when running `tools get --status` command
- Fixed TypeScript errors in src/index.ts related to ambiguous re-exports
- Fixed import.meta comparison in src/index.ts by using the correct property
- Fixed import with .ts extension that wasn't allowed by TypeScript
- Fixed spacing issue with the Install label in tools status display and legend
- Fixed `tools` command to display help information instead of running the `get` command's logic when no subcommand is provided
- Fixed duplicate status checking in `tools get --status` command by removing redundant checking code in ui.ts
- Fixed status display in `tools get --status` command to properly show the status of each tool
- Fixed duplicate progress indicator in `tools get --status` command by properly handling pre-computed status results
- Fixed `tools get --status` command appearing to hang when checking many tools by:
  - Using dedicated non-interactive execution for status check commands
  - Adding environment variables to prevent tools from trying to read from TTY
  - Fixing stdin handling to properly redirect stdin to /dev/null
  - Properly separating command check executions from the shared shell pool
  - Implementing parallel tool status checking with configurable concurrency
- Fixed import of `loadConfigAndModules` function in deps-command.ts to use the correct module
- Fixed display issue in `fibers deps` command where only the core fiber was displayed in the tree view
- Fixed `fibers deps --json` command to include proper fiber IDs in the orderedFibers array instead of numeric indices
- Fixed GraphViz output in `fibers deps --graphviz` to properly use comma-separated style attributes instead of space-separated ones, resolving "unsupported style" warnings
- Fixed redundant connections in GraphViz dependency diagrams by optimizing the core dependency handling algorithm:
  - Now only adds direct core dependencies to top-level fibers rather than all fibers
  - Creates cleaner and more intuitive dependency visualizations
  - Preserves the dotfiles→core dependency as a special case
  - Prevents duplicate paths that create unnecessary visual complexity
  - Added unit tests to verify correct handling of transitive dependencies
- Restored original display format for `fibers deps` command while adding JSON output support
- Fixed fiber dependency ordering in `fibers get` command to properly display dependencies before dependents:
  - Implemented complete topological sorting algorithm to ensure correct ordering
  - Fixed critical bug where fibers were appearing before their dependencies
  - Ensured special cases like 'core' and 'dotfiles' maintain their special ordering
  - Now fibers like 'oplabs' correctly appear after 'cloud' when they depend on it
- Unified dependency detection logic between `fibers deps` and `fibers get` commands:
  - Both commands now use the same advanced dependency detection from the dependency graph
  - The `get` command now shows the same rich dependency information as the `deps` command
  - Fibers are now consistently ordered with dependencies before dependents in both commands
  - Tool-derived dependencies and other advanced dependency sources are now detected in both commands
- Improved performance of `tools get --status` command by:
  - Removed special case handling for certain command types (command -v, --version, gpg, bw) to consistently use the shell pool
  - Reduced default tool check timeout from 1500ms to 800ms
  - Increased default concurrency from 20 to 50 parallel checks
  - Extended cache expiration from 10 to 60 minutes
- Fixed issue with Docker and other tools using `checkCommand: true` which was incorrectly converted to a string "true" command instead of using the proper default check command
- Fixed all test errors in `synthase/tests/commands/fibers/deps-command.test.ts` by switching from `vi.mock` to Bun's `mock.module` for module mocking.
- Updated test mocking to use a dynamic implementation pattern compatible with Bun's test runner.
- All tests now pass with Bun, and linter errors related to mocking are resolved.

### Improved
- Refactored tools display code to use emoji constants from DISPLAY.EMOJIS instead of hardcoded values
- Consolidated Homebrew code by removing deprecated utility functions and deleted redundant `utils/tool-config.ts` file
- Reorganized domain-specific utilities to improve co-location and maintainability:
  - Moved Homebrew tool utility functions from `commands/tools/homebrew.ts` to `utils/homebrew.ts`
  - Merged `utils/tool-status.ts` into `utils/tools.ts` to consolidate tool status management
  - Updated ToolConfig interface to add `tool` and `app` properties for more explicit tool checks
  - Added improved performance batch status checking with concurrency control
- Improved tools command output by grouping tools by source
- Added summary statistics showing tool counts by status and source
- Refactored fibers command to improve maintainability and reduce code size:
  - Split each subcommand (get, list, deps, config) into its own module
  - Extracted shared functionality to a dedicated shared module
  - Reduced file size and improved separation of concerns
  - Made the code more modular and easier to maintain
- Significantly improved performance of tool status checks by:
  - Processing tools in parallel batches with controlled concurrency
  - Adding progress indicator showing completion percentage during checks
  - Optimizing Homebrew environment initialization
- Improved GraphViz dependency diagram generation:
  - Refactored to use domain-specific constants from fiber/graph.ts
  - Fixed styling to match expected output format with proper node colors
  - Simplified code with template literals and functional programming patterns
  - Unified diagram generation through shared utility function
  - Added type safety with proper UserConfig typing
  - Improved dependency visualization by only showing essential connections
  - Optimized core dependency handling to create cleaner, more intuitive diagrams
  - Fixed redundant connections in dependency graph for better readability
- Optimized performance of `tools get --status` command by:
  - Increasing default concurrency from 5 to 20 parallel checks
  - Reducing default tool check timeout from 15s to 1.5s
  - Improving Homebrew cache freshness handling 
  - Optimizing shell pool initialization
  - Consolidating timeout and concurrency settings into centralized constants
- Extracted fiber dependency graph logic into a dedicated utility:
  - Created reusable `buildFiberDependencyGraph` function in `fiber/dependency-graph.ts`
  - Added JSON output support for fiber dependencies via `fibers deps --json`
  - Standardized the fiber dependency graph interface for consistent usage
  - Made the code more testable with comprehensive test coverage
  - Simplified the deps command implementation with cleaner separation of concerns
  - Created type-safe interfaces for the dependency graph structure
  - Provided utility functions for serializing the graph to JSON
- Added comprehensive snapshot tests for the `fibers deps` command:
  - Created test suite covering all flag combinations (--json, --hide-disabled, --flat, --reverse, --detailed, --graphviz)
  - Implemented environment construction helpers for simplified test setup
  - Added tests for both basic and complex dependency structures
  - Used snapshot testing to verify output format consistency
  - Ensured the dependency visualization remains reliable and accurate across changes
- Replaced shell pool implementation with direct command execution:
  - Improved performance by 14-48% across various tool sets
  - Eliminated timeout errors that occurred with the pooled approach
  - Simplified codebase by removing complex process lifecycle management
  - Enhanced reliability through independent command execution
  - Maintained backward compatibility through API-compatible implementation
  - Reduced resource usage by eliminating persistent shell processes
  - Renamed `shellPool` to `commandExecutor` and `shell-pool.ts` to `command-executor.ts` for clarity
  - Removed unnecessary initialize() and shutdown() methods from CommandExecutor for a simpler, more direct API

### To Fix
- Status check timing summary appears twice when running `tools get --status` command - once before the final separator and once in the summary section 

### Changed
- Refactored constants management to move domain-specific constants into their relevant modules:
  - Homebrew constants moved to `utils/homebrew.ts`
  - Display constants moved to `utils/ui.ts`
  - Command check constants moved to `utils/tools.ts`
  - Fiber-related constants moved to `fiber/types.ts`
  - Config and file constants moved to `config/types.ts`
  - Original `constants.ts` maintained for backward compatibility
- Modified import structure in src/index.ts to avoid type ambiguities
- Renamed `shellPool` to `commandExecutor` throughout the codebase to better reflect its direct command execution functionality
- Restored original display format for `tools get --status` command to maintain backward compatibility
- Added back progress indicator showing current tool being checked during status check
- Fixed duplicate "Checking tool status..." message
- Improved display formatting for tool configurations to match original format
- Fixed inconsistent spacing around separator lines in tool display
- Fixed issue with `tools get --status` command hanging by implementing a robust shell resource cleanup mechanism with process lifecycle hooks
- Removed detailed information after check/install methods for cleaner output in `tools get --status` command
- Enhanced `tools get` command to support multiple tool names (e.g., `tools get tool1 tool2 tool3`)

### Added
- Support for multiple tool names in the `tools get` command
- New utility `withConfig` for standardized configuration loading across commands
- Command factory for creating commands with consistent structure and error handling
- Unified tool status checking utility with better error handling and concurrency
- Batch tool status checking with optimized performance and progress tracking
- Added parallel processing for tool status checks to improve performance
- Added progress indicator showing completion percentage during tool status checks
- Added `--concurrency` option to the `tools get` command to control parallel execution (default: 5)
- Added `--queue` option to use the queue-based parallel processing implementation instead of chunk-based approach for potentially better performance with heterogeneous tool checks
- Added `update-snapshots` command to justfile for easily updating snapshot tests when output formats change intentionally

### Changed
- Increased the default timeout for tool status checks to 15 seconds to prevent timeouts with slower tools like xcode-dev-tools
- Improved shell resource cleanup to prevent resource leaks
- Refactored tools command to eliminate code duplication between `list` and `get` subcommands through a shared helper function
- Refactored `config` command to use the new command factory and `withConfig` utility

### Future Improvements (Code Consolidation Opportunities)
- Extract common config loading patterns into a shared `withConfig` helper across all commands
- Create a unified tool status checking utility with standardized timeout handling
- Consolidate duplicate display logic between tools and fibers commands
- Implement a shared command factory function for creating commands with common patterns
- Standardize module discovery and preparation across commands
- Extract shell management logic into a higher-level abstraction
- Create a shared setup/teardown utility for all commands that require shell or resource management

## [0.8.0] - 2023-08-07

- Fixed issue where warning about checking many tools is displayed twice in `tools get --status` command
- Added support for caching Homebrew package lists to significantly improve performance

### Fixed
- Fixed shell termination errors by:
  - Removing the interactive flag (-i) from bash processes to improve cleanup
  - Adding graceful shell termination before forced killing
  - Implementing a multi-stage shutdown process with increasing levels of force (exit, SIGTERM, SIGKILL)
  - Adding better error handling for shell termination errors in the tools command
  - Fixing error message formatting to properly handle various error types
- Fixed duplicate module processing in discovery process that was causing "Processing chain module: dotfiles" to repeat multiple times in debug output
- Simplified module discovery implementation with cleaner code organization and reduced duplication
- Fixed race condition in ShellPool's getShell method when creating new shells, resolving "undefined is not an object (evaluating 'this.shells[newIndex].active = !0')" error
- Added timeout to ShellPool's getShell method to prevent indefinite hanging when waiting for an available shell
- Fixed shell creation error by removing conflicting stdio configuration options
- Improved error handling in tool status checking with better timeout handling and recovery from shell execution failures
- Added execution time tracking for tool status checks to help diagnose performance issues
- Fixed issue where warning about checking many tools is displayed twice in `tools get --status` command
- Fixed duplicate implementation of `_checkToolStatus` function that was causing type errors and inconsistent behavior
- Resolved TypeScript errors with configurable command checks by properly handling string/boolean type checking
- Fixed compatibility issues in `handleGetStatusCommand` by correctly handling ModuleDiscoveryResult type
- Improved shell pool usage for evaluating command checks
- Fixed `tools get --status` command to use the correct module discovery results
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
- Refactored constants organization to eliminate duplication:
  - Updated `constants/index.ts` to directly re-export from main constants.ts file
  - Removed redundant `constants/commands.ts` file that duplicated constants
  - Centralized all constants in the main `constants.ts` file
- Improved code organization with shared utility modules:
  - Created shared logging module in `utils/logger.ts`
  - Created process management utilities in `utils/process.ts`
  - Extracted ShellPool to a standalone module in `utils/shell-pool.ts`
  - Created Homebrew utilities in `utils/homebrew.ts`
  - Created tool management utilities in `utils/tools.ts`
  - Added UI display utilities in `utils/ui.ts`
  - Enhanced ToolConfig interface with additional properties
- **Improved Code Organization and Reduced Duplication**
  - Renamed `commands/tools/config.ts` to `commands/tools/discovery.ts` to better reflect its purpose
  - Created domain-specific homebrew utilities in `commands/tools/homebrew.ts`
  - Moved brew configuration normalization from `utils/tool-config.ts` to the tools domain
  - Added proper deprecation notices to general utilities that have domain-specific alternatives
  - Reduced duplication between general and domain-specific utilities
  - Made tools command code more maintainable with better domain separation
  - Renamed functions in domain-specific modules to avoid naming conflicts with general utilities
- **Domain-oriented Tools Command Structure**
  - Refactored the tools command into a domain-oriented structure in `commands/tools/` directory
  - Extracted configuration utilities to `commands/tools/config.ts`
  - Extracted filtering utilities to `commands/tools/filter.ts`
  - Extracted UI & display utilities to `commands/tools/ui.ts`
  - Moved the main command implementation to `commands/tools/index.ts`
  - Improved code organization with better separation of concerns
  - Maintained compatibility with existing command interface
  - Made tool code more maintainable and easier to extend

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
- Added `--graphviz` option to the `fibers deps` command to output dependency graph in GraphViz DOT format
  - This allows generating visual dependency graphs using Graphviz tools
  - Colored nodes indicate status: core (blue), enabled (green), disabled (red/dashed)
  - Works with both regular and reverse dependency display modes
  - Shows dependencies matching the regular tree view without redundant connections
  - Properly visualizes the dependency hierarchy with direct connections only
  - Refactored into a reusable utility function using template literals
  - Improved with extracted constants, modular design, and streamlined logic
  - Moved to the fiber module for better code organization
- Added justfile with a `fiber-deps-graph` recipe to generate dependency graphs as SVG

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
- `src/modules/discovery.ts` - Updated error handling and debug implementation

## [Unreleased]

### Changed
- Updated "tools get --status" command to show actual execution time (wall clock time) rather than the sum of individual tool check durations
- Increased default tool concurrency from 20 to 50 parallel checks
- Extended cache expiration from 10 to 60 minutes
- Reduced default tool check timeout from 1500ms to 800ms

### Changed
- Improved tools command UI and organization:
  - Removed redundant `config` subcommand and integrated its functionality into `get --detailed`
  - Enhanced `get` command to show detailed information inline with basic info
  - Improved readability by integrating detailed configuration into relevant sections
  - Maintained all existing functionality while reducing command complexity

### Changed
- Modularized fiber command structure:
  - Moved command implementations to `commands/` directory
  - Consolidated types in `types/` directory
  - Organized utilities in `utils/` directory
  - Removed duplicate files and merged functionality
  - Improved code organization and maintainability

### Changed
- Renamed `orderFibersByDependencies` to `orderFibers` in `src/commands/fibers/utils/dependency-utils.ts` for better clarity, maintaining backward compatibility through re-export

### Changed
- Consolidated all fiber sorting logic into a single unified `orderFibers` function in `src/commands/fibers/utils/dependency-utils.ts`
  - Added support for various ordering options (prioritizing configured fibers, alphabetical sorting, special fiber handling, etc.)
  - Removed redundant sorting functions
  - Improved dependency ordering to ensure correct fiber order in all commands
- Removed `orderFibersByConfigAndName` from `organization.ts`
  - Updated `deps-command.ts` and other files to use the new unified function
  - Added support for various sorting options including:
    - Prioritizing configured fibers
    - Alphabetical sorting
    - Special fiber handling (core, dotfiles)
    - Special dependent sorting
    - Including/excluding discovered fibers
    - Filtering disabled fibers
    - Reversing dependency direction 
