import { join, basename } from 'path';
import { UserConfig, Module, ModuleDiscoveryOptions, ModuleDiscoveryResult, ModuleDependency } from '../types';
import { loadModuleConfig } from '../config/loader';
import { fileExists, isDirectory, readDirectory } from '../utils/file';

/**
 * Discovers modules in the specified directories
 * @param options Discovery options
 * @returns Discovery result containing modules and errors
 */
export async function discoverModules(
  options: ModuleDiscoveryOptions
): Promise<ModuleDiscoveryResult> {
  const modules: Module[] = [];
  const errors: string[] = [];
  
  // Default options
  const recursive = options.recursive ?? true;
  const modulePattern = options.modulePattern ?? /^[a-zA-Z0-9_-]+$/;
  const maxDepth = options.maxDepth ?? 3;
  
  // Process each base directory
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
      
      await scanDirectory(baseDir, modules, errors, {
        recursive,
        modulePattern,
        maxDepth,
        currentDepth: 0
      });
    } catch (error) {
      errors.push(`Error scanning ${baseDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return { modules, errors };
}

/**
 * Recursively scans a directory for modules
 * @param dirPath Directory path to scan
 * @param modules Array to populate with found modules
 * @param errors Array to populate with errors
 * @param options Scan options
 */
async function scanDirectory(
  dirPath: string,
  modules: Module[],
  errors: string[],
  options: {
    recursive: boolean;
    modulePattern: RegExp;
    maxDepth: number;
    currentDepth: number;
  }
): Promise<void> {
  // Stop if we've exceeded max depth
  if (options.currentDepth > options.maxDepth) {
    return;
  }
  
  try {
    const entries = await readDirectory(dirPath);
    
    // First check if the current directory is a module
    const configPath = join(dirPath, 'config.yaml');
    if (await fileExists(configPath)) {
      try {
        // This directory contains a config.yaml, so it might be a module
        const moduleType = await identifyModuleType(dirPath);
        if (moduleType) {
          const module = await createModule(dirPath, moduleType);
          if (module) {
            modules.push(module);
          }
        }
      } catch (error) {
        errors.push(`Error loading module at ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // If not recursive, stop here
    if (!options.recursive) {
      return;
    }
    
    // Process subdirectories
    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      
      // Skip files and directories that don't match the pattern
      if (!await isDirectory(entryPath) || !options.modulePattern.test(entry)) {
        continue;
      }
      
      // Recursively scan subdirectory
      await scanDirectory(entryPath, modules, errors, {
        ...options,
        currentDepth: options.currentDepth + 1
      });
    }
  } catch (error) {
    errors.push(`Error reading directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Identifies the module type based on its directory structure
 * @param modulePath Path to potential module directory
 * @returns Module type or null if not a valid module
 */
async function identifyModuleType(modulePath: string): Promise<'fiber' | 'chain' | null> {
  // A fiber directory typically contains chain subdirectories
  const entries = await readDirectory(modulePath);
  
  // Check if it's a chain (contains shell scripts)
  const hasShellScripts = entries.some(entry => entry.endsWith('.sh') || entry.endsWith('.zsh'));
  if (hasShellScripts) {
    return 'chain';
  }
  
  // Check if it has chain subdirectories (making it a fiber)
  for (const entry of entries) {
    const entryPath = join(modulePath, entry);
    if (await isDirectory(entryPath)) {
      const chainConfigPath = join(entryPath, 'config.yaml');
      if (await fileExists(chainConfigPath)) {
        return 'fiber';
      }
    }
  }
  
  // If we couldn't definitively determine, check if it has a config that specifies
  const config = await loadModuleConfig(modulePath);
  if (config) {
    if ('fiberDeps' in config) {
      return 'fiber';
    }
    if ('toolDeps' in config) {
      return 'chain';
    }
  }
  
  return null;
}

/**
 * Creates a Module object from a directory
 * @param modulePath Path to the module directory
 * @param moduleType Type of the module
 * @returns Module object or null if invalid
 */
async function createModule(modulePath: string, moduleType: 'fiber' | 'chain'): Promise<Module | null> {
  const moduleName = basename(modulePath);
  
  // Load module configuration
  const config = await loadModuleConfig(modulePath);
  if (!config) {
    return null;
  }
  
  // Skip disabled modules
  if (config.enabled === false) {
    return null;
  }
  
  // Extract dependencies
  const dependencies: ModuleDependency[] = [];
  
  if (moduleType === 'fiber' && 'fiberDeps' in config) {
    for (const depId of config.fiberDeps || []) {
      dependencies.push({ moduleId: depId });
    }
  } else if (moduleType === 'chain' && 'toolDeps' in config) {
    for (const depId of config.toolDeps || []) {
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
 * Discovers modules based on user configuration
 * @param userConfig User configuration
 * @returns Discovery result containing modules and errors
 */
export async function discoverModulesFromConfig(userConfig: UserConfig): Promise<ModuleDiscoveryResult> {
  const baseDirs: string[] = [];
  
  // Add primary chitin directory
  const chitinDir = process.env.CHI_DIR || '';
  if (chitinDir) {
    // Only add chains subdirectory if it exists
    const chainsDir = join(chitinDir, 'chains');
    if (await fileExists(chainsDir) && await isDirectory(chainsDir)) {
      baseDirs.push(chainsDir);
    }
  }
  
  // Add project directory from config
  if (userConfig.core.projectDir) {
    baseDirs.push(userConfig.core.projectDir);
  }
  
  // Add dotfiles directory from config
  if (userConfig.core.dotfilesDir) {
    baseDirs.push(userConfig.core.dotfilesDir);
  }
  
  return discoverModules({
    baseDirs,
    recursive: true,
    maxDepth: 3
  });
} 
