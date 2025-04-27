import { writeFile, ensureDir } from '../utils/file';
import { join, dirname } from 'path';
import { findChitinDir, getChitinCacheDir } from '../utils/path';

/**
 * Interface for environment variables
 */
export interface Environment {
  [key: string]: string | undefined;
}

/**
 * Exports environment variables to a bash file that can be sourced
 * @param env Environment variables to export
 * @param filePath Optional custom file path
 * @returns Path to the created file
 */
export async function exportEnvironmentToBash(
  env: Environment,
  filePath?: string
): Promise<string> {
  if (filePath) {
    // If a custom path is provided, use it
    return await exportToPath(env, filePath);
  }
  
  // Use the Chitin cache directory
  const cacheDir = getChitinCacheDir();
  const exportPath = join(cacheDir, '.chitin_env_ts');
  
  return await exportToPath(env, exportPath);
}

/**
 * Helper function to export environment to a specific path
 * @param env Environment variables to export
 * @param exportPath Path to export to
 * @returns The path where the environment was exported
 */
async function exportToPath(env: Environment, exportPath: string): Promise<string> {
  // Ensure the directory exists
  await ensureDir(dirname(exportPath));
  
  // Create the bash export statements
  const exportStatements = Object.entries(env)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => {
      // Format the value based on its type
      let formattedValue = value || '';
      
      // Convert numeric booleans to string booleans
      if (formattedValue === '0') formattedValue = 'false';
      if (formattedValue === '1') formattedValue = 'true';
      
      // Properly escape the value for bash
      const escapedValue = formattedValue
        .replace(/'/g, "'\\''"); // Escape single quotes
      
      return `export ${key}='${escapedValue}'`;
    })
    .join('\n');
  
  // Write the file
  await writeFile(exportPath, exportStatements);
  
  return exportPath;
}

/**
 * Imports environment variables from Bash by executing a command and capturing its output
 * @returns Imported environment variables
 */
export async function importEnvironmentFromBash(): Promise<Environment> {
  // Execute 'env' command to get the environment variables
  const proc = Bun.spawn(['bash', '-c', 'env']);
  const output = await new Response(proc.stdout).text();
  
  // Parse the output
  const env: Environment = {};
  
  output.split('\n')
    .filter(line => line.includes('='))
    .forEach(line => {
      const [key, ...valueParts] = line.split('=');
      env[key] = valueParts.join('=');
    });
  
  return env;
}

/**
 * Merges multiple environments, with later ones taking precedence
 * @param envs Environments to merge
 * @returns Merged environment
 */
export function mergeEnvironments(...envs: Environment[]): Environment {
  return Object.assign({}, ...envs);
}

/**
 * Creates a bash script that can be executed to set environment variables
 * @param env Environment variables
 * @returns Bash script content
 */
export function createEnvironmentScript(env: Environment): string {
  return Object.entries(env)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => {
      // Properly escape the value for bash
      const escapedValue = (value || '')
        .replace(/'/g, "'\\''"); // Escape single quotes
      
      return `${key}='${escapedValue}'`;
    })
    .join('\n');
} 
