import { join, basename, dirname } from 'path';
import { UserConfig, Module, ModuleDiscoveryOptions, ModuleDiscoveryResult, ModuleDependency } from '../types';
import { loadModuleConfig, getProjectDir, getDotfilesDir } from '../config/loader';
import { fileExists, isDirectory, readDirectory, expandPath } from '../utils/file';
import { glob } from 'glob';
import { stat, readFile } from 'fs/promises';
// Using console.log instead of debug import that can't be found
const debug = (message: string) => console.log(`[DEBUG] ${message}`);

// Helper function to read and parse JSON files
async function readJson(path: string) {
  const content = await readFile(path, 'utf8');
  return JSON.parse(content);
}

// Helper function to get file stats
async function statAsync(path: string) {
  return stat(path);
}

/**
 * Discovers modules in the specified directories using Chitin's directory structure
 * @param options Discovery options
 * @returns Discovery result containing modules and errors
 */
export async function discoverModules(
  options: ModuleDiscoveryOptions
): Promise<ModuleDiscoveryResult> {
  const modules: Module[] = [];
  const errors: string[] = [];
  
  // Process each base directory as a potential fiber source
  for (const baseDir of options.baseDirs) {
    try {
      if (!await fileExists(baseDir)) {
        errors.push(`Base directory not found: ${baseDir}`);
        continue;
      }
      
      if (!await isDirectory(baseDir)) {
        errors.push(`Not a directory: ${baseDir}`);
        continue;
      }
      
      // Find and process fibers (following chitin's approach)
      await discoverFibers(baseDir, modules, errors, options.dotfilesDir);
    } catch (error) {
      errors.push(`Error scanning ${baseDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return { modules, errors };
}

/**
 * Discovers fibers in a directory (top-level modules)
 * @param baseDir Base directory for discovery
 * @param modules Array to populate with modules
 * @param errors Array to collect errors
 * @param dotfilesDir The configured dotfiles directory
 */
async function discoverFibers(
  baseDir: string,
  modules: Module[],
  errors: string[],
  dotfilesDir?: string
): Promise<void> {
  try {
    // If this is the dotfiles directory, special handling is needed
    const isDotfilesDir = dotfilesDir && (baseDir === dotfilesDir || baseDir.includes(dotfilesDir));
    
    // Check if this is the main chitin directory (special handling for core)
    const isChitinMainDir = baseDir.endsWith('/chitin') || baseDir.includes('/chitin/');
    
    // More robust check: is this the actual main chitin directory?
    const isActualChitinDir = baseDir.endsWith('/chitin') || 
                              baseDir === process.env.CHI_DIR || 
                              (baseDir.includes('/chitin/') && !baseDir.includes('/chitin-'));
    
    // Check for existing core module to avoid duplicates
    const existingCoreModule = modules.find(m => m.id === 'core');
    
    // Check if this directory itself is a fiber
    const fiberConfigPath = join(baseDir, 'config.yaml');
    if (await fileExists(fiberConfigPath)) {
      try {
        // Skip creating a fiber module if this is the main chitin directory and we already have a core module
        // This prevents duplicate discovery of the same directory as both "core" and "chitin"
        if ((isActualChitinDir && existingCoreModule) || 
            (baseDir.endsWith('/chitin') && existingCoreModule)) {
          // Skip creating another fiber for the main chitin directory
        } else {
          const module = await createModule(baseDir, 'fiber', dotfilesDir);
          if (module) {
            // If we have a module with the same path as dotfilesDir but not named 'dotfiles',
            // we should skip it to prevent duplicates
            if (isDotfilesDir && module.name !== 'dotfiles') {
              // Skip this module as it's the same as dotfiles
            } else if (isActualChitinDir && module.name !== 'core') {
              // Force the module name to be 'core' if it's the actual chitin directory
              module.id = 'core';
              module.name = 'core';
              modules.push(module);
            } else {
              modules.push(module);
            }
          }
        }
      } catch (error) {
        errors.push(`Error loading fiber at ${baseDir}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Check for the chains directory in this potential fiber
    const chainsDir = join(baseDir, 'chains');
    if (await fileExists(chainsDir) && await isDirectory(chainsDir)) {
      // Process chains in this fiber
      await discoverChains(chainsDir, baseDir, modules, errors, dotfilesDir);
    }
    
    // Special case for core directory which has subdirectories that aren't fibers
    // but rather categories of chains
    if (baseDir.endsWith('/chains')) {
      const entries = await readDirectory(baseDir);
      for (const entry of entries) {
        const entryPath = join(baseDir, entry);
        if (await isDirectory(entryPath)) {
          // This might be a chain category directory (like init, core, etc.)
          await discoverChains(entryPath, dirname(baseDir), modules, errors, dotfilesDir);
        }
      }
    }
  } catch (error) {
    errors.push(`Error discovering fibers in ${baseDir}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Discovers chains within a fiber's chains directory
 * @param chainsDir Directory containing chains
 * @param fiberDir Parent fiber directory
 * @param modules Array to populate with modules
 * @param errors Array to collect errors
 * @param dotfilesDir The configured dotfiles directory
 */
async function discoverChains(
  chainsDir: string,
  fiberDir: string,
  modules: Module[],
  errors: string[],
  dotfilesDir?: string
): Promise<void> {
  try {
    // Check if this is the main chitin directory's chains
    const isChitinMainDir = fiberDir.endsWith('/chitin') || fiberDir.includes('/chitin/');
    
    // Determine the parent fiber ID based on the fiber directory
    let parentFiberId: string | undefined;
    
    if (isChitinMainDir) {
      // For chains in the main chitin directory, always use 'core'
      parentFiberId = 'core';
    } else {
      // For chains in other fibers, use the fiber name (basename of fiberDir)
      parentFiberId = basename(fiberDir);
      
      // Handle special cases for fiber naming
      if (parentFiberId.startsWith('chitin-')) {
        parentFiberId = parentFiberId.replace(/^chitin-/, '');
      }
      
      // For dotfiles directory
      if (dotfilesDir && (fiberDir === dotfilesDir || fiberDir.includes(dotfilesDir))) {
        parentFiberId = 'dotfiles';
      }
    }
    
    // Process files directly in chains dir (simple chains)
    const entries = await readDirectory(chainsDir);
    
    // First, handle chain files (direct shell scripts)
    for (const entry of entries) {
      const entryPath = join(chainsDir, entry);
      if (!await isDirectory(entryPath) && (entry.endsWith('.sh') || entry.endsWith('.zsh'))) {
        try {
          const module = await createModule(entryPath, 'chain', dotfilesDir);
          if (module) {
            // Set parent fiber ID for the chain module
            module.parentFiberId = parentFiberId;
            modules.push(module);
          }
        } catch (error) {
          errors.push(`Error loading chain at ${entryPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    // Then handle nested chain directories
    for (const entry of entries) {
      const entryPath = join(chainsDir, entry);
      if (await isDirectory(entryPath)) {
        try {
          // Skip processing subdirectories in the "/chitin/chains/core" directory
          // as these are not actually chains but categories of chains
          if (chainsDir.includes('/chitin/chains') && entry === 'core') {
            continue;
          }
          
          const module = await createModule(entryPath, 'chain', dotfilesDir);
          if (module) {
            // Set parent fiber ID for the chain module
            module.parentFiberId = parentFiberId;
            modules.push(module);
          }
        } catch (error) {
          errors.push(`Error loading chain at ${entryPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Error discovering chains in ${chainsDir}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a Module object from a directory or file
 * @param path Module directory/file path
 * @param type Type of module to create (fiber or chain)
 * @param dotfilesDir Optional path to dotfiles directory
 */
export async function createModule(
  path: string,
  type: 'fiber' | 'chain',
  dotfilesDir?: string
): Promise<Module | undefined> {
  try {
    const stats = await statAsync(path);
    
    // Extract base name for ID generation
    let moduleName = basename(path);
    
    // Handle special types of modules
    const isCoreFiber = type === 'fiber' && (
      // Main chitin repository
      path.endsWith('/chitin') || path.includes('/chitin/') ||
      // Explicitly named core directory
      moduleName === 'core'
    );
    
    const isDotfiles = dotfilesDir && path.includes(dotfilesDir);
    
    // Handle .sh and .zsh files for chains
    if (type === 'chain' && !stats.isDirectory()) {
      moduleName = moduleName.replace(/\.(sh|zsh)$/, '');
    }
    
    // Create module ID based on special case
    let id: string;
    
    if (isCoreFiber) {
      // Always use 'core' for the main chitin repository to avoid duplication
      id = 'core';
    } else if (isDotfiles) {
      id = 'dotfiles';
    } else if (moduleName.startsWith('chitin-')) {
      // Strip chitin- prefix for external fibers
      id = moduleName.replace(/^chitin-/, '');
    } else {
      id = moduleName;
    }
    
    // Note: in the case of hidden files, we strip the leading dot for the ID
    // but keep it in the name for display purposes
    if (moduleName.startsWith('.') && !isDotfiles) {
      id = moduleName.substring(1);
    }
    
    // Directory-specific properties
    let entrypoint: string | undefined;
    let description: string | undefined;
    
    if (stats.isDirectory()) {
      // For directories, check for package.json or set default entrypoint
      try {
        const pkgJsonPath = join(path, 'package.json');
        
        if (await fileExists(pkgJsonPath)) {
          const pkgJson = await readJson(pkgJsonPath);
          
          if (typeof pkgJson.main === 'string') {
            entrypoint = join(path, pkgJson.main);
          }
          
          if (typeof pkgJson.description === 'string') {
            description = pkgJson.description;
          }
        }
      } catch (error) {
        debug(`Error reading package.json for ${path}: ${error}`);
      }
      
      // Default entrypoint based on module type
      if (!entrypoint) {
        if (type === 'fiber') {
          const indexPath = join(path, 'index.js');
          if (await fileExists(indexPath)) {
            entrypoint = indexPath;
          }
        } else if (type === 'chain') {
          // For chain directories, look for <name>.sh or index.sh
          const specificScript = join(path, `${moduleName}.sh`);
          const indexScript = join(path, 'index.sh');
          
          if (await fileExists(specificScript)) {
            entrypoint = specificScript;
          } else if (await fileExists(indexScript)) {
            entrypoint = indexScript;
          }
        }
      }
    } else {
      // For files, use the file itself as the entrypoint
      entrypoint = path;
    }
    
    // Create and return the module with compatible properties
    return {
      id,
      name: moduleName,
      type,
      path,
      metadata: {
        dependencies: [],
        description
      },
      config: { enabled: true }
    };
  } catch (error) {
    debug(`Error creating module from ${path}: ${error}`);
    return undefined;
  }
}

/**
 * Gets chitin-* directories in the project directory
 * @param projectDir The project directory
 * @returns Array of chitin-* directories
 */
async function findChitinExternalDirs(projectDir: string): Promise<string[]> {
  try {
    // Use glob to find chitin-* directories, exactly as Chitin does
    const pattern = join(projectDir, 'chitin-*');
    // Find all matches, then filter to directories only
    const matches = await glob(pattern);
    const dirMatches = [];
    
    for (const match of matches) {
      if (await isDirectory(match)) {
        dirMatches.push(match);
      }
    }
    
    return dirMatches;
  } catch (error) {
    console.error('Error finding chitin-* directories:', error);
    return [];
  }
}

/**
 * Discovers modules based on user configuration
 * @param userConfig User configuration
 * @param additionalDirs Additional directories to scan
 * @returns Discovery result containing modules and errors
 */
export async function discoverModulesFromConfig(
  userConfig: UserConfig,
  additionalDirs: string[] = []
): Promise<ModuleDiscoveryResult> {
  const baseDirs: string[] = [...additionalDirs];
  
  // Add primary chitin directory (Chitin always loads this)
  const chitinDir = process.env.CHI_DIR || '';
  if (chitinDir) {
    baseDirs.push(chitinDir);
  }
  
  // Get dotfiles directory from config
  const dotfilesDir = getDotfilesDir(userConfig);
  
  // Add dotfiles directory from config (if it exists)
  if (dotfilesDir && await fileExists(dotfilesDir) && await isDirectory(dotfilesDir)) {
    baseDirs.push(dotfilesDir);
  }
  
  // Instead of adding the entire project directory, we only want to add chitin-* directories
  // This exactly matches Chitin's behavior in chiFiberLoadExternal
  const projectDir = getProjectDir(userConfig);
  if (projectDir && await fileExists(projectDir) && await isDirectory(projectDir)) {
    const chitinExternalDirs = await findChitinExternalDirs(projectDir);
    baseDirs.push(...chitinExternalDirs);
  }
  
  // Perform discovery using chitin's approach
  return discoverModules({
    baseDirs,
    recursive: false, // Not needed anymore since we handle nesting specifically
    dotfilesDir     // Pass the dotfiles directory so we can identify it accurately
  });
} 
