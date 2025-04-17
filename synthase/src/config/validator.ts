import { UserConfig, ChainConfig, FiberConfig, ToolConfig, ConfigValidationResult } from '../types';
import { expandPath, fileExists, isDirectory } from '../utils/file';
import { statSync } from 'fs';

/**
 * Synchronously checks if a file exists
 * @param path File path
 * @returns Whether the file exists
 */
function fileExistsSync(path: string): boolean {
  try {
    return statSync(path).isFile() || statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Synchronously checks if a path is a directory
 * @param path Path to check
 * @returns Whether the path is a directory
 */
function isDirectorySync(path: string): boolean {
  try {
    const stats = statSync(path);
    return stats.isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Validates the user configuration
 * @param config Configuration to validate
 * @returns Validation result
 */
export function validateUserConfig(config: UserConfig): ConfigValidationResult {
  const errors: string[] = [];
  
  // Check if core fiber is present
  if (!config.core) {
    errors.push('Missing required fiber: core');
    return {
      valid: false,
      errors,
    };
  }
  
  // Check if core.projectDir field is present
  if (config.core.projectDir === undefined) {
    errors.push('Missing required field: core.projectDir');
  } else {
    // Validate projectDir exists
    const expandedProjectDir = expandPath(config.core.projectDir);
    if (!fileExistsSync(expandedProjectDir)) {
      errors.push(`Project directory does not exist: ${expandedProjectDir} (${config.core.projectDir})`);
    } else if (!isDirectorySync(expandedProjectDir)) {
      errors.push(`Project directory is not a directory: ${expandedProjectDir} (${config.core.projectDir})`);
    }
  }
  
  // Check if dotfilesDir exists
  if (config.core.dotfilesDir !== undefined) {
    const expandedDotfilesDir = expandPath(config.core.dotfilesDir);
    if (!fileExistsSync(expandedDotfilesDir)) {
      errors.push(`Dotfiles directory does not exist: ${expandedDotfilesDir} (${config.core.dotfilesDir})`);
    } else if (!isDirectorySync(expandedDotfilesDir)) {
      errors.push(`Dotfiles directory is not a directory: ${expandedDotfilesDir} (${config.core.dotfilesDir})`);
    }
  }
  
  // Validate core fiber
  const coreValidation = validateFiberConfig(config.core);
  if (!coreValidation.valid) {
    errors.push('Invalid core fiber configuration:');
    errors.push(...coreValidation.errors.map(err => `  - ${err}`));
  }
  
  // Validate other fibers
  for (const [fiberName, fiberConfig] of Object.entries(config)) {
    if (fiberName === 'core') continue;
    
    const fiberValidation = validateFiberConfig(fiberConfig);
    if (!fiberValidation.valid) {
      errors.push(`Invalid fiber configuration for ${fiberName}:`);
      errors.push(...fiberValidation.errors.map(err => `  - ${err}`));
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a fiber configuration
 * @param config Fiber configuration to validate
 * @returns Validation result
 */
export function validateFiberConfig(config: FiberConfig): ConfigValidationResult {
  const errors: string[] = [];
  
  // Check that fiberDeps is an array if present
  if (config.fiberDeps !== undefined && !Array.isArray(config.fiberDeps)) {
    errors.push('fiberDeps must be an array');
  }
  
  // Validate moduleConfig if present
  if (config.moduleConfig) {
    if (typeof config.moduleConfig !== 'object') {
      errors.push('moduleConfig must be an object');
    } else {
      for (const [moduleName, moduleConfig] of Object.entries(config.moduleConfig)) {
        const chainValidation = validateChainConfig(moduleConfig);
        if (!chainValidation.valid) {
          errors.push(`Invalid moduleConfig for ${moduleName}:`);
          errors.push(...chainValidation.errors.map(err => `  - ${err}`));
        }
      }
    }
  }
  
  // Validate tools if present
  if (config.tools) {
    if (typeof config.tools !== 'object') {
      errors.push('tools must be an object');
    } else {
      for (const [toolName, toolConfig] of Object.entries(config.tools)) {
        const toolValidation = validateToolConfig(toolConfig, toolName);
        if (!toolValidation.valid) {
          errors.push(`Invalid tool configuration for ${toolName}:`);
          errors.push(...toolValidation.errors.map(err => `  - ${err}`));
        }
      }
    }
  }
  
  // Check that toolDeps is an array if present
  if (config.toolDeps !== undefined && !Array.isArray(config.toolDeps)) {
    errors.push('toolDeps must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a chain configuration
 * @param config Chain configuration to validate
 * @returns Validation result
 */
export function validateChainConfig(config: ChainConfig): ConfigValidationResult {
  const errors: string[] = [];
  
  // Check that toolDeps is an array if present
  if (config.toolDeps !== undefined && !Array.isArray(config.toolDeps)) {
    errors.push('toolDeps must be an array');
  }
  
  // Validate tools if present
  if (config.tools !== undefined) {
    if (typeof config.tools !== 'object') {
      errors.push('tools must be an object');
    } else {
      for (const [toolName, toolConfig] of Object.entries(config.tools)) {
        const toolValidation = validateToolConfig(toolConfig, toolName);
        if (!toolValidation.valid) {
          errors.push(`Invalid tool configuration for ${toolName}:`);
          errors.push(...toolValidation.errors.map(err => `  - ${err}`));
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a tool configuration
 * @param config Tool configuration to validate
 * @param toolName Name of the tool being validated
 * @returns Validation result
 */
export function validateToolConfig(config: ToolConfig, toolName?: string): ConfigValidationResult {
  const errors: string[] = [];
  
  // Check that at least one check method is defined unless optional is true
  const hasCheckMethod = 
    config.checkCommand !== undefined || 
    config.checkBrew !== undefined || 
    config.checkPath !== undefined || 
    config.checkEval !== undefined;
  
  // If no check method is specified, use the tool name as a default check command
  // This matches the behavior of the original Chitin implementation
  if (!hasCheckMethod && config.optional !== true) {
    if (toolName) {
      // Apply the default check method (command -v toolName)
      const defaultCheck = `command -v ${toolName}`;
      // Actually modify the config to set the default check method
      config.checkCommand = defaultCheck;
    } else {
      // If toolName is not provided, we can't create a default check
      errors.push('Tool must have at least one check method or be marked as optional');
    }
  }
  
  // If version is defined, versionCommand should also be defined
  if (config.version !== undefined && config.versionCommand === undefined) {
    errors.push('versionCommand is required when version is specified');
  }
  
  // Validate install method - only one install method should be defined
  const installMethods = [
    config.brew !== undefined,
    config.git !== undefined,
    config.script !== undefined,
    config.artifact !== undefined, 
    config.command !== undefined
  ];
  
  if (installMethods.filter(Boolean).length > 1) {
    errors.push('Only one install method should be defined');
  }
  
  // Validate git configuration
  if (config.git) {
    if (!config.git.url) {
      errors.push('git.url is required for git install method');
    }
    if (!config.git.target) {
      errors.push('git.target is required for git install method');
    }
  }
  
  // Validate artifact configuration
  if (config.artifact) {
    if (!config.artifact.url) {
      errors.push('artifact.url is required for artifact install method');
    }
    if (!config.artifact.target) {
      errors.push('artifact.target is required for artifact install method');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
} 
