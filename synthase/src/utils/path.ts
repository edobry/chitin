import { homedir } from 'os';
import { join, normalize } from 'path';

/**
 * Expands home directory tilde character in a path
 * @param path Path that may contain tilde
 * @returns Path with tilde expanded to home directory
 */
export function expandTilde(path: string): string {
  const home = homedir();
  
  if (path.startsWith('~/') || path === '~') {
    return path.replace(/^~(?=$|\/)/, home);
  }
  
  return path;
}

/**
 * Expands special directories in paths
 * @param path Path that may contain special directory references
 * @returns Path with special directories expanded
 */
export function expandSpecialDirs(path: string): string {
  const home = homedir();
  let expanded = path;
  
  // Expand home directory
  expanded = expandTilde(expanded);
  
  // Expand localshare directory
  const localsharePattern = /^localshare(?=$|\/)/;
  if (localsharePattern.test(expanded)) {
    const localshare = join(home, '.local', 'share');
    expanded = expanded.replace(localsharePattern, localshare);
  }
  
  return normalize(expanded);
}

/**
 * Finds the Chitin project directory
 * @returns The project directory path or null if not found
 */
export function findChitinDir(): string | null {
  // First try the environment variable
  if (Bun.env.CHI_DIR) {
    return Bun.env.CHI_DIR;
  }
  
  // Then try to determine from the current file
  try {
    // Get the directory this file is in
    const scriptDir = import.meta.dir;
    
    // Navigate up to find the chitin root (parent of synthase)
    const parts = scriptDir.split('/');
    const synthaseIndex = parts.findIndex(part => part === 'synthase');
    
    if (synthaseIndex >= 0) {
      return parts.slice(0, synthaseIndex).join('/');
    }
  } catch (e) {
    // Ignore errors and fall back to cwd
  }
  
  // Fall back to current working directory
  return process.cwd();
}

/**
 * Gets the user configuration directory following XDG standards
 * @returns The path to the user configuration directory
 */
export function getUserConfigDir(): string {
  const xdgConfigHome = Bun.env.XDG_CONFIG_HOME;
  const homeDir = homedir();
  
  // Follow XDG standards: use XDG_CONFIG_HOME if set, otherwise ~/.config
  const configBase = xdgConfigHome || join(homeDir, '.config');
  return join(configBase, 'chitin');
}

/**
 * Gets the path to the user configuration file
 * @param filename Optional custom filename (defaults to userConfig.yaml)
 * @returns The full path to the user configuration file
 */
export function getUserConfigPath(filename: string = 'userConfig.yaml'): string {
  return join(getUserConfigDir(), filename);
} 
