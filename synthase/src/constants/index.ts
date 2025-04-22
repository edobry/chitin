/**
 * Display-related constants for UI consistency
 */
export const DISPLAY = {
  EMOJIS: {
    TOOL: "🔧",
    CHECK: "🔍",
    INSTALL: "🏗️",
    REFERENCE: "🔗",
    ENABLED: "🟢",
    DISABLED: "🔴",
    ERROR: "⚠️",
    UNKNOWN: "⚪",
    ADDITIONAL_INFO: "📋"
  }
};

// Command constants to reduce duplication
export const BREW_CMD = {
  LIST_CASK: 'brew ls --cask',
  LIST_FORMULA: 'brew ls --formula',
  LIST_ALL: 'brew ls -1',
  LIST_CASKS_ONLY: 'brew list --cask',
  LIST_FORMULAS_ONLY: 'brew list --formula'
};

export const CHECK_CMD = {
  COMMAND_EXISTS: 'command -v'
}; 
