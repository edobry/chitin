/**
 * Shell pool for efficiently reusing shell processes
 */
import { execa } from 'execa';
import { safeExeca } from './process';
import { debug, error } from './logger';
import { DEFAULT_TOOL_TIMEOUT } from '../commands/tools/constants';

// Define the shell process type to avoid 'any' issues
type ShellProcess = ReturnType<typeof safeExeca>;

/**
 * ShellPool manages a pool of shell processes for efficient command execution
 */
export class ShellPool {
  private shells: Array<{process: ShellProcess, active: boolean}> = [];
  private poolSize: number;
  private initialized = false;
  private terminationTimeoutMs: number; // Timeout for shell termination

  /**
   * Create a new shell pool
   * @param poolSize Maximum number of shells to maintain
   * @param terminationTimeoutMs Timeout in milliseconds for shell termination (default 1000ms)
   */
  constructor(poolSize = 15, terminationTimeoutMs = 1000) {
    this.poolSize = poolSize;
    this.terminationTimeoutMs = terminationTimeoutMs;
  }

  /**
   * Initialize the shell pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    debug(`Initializing shell pool with size ${this.poolSize}`);
    
    // Start with multiple shells to handle concurrent checks better
    const initialShellCount = Math.min(5, this.poolSize);
    for (let i = 0; i < initialShellCount; i++) {
      await this.createShell();
    }
    
    this.initialized = true;
  }

  /**
   * Create a new shell process
   */
  private async createShell(): Promise<void> {
    try {
      debug('Creating new shell process');
      
      // Use explicit environment variables to ensure non-interactive behavior
      const DEFAULT_ENV = {
        // Basic shell settings
        BASH_SILENCE_DEPRECATION_WARNING: '1',
        HISTFILE: '/dev/null',
        HISTSIZE: '0',
        TERM: 'dumb',
        BASH_ENV: '/dev/null',
        
        // Prevent interactive behavior
        PROMPT_COMMAND: '',
        PS1: '',
        PS2: '',
        
        // General settings
        DEBIAN_FRONTEND: 'noninteractive',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        CLICOLOR: '0',
        CLICOLOR_FORCE: '0',
        
        // PATH settings
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
      };
      
      // Create a completely non-interactive shell with proper stdio configuration
      const shellEnv = {
        ...DEFAULT_ENV,
        ...process.env,
        // Disable interactive prompts and history
        PROMPT_COMMAND: '',
        PS1: '',
        PS2: '',
        // Disable terminal features
        TERM: 'dumb',
        // Force disable interactive mode
        BASH_ENV: '/dev/null',
        // Other settings for better command execution
        FORCE_COLOR: '1',
        // Ensure PATH includes common locations
        PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
      };
      
      debug('Creating shell with environment:', shellEnv);
      
      // Create a completely non-interactive shell with proper stdio configuration
      const shell = safeExeca('bash', ['--norc', '--noprofile'], {
        // Explicitly redirect stdin to /dev/null and pipe stdout/stderr
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: shellEnv,
        // Important: Do not set tty to true
        // This prevents tools from thinking they're in an interactive environment
      });

      debug('Shell process created with PID:', shell.pid);

      // Set up error handler for shell process
      shell.on('error', (err) => {
        debug(`Shell process error (PID ${shell.pid}):`, err);
      });

      shell.on('exit', (code, signal) => {
        debug(`Shell process exited (PID ${shell.pid}):`, { code, signal });
      });

      shell.stdout!.on('data', (data) => {
        debug(`Shell stdout (PID ${shell.pid}):`, data.toString());
      });

      shell.stderr!.on('data', (data) => {
        debug(`Shell stderr (PID ${shell.pid}):`, data.toString());
      });

      // Keep the shell alive by starting a command that waits for input
      shell.stdin!.write('cat\n');

      this.shells.push({
        process: shell,
        active: false
      });
      
      // Set up error handler
      shell.catch((err) => {
        // Filter out common "killed" errors which happen during normal shutdown
        if (err.exitCode !== null && err.exitCode !== 0 && !err.message.includes('killed')) {
          error(`Shell process error: ${err instanceof Error ? err.message : String(err)}`);
        }
        
        // Remove from pool
        const index = this.shells.findIndex(s => s.process === shell);
        if (index !== -1) {
          this.shells.splice(index, 1);
        }
      });
      
    } catch (err) {
      error(`Error creating shell: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  /**
   * Get an available shell from the pool
   * @returns Shell process and its index
   */
  async getShell(): Promise<{process: ShellProcess, index: number}> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Look for an inactive shell
    let shellIndex = this.shells.findIndex(s => !s.active);
    
    // If no inactive shell, create a new one if below pool size
    if (shellIndex === -1 && this.shells.length < this.poolSize) {
      const currentLength = this.shells.length;
      await this.createShell();
      shellIndex = currentLength;
    }
    
    // If still no shell available, wait for one to become available
    if (shellIndex === -1) {
      debug('No shells available, waiting for one to be released');
      
      // Wait for a shell to become available, with timeout
      return new Promise((resolve, reject) => {
        const MAX_WAIT_TIME = 5000; // 5 seconds timeout
        
        // Set a timeout to avoid hanging indefinitely
        const timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for an available shell'));
        }, MAX_WAIT_TIME);
        
        // Check periodically for an available shell
        const checkInterval = setInterval(() => {
          const availableIndex = this.shells.findIndex(s => !s.active);
          if (availableIndex !== -1) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            this.shells[availableIndex].active = true;
            resolve({
              process: this.shells[availableIndex].process,
              index: availableIndex
            });
          }
        }, 100);
      });
    }
    
    // Mark the shell as active
    this.shells[shellIndex].active = true;
    
    return {
      process: this.shells[shellIndex].process,
      index: shellIndex
    };
  }

  /**
   * Release a shell back to the pool
   * @param index Shell index to release
   */
  releaseShell(index: number): void {
    if (index >= 0 && index < this.shells.length) {
      this.shells[index].active = false;
    }
  }

  /**
   * Execute a command in an available shell
   * @param command Command to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Command output
   */
  async executeCommand(command: string, timeoutMs: number = DEFAULT_TOOL_TIMEOUT): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    let shell: ShellProcess;
    let shellIndex = -1;
    
    try {
      const getShellStart = Date.now();
      const result = await this.getShell();
      const getShellEnd = Date.now();
      const getShellTime = getShellEnd - getShellStart;
      
      shell = result.process;
      shellIndex = result.index;
      
      // Default return values
      let stdout = '';
      let stderr = '';
      let exitCode = -1;
      let commandComplete = false;
      
      // Create random markers to identify command completion
      const randomId = Math.random().toString(36).substring(2, 10);
      const startMarker = `START_CMD_${randomId}`;
      const endMarker = `END_CMD_${randomId}`;
      const exitMarker = `EXIT_CODE_${randomId}:`;
      
      return new Promise((resolve, reject) => {
        const errorHandler = (err: Error) => {
          debug(`Shell error: ${err.message}`);
          this.releaseShell(shellIndex);
          reject(err);
        };
        
        // Set up timeout with more detailed error message
        const timeout = setTimeout(() => {
          cleanup();
          const error = new Error(`Command timed out after ${timeoutMs}ms: ${command}`);
          debug(`Command timeout: ${error.message}`);
          reject(error);
        }, timeoutMs);
        
        const exitHandler = () => {
          cleanup();
          const error = new Error('Shell process exited unexpectedly');
          debug(`Shell exit: ${error.message}`);
          reject(error);
        };
        
        // Function to clean up event listeners
        const cleanup = () => {
          shell.off('error', errorHandler);
          shell.off('exit', exitHandler);
          shell.stdout!.removeListener('data', stdoutHandler);
          shell.stderr!.removeListener('data', stderrHandler);
          clearTimeout(timeout);
          
          // Only release the shell if we obtained one
          if (shellIndex !== -1) {
            this.releaseShell(shellIndex);
          }
        };
        
        // Track command completion state
        let startSeen = false;
        let stdoutBuffer = '';
        let stderrBuffer = '';
        let commandStartTime = 0;
        let writeStartTime = 0;
        
        // Define stdout handler
        const stdoutHandler = (data: Buffer) => {
          const output = data.toString();
          
          // Add to raw output buffer
          stdoutBuffer += output;
          
          // Check for markers
          if (output.includes(startMarker)) {
            startSeen = true;
            commandStartTime = Date.now();
            // Reset buffers after start marker
            stdout = '';
            stderr = '';
          } else if (startSeen && output.includes(endMarker)) {
            const commandEndTime = Date.now();
            const commandTime = commandEndTime - commandStartTime;
            const writeTime = commandStartTime - writeStartTime;
            
            // Write timing information to a file
            const fs = require('fs');
            const timingInfo = {
              getShellTime,
              writeTime,
              commandTime,
              totalTime: commandEndTime - getShellStart,
              command,
              timestamp: new Date().toISOString()
            };
            fs.writeFileSync('/tmp/shell-pool-timing.json', JSON.stringify(timingInfo, null, 2));
            
            // Extract data between markers
            const stdoutLines = stdoutBuffer.split('\n');
            let collectOutput = false;
            
            for (const line of stdoutLines) {
              if (line.includes(startMarker)) {
                collectOutput = true;
                continue;
              }
              
              if (line.includes(endMarker)) {
                collectOutput = false;
                break;
              }
              
              if (line.includes(exitMarker)) {
                const exitCodeStr = line.split(exitMarker)[1].trim();
                exitCode = parseInt(exitCodeStr, 10);
                continue;
              }
              
              if (collectOutput) {
                stdout += line + '\n';
              }
            }
            
            // Trim trailing newline
            stdout = stdout.trimEnd();
            
            // Mark command as complete
            commandComplete = true;
            
            // Resolve the promise
            cleanup();
            resolve({ stdout, stderr, exitCode });
          }
        };
        
        // Define stderr handler
        const stderrHandler = (data: Buffer) => {
          const output = data.toString();
          stderrBuffer += output;
          
          // Only capture stderr after we've seen the start marker
          if (startSeen) {
            stderr += output;
          }
        };
        
        // Attach event handlers
        shell.on('error', errorHandler);
        shell.on('exit', exitHandler);
        shell.stdout!.on('data', stdoutHandler);
        shell.stderr!.on('data', stderrHandler);
        
        // Format command with markers for reliable output parsing
        // The echo commands help us reliably identify output boundaries
        const wrappedCommand = `
echo '${startMarker}'
(
${command}
)
EXIT_STATUS=$?
echo '${exitMarker}'"$EXIT_STATUS"
echo '${endMarker}'
\x04
`;
        
        // Write command to shell stdin
        writeStartTime = Date.now();
        shell.stdin!.write(wrappedCommand);
      });
    } catch (error) {
      // Clean up if we got a shell but the execution failed
      if (shellIndex !== -1) {
        this.releaseShell(shellIndex);
      }
      throw error;
    }
  }

  /**
   * Shutdown the shell pool and kill all processes
   */
  async shutdown(): Promise<void> {
    debug(`Shutting down shell pool (${this.shells.length} shells)`);
    
    // First attempt to gracefully exit all shells
    for (const shell of this.shells) {
      try {
        if (shell.process.stdin && !shell.process.killed) {
          // Send exit command to the shell
          shell.process.stdin.write('exit\n');
        }
      } catch (error) {
        debug(`Error sending exit to shell: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Give shells a chance to exit gracefully
    await new Promise(resolve => setTimeout(resolve, this.terminationTimeoutMs / 2));
    
    // Force kill any remaining shells
    for (const shell of this.shells) {
      try {
        if (!shell.process.killed) {
          shell.process.kill('SIGTERM');
        }
      } catch (error) {
        debug(`Error killing shell: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Give a brief time for SIGTERM to work
    await new Promise(resolve => setTimeout(resolve, this.terminationTimeoutMs / 2));
    
    // Final pass - use SIGKILL for any stubborn processes
    for (const shell of this.shells) {
      try {
        if (!shell.process.killed) {
          debug('Using SIGKILL for remaining processes');
          shell.process.kill('SIGKILL');
        }
      } catch (error) {
        debug(`Error force killing shell: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    this.shells = [];
    this.initialized = false;
  }

  public async performToolStatusCheck(command: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
      const result = await this.executeCommand(command, timeoutMs);
      return result.exitCode === 0;
    } catch (error) {
      debug(`Tool status check failed for command "${command}": ${error}`);
      return false;
    }
  }
}

// Export a singleton instance for use throughout the application
export const shellPool = new ShellPool();
