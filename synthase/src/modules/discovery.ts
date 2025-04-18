import { join, basename, dirname } from 'path';
import { UserConfig, Module, ModuleDiscoveryOptions, ModuleDiscoveryResult, ModuleDependency } from '../types';
import { loadModuleConfig, getProjectDir, getDotfilesDir } from '../config/loader';
import { fileExists, isDirectory, readDirectory, expandPath } from '../utils/file';
import { glob } from 'glob';

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
    
    // Check if this directory itself is a fiber
    const fiberConfigPath = join(baseDir, 'config.yaml');
    if (await fileExists(fiberConfigPath)) {
      try {
        const module = await createModule(baseDir, 'fiber', dotfilesDir);
        if (module) {
          // If we have a module with the same path as dotfilesDir but not named 'dotfiles',
          // we should skip it to prevent duplicates
          if (isDotfilesDir && module.name !== 'dotfiles') {
            // Skip this module as it's the same as dotfiles
          } else {
            modules.push(module);
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
    // Process files directly in chains dir (simple chains)
    const entries = await readDirectory(chainsDir);
    
    // First, handle chain files (direct shell scripts)
    for (const entry of entries) {
      const entryPath = join(chainsDir, entry);
      if (!await isDirectory(entryPath) && (entry.endsWith('.sh') || entry.endsWith('.zsh'))) {
        try {
          const module = await createModule(entryPath, 'chain', dotfilesDir);
          if (module) {
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
          const module = await createModule(entryPath, 'chain', dotfilesDir);
          if (module) {
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
 * @param modulePath Path to the module directory or file
 * @param moduleType Type of the module (fiber or chain)
 * @param dotfilesDir The configured dotfiles directory
 * @returns Module object or null if invalid
 */
async function createModule(
  modulePath: string, 
  moduleType: 'fiber' | 'chain', 
  dotfilesDir?: string
): Promise<Module | null> {
  // For files, use the file name without extension as module name
  let moduleName = '';
  if (await isDirectory(modulePath)) {
    moduleName = basename(modulePath);
  } else {
    moduleName = basename(modulePath).replace(/\.(sh|zsh)$/, '');
  }
  
  // For fibers in special directories, use the chitin naming convention
  if (moduleType === 'fiber') {
    // Check if this is the core chitin directory
    if (modulePath.includes('/chitin/') && !modulePath.includes('/chitin-')) {
      // If the path exactly matches the main chitin directory, always name it 'core'
      // This prevents duplicate discovery as both 'core' and 'chitin'
      moduleName = 'core';
    } 
    // Check if this is the dotfiles directory as defined in config
    else if (dotfilesDir && (modulePath === dotfilesDir || modulePath.includes(dotfilesDir))) {
      moduleName = 'dotfiles';
    } 
    // For external chitin modules, strip the chitin- prefix
    else if (moduleName.startsWith('chitin-')) {
      moduleName = moduleName.replace(/^chitin-/, '');
    }
  }
  
  // For chains in core directories, use just the basename
  if (moduleType === 'chain' && modulePath.includes('/core/')) {
    moduleName = basename(modulePath).replace(/\.(sh|zsh)$/, '');
  }
  
  // Load module configuration (if it exists)
  let config = null;
  if (await isDirectory(modulePath)) {
    const configPath = join(modulePath, 'config.yaml');
    if (await fileExists(configPath)) {
      config = await loadModuleConfig(modulePath);
    }
  }
  
  // Skip disabled modules
  if (config && config.enabled === false) {
    return null;
  }
  
  // Default config if none exists
  if (!config) {
    config = { enabled: true };
  }
  
  // Extract dependencies
  const dependencies: ModuleDependency[] = [];
  
  if (moduleType === 'fiber' && config && 'fiberDeps' in config && Array.isArray(config.fiberDeps)) {
    for (const depId of config.fiberDeps) {
      dependencies.push({ moduleId: depId });
    }
  } else if (moduleType === 'chain' && config && 'toolDeps' in config && Array.isArray(config.toolDeps)) {
    for (const depId of config.toolDeps) {
      dependencies.push({ moduleId: depId });
    }
  }
  
  return {
    id: moduleName,
    name: moduleName,
    path: modulePath,
    type: moduleType,
    metadata: {
      dependencies
    },
    config
  };
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
