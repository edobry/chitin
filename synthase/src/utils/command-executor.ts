/**
 * Command execution utilities for efficient process management
 */
import { execa } from 'execa';
import { debug } from './logger';
import { DEFAULT_TOOL_TIMEOUT } from '../commands/tools/constants';

/**
 * CommandExecutor uses direct process execution for commands
 * rather than maintaining a shell pool. This prevents process
 * termination issues during CLI shutdown.
 */
export class CommandExecutor {
  /**
   * Execute a command directly with proper timeout handling
   * @param command Command to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Command output
   */
  async executeCommand(command: string, timeoutMs: number = DEFAULT_TOOL_TIMEOUT): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    debug(`Executing command with timeout ${timeoutMs}ms: ${command}`);
    
    try {
      // Use execa with bash to execute the command with proper environment
      const result = await execa('bash', ['-c', command], {
        timeout: timeoutMs,
        shell: false,
        env: {
          ...process.env,
          // Disable interactive prompts and history
          PROMPT_COMMAND: '',
          PS1: '',
          PS2: '',
          // Force disable interactive mode
          BASH_ENV: '/dev/null',
          HISTFILE: '/dev/null',
          HISTSIZE: '0',
          // Better error reporting
          FORCE_COLOR: '1',
          // Ensure PATH includes common locations
          PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
        },
        windowsHide: true,
        reject: false, // Don't throw on error exit codes
      });
      
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode || 0,
      };
    } catch (error: unknown) {
      // Handle timeout or other errors
      const anyError = error as any;
      const isTimeout = anyError.name === 'TimeoutError' || 
                       (anyError.message && anyError.message.includes('timed out'));
      
      debug(`Command execution error: ${anyError.message || String(error)}`);
      
      // Return a graceful error result rather than throwing
      return {
        stdout: '',
        stderr: isTimeout 
          ? `Command timed out after ${timeoutMs}ms: ${command}`
          : `Error executing command: ${anyError.message || String(error)}`,
        exitCode: isTimeout ? 124 : 1
      };
    }
  }

  /**
   * Simple wrapper for tool status checking
   */
  async performToolStatusCheck(command: string, timeoutMs: number = 5000): Promise<boolean> {
    const result = await this.executeCommand(command, timeoutMs);
    return result.exitCode === 0;
  }
}

// Export a singleton instance for use throughout the application
export const commandExecutor = new CommandExecutor();
