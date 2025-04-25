/**
 * Display-related constants and utilities
 */

export const DISPLAY = {
  EMOJIS: {
    // Entity types
    FIBER: '🧬',
    CHAIN: '⛓️',
    TOOL: '🔧',
    REFERENCE: '🔗',
    
    // Status indicators
    ACTIVE: '🟢',
    DISABLED: '⚫',
    UNAVAILABLE: '🔴',
    WARNING: '⚠️',
    ERROR: '❌',
    UNKNOWN: '⚪',
    
    // Relationships
    DEPENDS_ON: '⬆️',
    PROVIDES: '📦',
    
    // Actions
    CHECK: '🔍',
    INSTALL: '🏗️',
    
    // Properties
    PATH: '📂',
    ADDITIONAL_INFO: '📋'
  }
} as const;

/**
 * Type definition for display emojis
 */
export type DisplayEmoji = typeof DISPLAY.EMOJIS[keyof typeof DISPLAY.EMOJIS]; 
