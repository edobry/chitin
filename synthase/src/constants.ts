/**
 * Common constants used throughout the application
 */

/**
 * Module type constants
 */
export const MODULE_TYPES = {
  FIBER: 'fiber',
  CHAIN: 'chain',
  TOOL: 'tool',
} as const;

/**
 * Special fiber names
 */
export const FIBER_NAMES = {
  CORE: 'core',
  DOTFILES: 'dotfiles',
} as const;

/**
 * Configuration field names
 */
export const CONFIG_FIELDS = {
  // Common fields
  ENABLED: 'enabled',
  MODULE_CONFIG: 'moduleConfig',
  
  // Fiber-specific fields
  FIBER_DEPS: 'fiberDeps',
  TOOL_DEPS: 'toolDeps',
  PROJECT_DIR: 'projectDir',
  DOTFILES_DIR: 'dotfilesDir',
  CHECK_TOOLS: 'checkTools',
  INSTALL_TOOL_DEPS: 'installToolDeps',
  AUTO_INIT_DISABLED: 'autoInitDisabled',
  LOAD_PARALLEL: 'loadParallel',
  
  // Chain-specific fields
  DEPS: 'deps',
  CHAIN_DEPS: 'chainDeps',
  PROVIDES: 'provides',
  
  // Special collection names
  FIBERS: 'fibers',
  CHAINS: 'chains',
  TOOLS: 'tools',
} as const;

/**
 * File and directory names
 */
export const FILE_NAMES = {
  USER_CONFIG: 'userConfig.yaml',
  MODULE_CONFIG: 'config.yaml',
  TEST_USER_CONFIG: 'test-user-config.yaml',
} as const;

/**
 * Path prefixes
 */
export const PATH_PREFIXES = {
  CHITIN: 'chitin',
  CHITIN_EXTERNAL: 'chitin-',
} as const;

/**
 * Homebrew constants
 */
export const BREW = {
  COMMAND: 'brew',
  CASK: 'cask',
  FORMULA: 'formula',
  TAP: 'tap',
  NAME: 'name',
  CHECK_PREFIX: 'checkBrew'
} as const;

/**
 * Command constants to reduce duplication
 */
export const BREW_CMD = {
  LIST_CASK: `${BREW.COMMAND} ls --cask`,
  LIST_FORMULA: `${BREW.COMMAND} ls --formula`,
  LIST_ALL: `${BREW.COMMAND} ls -1`,
  LIST_CASKS_ONLY: `${BREW.COMMAND} list --cask`,
  LIST_FORMULAS_ONLY: `${BREW.COMMAND} list --formula`
} as const;

/**
 * Homebrew environment variables to make commands faster
 */
export const BREW_ENV = {
  HOMEBREW_NO_ANALYTICS: '1',
  HOMEBREW_NO_AUTO_UPDATE: '1', 
  HOMEBREW_NO_INSTALL_CLEANUP: '1',
  HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: '1'
} as const;

/**
 * Shell command check constants
 */
export const CHECK_CMD = {
  COMMAND_EXISTS: 'command -v'
} as const;

/**
 * Display constants
 */
export const DISPLAY = {
  EMOJIS: {
    // Entities
    FIBER: '🧬',
    CHAIN: '⛓️',
    TOOL: '🔧',
    REFERENCE: '🔗',
    
    // Status indicators
    ENABLED: '🟢',
    DISABLED: '🔴',
    WARNING: '⚠️',  // Warning/error symbol
    ERROR: '⚠️',    // Error symbol (same as warning)
    UNKNOWN: '⚪',
    DEPENDS_ON: '⬆️',
    
    // Tool properties
    CHECK: '🔍',
    INSTALL: '🏗️',
    ADDITIONAL_INFO: '📋',
  },
} as const; 
