/**
 * Command constants to reduce duplication in shell commands
 */

/**
 * Homebrew command constants
 */
export const BREW_CMD = {
  LIST_CASK: 'brew ls --cask',
  LIST_FORMULA: 'brew ls --formula',
  LIST_ALL: 'brew ls -1',
  LIST_CASKS_ONLY: 'brew list --cask',
  LIST_FORMULAS_ONLY: 'brew list --formula'
};

/**
 * Shell command check constants
 */
export const CHECK_CMD = {
  COMMAND_EXISTS: 'command -v'
}; 
