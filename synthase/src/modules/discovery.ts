import { join, basename, dirname } from 'path';
import { UserConfig, Module, ModuleDiscoveryOptions, ModuleDiscoveryResult, ModuleDependency } from '../types';
import { loadModuleConfig, getProjectDir, getDotfilesDir } from '../config/loader';
import { fileExists, isDirectory, readDirectory, expandPath } from '../utils/file';
import { glob } from 'glob';
import { stat, readFile } from 'fs/promises';
// Debug utility to show logs only when DEBUG environment variable is set
const DEBUG = process.env.DEBUG === 'true';
const debug = (message: string, ...args: any[]) => {
  if (DEBUG) {
    if (args.length > 0) {
      console.log(`[DEBUG] ${message}`, ...args);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
};

// Helper function to read and parse JSON files
async function readJson(path: string) {
  const content = await readFile(path, 'utf8');
  return JSON.parse(content);
}

// Helper function to get file stats
async function statAsync(path: string) {
  return stat(path);
}

// Helper functions to standardize path checks
function isChitinMainDir(path: string): boolean {
  return path.endsWith('/chitin') || path.includes('/chitin/') && !path.includes('/chitin-');
}

function isDotfilesDir(path: string, dotfilesDir?: string): boolean {
  return !!dotfilesDir && (path === dotfilesDir || path.includes(dotfilesDir));
}

/**
 * Discovers modules in the specified directories using Chitin's directory structure
 * @param options Discovery options
 * @returns Discovery result containing modules and errors
 */
export async function discoverModules(
  options: ModuleDiscoveryOptions
): Promise<ModuleDiscoveryResult> {
  const { 
    baseDirs = [], 
    recursive = false, 
    dotfilesDir
  } = options;
  
  const modules: Module[] = [];
  const errors: string[] = [];
  
  // Create a Map to track paths that we've already processed
  const processedPaths = new Map<string, string>();
  
  // Function to check if we've already processed a module path
  const hasProcessedPath = (path: string): boolean => {
    return processedPaths.has(path);
  };
  
  // Function to add a processed path to our tracker
  const addProcessedPath = (path: string, moduleId: string): void => {
    processedPaths.set(path, moduleId);
    debug(`Registered processed path: ${path} (${moduleId})`);
  };
  
  // Process each base directory
  for (const baseDir of baseDirs) {
    try {
      if (!await fileExists(baseDir)) {
        errors.push(`Base directory not found: ${baseDir}`);
        continue;
      }
      
      if (!await isDirectory(baseDir)) {
        errors.push(`Not a directory: ${baseDir}`);
        continue;
      }
      
      // Skip if we've already processed this directory
      if (hasProcessedPath(baseDir)) {
        debug(`Skipping already processed directory: ${baseDir}`);
        continue;
      }
      
      // Try to create a module for this directory
      const fiberModule = await createModule(baseDir, 'fiber', dotfilesDir);
      
      // Add it to our collection if it's valid
      if (fiberModule) {
        addProcessedPath(baseDir, fiberModule.id);
        modules.push(fiberModule);
      }
      
      // Check for chains directory inside this fiber
      const chainsDir = join(baseDir, 'chains');
      if (await fileExists(chainsDir) && await isDirectory(chainsDir)) {
        // Process chains in this directory
        await processChainDirectory(chainsDir, baseDir, modules, errors, processedPaths, dotfilesDir);
      }
    } catch (error) {
      errors.push(`Error processing directory ${baseDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return { modules, errors };
}

/**
 * Process a chains directory to discover chain modules
 */
async function processChainDirectory(
  chainsDir: string,
  fiberDir: string,
  modules: Module[],
  errors: string[],
  processedPaths: Map<string, string>,
  dotfilesDir?: string
): Promise<void> {
  // Skip if already processed
  if (processedPaths.has(chainsDir)) {
    debug(`Skipping already processed chains directory: ${chainsDir}`);
    return;
  }
  
  // Mark this directory as processed
  processedPaths.set(chainsDir, `${basename(fiberDir)}:chains`);
  
  try {
    // Determine parent fiber ID
    let parentFiberId: string;
    
    if (isChitinMainDir(fiberDir)) {
      parentFiberId = 'core';
    } else if (isDotfilesDir(fiberDir, dotfilesDir)) {
      parentFiberId = 'dotfiles';
    } else {
      parentFiberId = basename(fiberDir).replace(/^chitin-/, '');
    }
    
    debug(`Processing chains for fiber: ${parentFiberId}`);
    
    // List all entries in the directory
    const entries = await readDirectory(chainsDir);
    
    // Process shell script files first (.sh, .zsh)
    for (const entry of entries) {
      const entryPath = join(chainsDir, entry);
      
      // Skip if already processed
      if (processedPaths.has(entryPath)) {
        continue;
      }
      
      // Process shell script files
      if (!await isDirectory(entryPath) && (entry.endsWith('.sh') || entry.endsWith('.zsh'))) {
        try {
          const module = await createModule(entryPath, 'chain', dotfilesDir);
          if (module) {
            // Add to processed paths
            processedPaths.set(entryPath, module.id);
            
            // Set parent fiber and add to modules
            module.parentFiberId = parentFiberId;
            modules.push(module);
            
            debug(`Added chain module: ${module.id} (parent: ${parentFiberId})`);
          }
        } catch (error) {
          errors.push(`Error loading chain file ${entryPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    // Process subdirectories (nested chains)
    for (const entry of entries) {
      const entryPath = join(chainsDir, entry);
      
      // Skip if already processed
      if (processedPaths.has(entryPath)) {
        continue;
      }
      
      // Skip the core directory in chitin/chains
      if (chainsDir.includes('/chitin/chains') && entry === 'core') {
        continue;
      }
      
      // Process directory as potential chain
      if (await isDirectory(entryPath)) {
        try {
          const module = await createModule(entryPath, 'chain', dotfilesDir);
          if (module) {
            // Add to processed paths
            processedPaths.set(entryPath, module.id);
            
            // Set parent fiber and add to modules
            module.parentFiberId = parentFiberId;
            modules.push(module);
            
            debug(`Added chain directory module: ${module.id} (parent: ${parentFiberId})`);
          }
        } catch (error) {
          errors.push(`Error loading chain directory ${entryPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Error processing chains directory ${chainsDir}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a module from a path
 * @param path Path to the module
 * @param type Type of module (fiber or chain)
 * @param dotfilesDir Dotfiles directory
 * @returns Module object
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
    let id = moduleName;
    
    // Handle special cases
    
    // 1. Strip .sh/.zsh extension for chain files
    if (type === 'chain' && !stats.isDirectory()) {
      moduleName = moduleName.replace(/\.(sh|zsh)$/, '');
      id = moduleName;
    }
    
    // 2. Handle core fiber
    if (type === 'fiber' && isChitinMainDir(path)) {
      id = 'core';
      moduleName = 'core';
    } 
    // 3. Handle dotfiles
    else if (isDotfilesDir(path, dotfilesDir)) {
      id = 'dotfiles';
      moduleName = 'dotfiles';
    }
    // 4. Handle external chitin-* fibers
    else if (moduleName.startsWith('chitin-')) {
      id = moduleName.replace(/^chitin-/, '');
    }
    
    // 5. Handle hidden files (starting with dot)
    if (moduleName.startsWith('.') && !isDotfilesDir(path, dotfilesDir)) {
      id = moduleName.substring(1);
    }
    
    // Set up basic module configuration
    let moduleConfig: any = { enabled: true };
    let description: string | undefined;
    
    // Load configuration based on module type and path
    if (stats.isDirectory()) {
      // Try to load config.yaml if it exists
      const configPath = join(path, 'config.yaml');
      if (await fileExists(configPath)) {
        try {
          const loadedConfig = await loadModuleConfig(configPath);
          if (loadedConfig) {
            moduleConfig = loadedConfig;
            
            // Ensure enabled is defined
            if (moduleConfig.enabled === undefined) {
              moduleConfig.enabled = true;
            }
          }
        } catch (error) {
          debug(`Error loading config from ${configPath}: ${error}`);
        }
      }
      
      // Try to load package.json for description
      try {
        const pkgJsonPath = join(path, 'package.json');
        if (await fileExists(pkgJsonPath)) {
          const pkgJson = await readJson(pkgJsonPath);
          if (typeof pkgJson.description === 'string') {
            description = pkgJson.description;
          }
        }
      } catch (error) {
        debug(`Error reading package.json for ${path}: ${error}`);
      }
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
      config: moduleConfig,
      isEnabled: true // Default to enabled, will be updated later with user config
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
    // Use glob to find chitin-* directories
    const pattern = join(projectDir, 'chitin-*');
    debug(`Looking for external fibers matching pattern: ${pattern}`);
    
    // Find all matches and filter to directories only
    const matches = await glob(pattern);
    const dirMatches = [];
    
    for (const match of matches) {
      if (await isDirectory(match)) {
        debug(`Found external fiber directory: ${match}`);
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
 * Determine if a module should be considered enabled based on execution logic
 * @param id Module ID
 * @param type Module type
 * @param config User configuration
 * @returns Whether the module is enabled
 */
export function determineModuleEnabledState(
  id: string,
  type: 'fiber' | 'chain',
  parentFiberId: string | undefined,
  config: Record<string, any>
): boolean {
  // Core fiber is always enabled
  if (type === 'fiber' && id === 'core') {
    return true;
  }

  // For fibers, check if explicitly disabled
  if (type === 'fiber') {
    // If fiber is in config but explicitly disabled, it's disabled
    if (id in config && config[id]?.enabled === false) {
      return false;
    }
    // Otherwise fibers are considered enabled
    return true;
  }

  // For chains, check if explicitly disabled in parent fiber's moduleConfig
  if (type === 'chain' && parentFiberId) {
    const parentFiber = config[parentFiberId];
    if (parentFiber?.moduleConfig?.[id]?.enabled === false) {
      return false;
    }
    // Chains are enabled unless explicitly disabled
    return true;
  }

  // Default to enabled
  return true;
}

/**
 * Updates module enabled states based on user configuration
 * @param modules Array of discovered modules
 * @param config User configuration
 * @returns Updated array of modules
 */
export function updateModuleEnabledStates(
  modules: Module[],
  config: Record<string, any>
): Module[] {
  return modules.map(module => {
    // Calculate the correct enabled state based on execution logic
    const isEnabled = determineModuleEnabledState(
      module.id,
      module.type,
      module.parentFiberId,
      config
    );
    
    // Return a new module with the updated enabled state
    return {
      ...module,
      isEnabled
    };
  });
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
  
  // Add chitin-* directories from project dir
  const projectDir = getProjectDir(userConfig);
  if (projectDir && await fileExists(projectDir) && await isDirectory(projectDir)) {
    const chitinExternalDirs = await findChitinExternalDirs(projectDir);
    baseDirs.push(...chitinExternalDirs);
  }
  
  // Perform discovery 
  const discoveryResult = await discoverModules({
    baseDirs,
    recursive: false,
    dotfilesDir
  });
  
  // Update enabled states based on user configuration
  const updatedModules = updateModuleEnabledStates(discoveryResult.modules, userConfig);
  
  return {
    modules: updatedModules,
    errors: discoveryResult.errors
  };
} 
