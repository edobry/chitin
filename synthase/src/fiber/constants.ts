/**
 * Constants related to fiber dependencies
 */
export const DEPENDENCY_TYPES = {
  IMPLICIT: 'implicit',
  EXPLICIT: 'explicit',
} as const;

export const DEPENDENCY_SOURCES = {
  CORE: 'implicit.core',
  CONFIG: 'fiber.config',
  INFERRED: 'inferred',
} as const;

export const DEPENDENCY_DISPLAY = {
  BULLET: '•',
  INDENT: '     ',
  TREE_INDENT: '    ',
  TREE_BRANCH: '├── ',
  TREE_LAST: '└── ',
  TREE_VERTICAL: '│   ',
} as const; 
