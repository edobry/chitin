/**
 * Shared logging utilities for the application
 */

/**
 * Log level enum for controlling verbosity
 */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

// Default to environment variable, or ERROR level if not set
let currentLogLevel: LogLevel = process.env.DEBUG === 'true' 
  ? LogLevel.DEBUG 
  : (process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL, 10) : LogLevel.ERROR);

/**
 * Set the current log level
 * @param level LogLevel or string representation
 */
export function setLogLevel(level: LogLevel | string): void {
  if (typeof level === 'string') {
    switch (level.toLowerCase()) {
      case 'none': currentLogLevel = LogLevel.NONE; break;
      case 'error': currentLogLevel = LogLevel.ERROR; break;
      case 'warn': currentLogLevel = LogLevel.WARN; break;
      case 'info': currentLogLevel = LogLevel.INFO; break;
      case 'debug': currentLogLevel = LogLevel.DEBUG; break;
      case 'trace': currentLogLevel = LogLevel.TRACE; break;
      default:
        const numLevel = parseInt(level, 10);
        if (!isNaN(numLevel) && numLevel >= 0 && numLevel <= 5) {
          currentLogLevel = numLevel;
        }
    }
  } else {
    currentLogLevel = level;
  }
  
  // Log the setting change at any level except NONE
  if (currentLogLevel > LogLevel.NONE) {
    console.log(`[LOG] Log level set to ${LogLevel[currentLogLevel]} (${currentLogLevel})`);
  }
}

/**
 * Get the current log level
 * @returns Current LogLevel
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Log a message at a specific level
 * @param level Log level
 * @param args Arguments to log
 */
export function log(level: LogLevel, ...args: any[]): void {
  if (level <= currentLogLevel) {
    const prefix = `[${LogLevel[level]}]`;
    console.error(prefix, ...args);
  }
}

/**
 * Log an error message
 * @param args Arguments to log
 */
export function error(...args: any[]): void {
  log(LogLevel.ERROR, ...args);
}

/**
 * Log a warning message
 * @param args Arguments to log
 */
export function warn(...args: any[]): void {
  log(LogLevel.WARN, ...args);
}

/**
 * Log an info message
 * @param args Arguments to log
 */
export function info(...args: any[]): void {
  log(LogLevel.INFO, ...args);
}

/**
 * Log a debug message
 * @param args Arguments to log
 */
export function debug(...args: any[]): void {
  log(LogLevel.DEBUG, ...args);
}

/**
 * Log a trace message
 * @param args Arguments to log
 */
export function trace(...args: any[]): void {
  log(LogLevel.TRACE, ...args);
} 
