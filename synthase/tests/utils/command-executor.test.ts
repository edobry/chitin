import { describe, expect, test } from 'bun:test';
import { commandExecutor } from '../../src/utils/command-executor';

describe('CommandExecutor', () => {
  test('executeCommand should execute a simple command successfully', async () => {
    const result = await commandExecutor.executeCommand('echo "test"');
    
    expect(result.stdout).toBe('test');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });
  
  test('executeCommand should handle command not found', async () => {
    const result = await commandExecutor.executeCommand('non-existent-command-12345');
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('command not found');
  });
  
  test('executeCommand should properly build command with arguments', async () => {
    // This tests the command construction without relying on timeout behavior
    const command = 'ls -la';
    const result = await commandExecutor.executeCommand(command);
    
    // The command should execute successfully
    expect(result.exitCode).toBe(0);
    // Output should contain typical ls -la output indicators
    expect(result.stdout).toContain('total');
    expect(result.stdout).toContain('drwx');
  });
  
  test('executeCommand should handle command error gracefully', async () => {
    // Test with a command that will produce an error
    // Using a malformed grep command that requires an argument
    const result = await commandExecutor.executeCommand('grep');
    
    // The command should fail with an error
    expect(result.exitCode).not.toBe(0);
    // Check for typical grep usage error message
    expect(result.stderr).toContain('usage');
  });
  
  test('performToolStatusCheck should return true for existing commands', async () => {
    const result = await commandExecutor.performToolStatusCheck('echo test');
    expect(result).toBe(true);
  });
  
  test('performToolStatusCheck should return false for non-existent commands', async () => {
    const result = await commandExecutor.performToolStatusCheck('non-existent-command-12345');
    expect(result).toBe(false);
  });
}); 
