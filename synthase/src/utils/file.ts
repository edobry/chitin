import { join, dirname, resolve } from 'path';
import { PathExpansionOptions } from '../types';

/**
 * Expands special paths in a path string
 * @param path The path to expand
 * @param options Path expansion options
 * @returns Expanded path
 */
export function expandPath(path: string, options?: PathExpansionOptions): string {
  if (!path) return path;
  
  const homeDir = options?.homeDir || Bun.env.HOME || '~';
  const localShareDir = options?.localShareDir || join(homeDir, '.local', 'share');
  
  return path
    .replace(/^~(?=$|\/|\\)/, homeDir)
    .replace(/^localshare(?=$|\/|\\)/, localShareDir);
}

/**
 * Finds the configuration path relative to the project directory
 * @param fileName Name of the configuration file
 * @param projectDir Base project directory
 * @returns Full path to the configuration file
 */
export function findConfigPath(fileName: string, projectDir?: string): string {
  if (!projectDir) {
    // Use CHI_DIR environment variable if available, otherwise use current directory
    projectDir = Bun.env.CHI_DIR || process.cwd();
  }
  
  return resolve(projectDir, fileName);
}

/**
 * Checks if a file exists
 * @param path File path
 * @returns Whether the file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const file = Bun.file(path);
    return await file.exists();
  } catch (e) {
    return false;
  }
}

/**
 * Creates directories recursively if they don't exist
 * @param path Directory path
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await Bun.write(Bun.file(`${path}/.touch`), '');
    await Bun.spawn(['rm', `${path}/.touch`]).exited;
  } catch (e) {
    // If the directory doesn't exist, create it
    if (e instanceof Error && e.message.includes('ENOENT')) {
      await Bun.spawn(['mkdir', '-p', path]).exited;
    } else {
      throw e;
    }
  }
}

/**
 * Reads a file as text
 * @param path File path
 * @returns File contents as string
 */
export async function readFile(path: string): Promise<string> {
  try {
    const file = Bun.file(path);
    return await file.text();
  } catch (e) {
    throw new Error(`Failed to read file ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Writes text to a file
 * @param path File path
 * @param content Content to write
 */
export async function writeFile(path: string, content: string): Promise<void> {
  try {
    // Ensure the directory exists
    await ensureDir(dirname(path));
    
    // Write the file
    await Bun.write(path, content);
  } catch (e) {
    throw new Error(`Failed to write file ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
} 
