/**
 * Shell pool for efficiently reusing shell processes
 */
import { execa } from 'execa';
import { safeExeca } from './process';
import { debug, error } from './logger';

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
  constructor(poolSize = 10, terminationTimeoutMs = 1000) {
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
    
    // Start with just one shell to reduce initial overhead
    await this.createShell();
    
    this.initialized = true;
  }

  /**
   * Create a new shell process
   */
  private async createShell(): Promise<void> {
    try {
      debug('Creating new shell process');
      
      // Using bash without -i flag to avoid interactive shell issues
      const shell = safeExeca('bash', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          // Disable interactive prompts and startup files
          BASH_SILENCE_DEPRECATION_WARNING: '1',
          // Force color output
          FORCE_COLOR: '1',
        },
      });

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
  async executeCommand(command: string, timeoutMs: number = 5000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    let shell: ShellProcess;
    let shellIndex = -1;
    
    try {
      const result = await this.getShell();
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
        
        // Set up timeout
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        }, timeoutMs);
        
        const exitHandler = () => {
          cleanup();
          reject(new Error('Shell process exited unexpectedly'));
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
        
        // Define stdout handler
        const stdoutHandler = (data: Buffer) => {
          const output = data.toString();
          
          // Add to raw output buffer
          stdoutBuffer += output;
          
          // Check for markers
          if (output.includes(startMarker)) {
            startSeen = true;
            // Reset buffers after start marker
            stdout = '';
            stderr = '';
          } else if (startSeen && output.includes(endMarker)) {
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
`;
        
        // Write command to shell stdin
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
}

// Export a singleton instance for use throughout the application
export const shellPool = new ShellPool(); 
