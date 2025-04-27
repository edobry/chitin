/**
 * Process management utilities for safely running shell commands
 */
import { execa, execaCommand } from 'execa';
import type { Options as ExecaOptions } from 'execa';
import { debug } from './logger';

/**
 * Global registry for tracking child processes
 */
export const processRegistry = {
  processes: new Set<ReturnType<typeof execa>>(),
  
  /**
   * Register a process in the registry
   * @param process Process to register
   * @returns The registered process
   */
  register(process: ReturnType<typeof execa>) {
    this.processes.add(process);
    // Remove from registry once completed
    process.finally(() => {
      this.processes.delete(process);
    });
    return process;
  },
  
  /**
   * Kill all registered processes
   */
  killAll() {
    debug(`Killing ${this.processes.size} remaining child processes`);
    for (const process of this.processes) {
      try {
        process.kill();
      } catch (error) {
        debug(`Error killing process: ${error}`);
      }
    }
    this.processes.clear();
  }
};

/**
 * Safe wrapper for execa that registers processes
 * @param file Command to execute
 * @param args Command arguments
 * @param options Execution options
 * @returns Execa process
 */
export function safeExeca(file: string, args?: readonly string[], options?: ExecaOptions): ReturnType<typeof execa> {
  const process = execa(file, args, options);
  return processRegistry.register(process);
}

/**
 * Safe wrapper for execaCommand that registers processes
 * @param command Command string to execute
 * @param options Execution options
 * @returns Execa process
 */
export function safeExecaCommand(command: string, options?: ExecaOptions): ReturnType<typeof execaCommand> {
  const process = execaCommand(command, options);
  return processRegistry.register(process);
}

/**
 * Ensure all processes are killed when the application exits
 */
export function setupProcessCleanup(): void {
  // Handle process termination to clean up child processes
  process.on('SIGINT', () => {
    processRegistry.killAll();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    processRegistry.killAll();
    process.exit(0);
  });
  
  process.on('exit', () => {
    processRegistry.killAll();
  });
} 
