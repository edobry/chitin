import { join, dirname, resolve } from 'path';
import { PathExpansionOptions } from '../types';
import { statSync } from 'fs';

/**
 * Stores mappings between expanded and original paths
 */
const pathMappings = new Map<string, string>();

/**
 * Expands special paths in a path string and saves the original
 * @param path The path to expand
 * @param options Path expansion options
 * @returns Expanded path
 */
export function expandPath(path: string, options?: PathExpansionOptions): string {
  if (!path) return path;
  
  const homeDir = options?.homeDir || Bun.env.HOME || '~';
  const localShareDir = options?.localShareDir || join(homeDir, '.local', 'share');
  
  let expandedPath = path;
  
  // Handle tilde at the start of the path
  if (expandedPath.startsWith('~')) {
    expandedPath = expandedPath.replace(/^~(?=$|\/|\\)/, homeDir);
  }
  
  // Handle localshare
  if (expandedPath.startsWith('localshare')) {
    expandedPath = expandedPath.replace(/^localshare(?=$|\/|\\)/, localShareDir);
  }
  
  // Store the mapping between expanded and original path
  if (expandedPath !== path) {
    pathMappings.set(expandedPath, path);
  }
  
  return expandedPath;
}

/**
 * Gets the original, unexpanded form of a path if available
 * @param expandedPath The expanded path
 * @returns The original path or the expanded path if no original is found
 */
export function getOriginalPath(expandedPath: string): string {
  return pathMappings.get(expandedPath) || expandedPath;
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
    // Use fs.statSync instead of Bun.file.exists which has reliability issues
    return statSync(path).isFile() || statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Checks if a path is a directory
 * @param path Path to check
 * @returns Whether the path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = statSync(path);
    return stats.isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Reads the contents of a directory
 * @param path Directory path
 * @returns Array of filenames in the directory
 */
export async function readDirectory(path: string): Promise<string[]> {
  try {
    const process = Bun.spawn(['ls', '-a', path]);
    const output = await new Response(process.stdout).text();
    await process.exited;
    
    // Filter out . and .. entries and split by newline
    return output
      .split('\n')
      .filter(entry => entry && entry !== '.' && entry !== '..');
  } catch (e) {
    throw new Error(`Failed to read directory ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Creates directories recursively if they don't exist
 * @param path Directory path
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    // Just use mkdir -p directly
    await Bun.spawn(['mkdir', '-p', path]).exited;
  } catch (e) {
    throw new Error(`Failed to create directory ${path}: ${e instanceof Error ? e.message : String(e)}`);
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
