# Synthase Changelog

## [Unreleased]

### Fixed
- Fixed issue where warning about checking many tools is displayed twice in `tools get --status` command
- Fixed duplicate implementation of `_checkToolStatus` function that was causing type errors and inconsistent behavior
- Resolved TypeScript errors with configurable command checks by properly handling string/boolean type checking
- Fixed compatibility issues in `handleGetStatusCommand` by correctly handling ModuleDiscoveryResult type
- Fixed issue where status check timing summary appears twice when running `tools get --status` command

### To Fix
- Status check timing summary appears twice when running `tools get --status` command - once before the final separator and once in the summary section 

### Changed
