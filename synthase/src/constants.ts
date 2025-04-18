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
 * Display constants
 */
export const DISPLAY = {
  EMOJIS: {
    FIBER: '🧬',
    CHAIN: '⛓️',
    ENABLED: '🟢',
    DISABLED: '🔴',
    DEPENDS_ON: '⬆️',
  },
} as const; 
