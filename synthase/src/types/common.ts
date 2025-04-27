/**
 * Common utility types that are used across multiple domains
 */

/**
 * Result interface for operations that can succeed or fail
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Command execution result
 */
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Function to check if a condition is met
 */
export type Predicate<T> = (value: T) => boolean; 
