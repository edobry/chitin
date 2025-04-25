/**
 * Display-related constants and utilities
 */

/**
 * Emoji constants
 */
export const EMOJI = {
  // Base emojis
  GREEN_CIRCLE: '🟢',
  RED_CIRCLE: '🔴',
  WHITE_CIRCLE: '⚪',
  BLACK_CIRCLE: '⚫',
  WARNING: '⚠️',
  ERROR_CROSS: '❌',
  WRENCH: '🔧',
  MAGNIFYING_GLASS: '🔍',
  CONSTRUCTION: '🏗️',
  LINK: '🔗',
  PIN: '📌',
  PACKAGE: '📦',
  LIGHTNING: '⚡',
  ARROWS_COUNTERCLOCKWISE: '🔄',
  DOWN_ARROW: '⬇️',
  UP_ARROW: '⬆️',
  CLIPBOARD: '📋',
  FOLDER: '📂',
  DNA: '🧬',
  CHAINS: '⛓️',

  // Domain-specific aliases
  get INSTALLED() { return this.GREEN_CIRCLE },
  get NOT_INSTALLED() { return this.RED_CIRCLE },
  get UNKNOWN() { return this.WHITE_CIRCLE },
  get ERROR() { return this.ERROR_CROSS },
  get TOOL() { return this.WRENCH },
  get CHECK() { return this.MAGNIFYING_GLASS },
  get INSTALL() { return this.CONSTRUCTION },
  get REFERENCE() { return this.LINK },
  get VERSION() { return this.PIN },
  get PROVIDES() { return this.PACKAGE },
  get OPTIONAL() { return this.LIGHTNING },
  get POST_INSTALL() { return this.ARROWS_COUNTERCLOCKWISE },
  get DEPENDENCIES() { return this.DOWN_ARROW },
  get ADDITIONAL_INFO() { return this.CLIPBOARD },
  get PATH() { return this.FOLDER },
  get FIBER() { return this.DNA },
  get CHAIN() { return this.CHAINS },
  get ACTIVE() { return this.GREEN_CIRCLE },
  get DISABLED() { return this.BLACK_CIRCLE },
  get UNAVAILABLE() { return this.RED_CIRCLE },
  get DEPENDS_ON() { return this.UP_ARROW },
} as const;

/**
 * Type definition for display emojis
 */
export type DisplayEmoji = typeof EMOJI[keyof typeof EMOJI]; 
