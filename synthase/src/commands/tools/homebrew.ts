/**
 * Homebrew utilities specific to tools command
 */
import { ToolConfig } from '../../types';

/**
 * Represents a normalized Homebrew package configuration
 */
export interface NormalizedBrewConfig {
  packageName: string;
  isCask: boolean;
  hasTap: boolean;
  tapName?: string;
  tapUrl?: string;
  displayName: string;
}

/**
 * Normalizes brew package configuration for consistent access
 * @param brewConfig The raw brew configuration from tool config
 * @param toolId The ID of the tool (used as fallback)
 * @returns Normalized brew configuration with consistent access patterns
 */
export function normalizeBrewConfig(brewConfig: any, toolId: string): NormalizedBrewConfig {
  const result: NormalizedBrewConfig = {
    packageName: '',
    isCask: false,
    hasTap: false,
    displayName: ''
  };
  
  // Handle different types of brew configurations
  if (typeof brewConfig === 'string') {
    // Simple string package name
    result.packageName = brewConfig;
    result.displayName = brewConfig;
  } else if (typeof brewConfig === 'boolean' && brewConfig === true) {
    // Boolean true - use toolId as the package name
    result.packageName = toolId;
    result.displayName = toolId;
  } else if (typeof brewConfig === 'object' && brewConfig !== null) {
    // Object configuration with various properties
    
    // Handle name property
    if (brewConfig.name) {
      result.packageName = brewConfig.name;
      result.displayName = brewConfig.name;
    } else {
      // Fallback to toolId
      result.packageName = toolId;
      result.displayName = toolId;
    }
    
    // Handle cask property
    if (brewConfig.cask === true) {
      result.isCask = true;
    } else if (typeof brewConfig.cask === 'string') {
      result.isCask = true;
      result.packageName = brewConfig.cask;
      result.displayName = brewConfig.cask;
    }
    
    // Handle tap property
    if (brewConfig.tap) {
      result.hasTap = true;
      result.tapName = brewConfig.tap;
      
      if (brewConfig.tapUrl) {
        result.tapUrl = brewConfig.tapUrl;
      }
    }
  }
  
  return result;
}

/**
 * Gets the display string for a brew configuration (for logs and UI)
 */
export function getBrewDisplayString(brewConfig: any, toolId: string): string {
  const normalized = normalizeBrewConfig(brewConfig, toolId);
  
  let display = normalized.displayName;
  
  if (normalized.isCask) {
    display += ' (cask)';
  }
  
  if (normalized.hasTap && normalized.tapName) {
    display += ` (from tap: ${normalized.tapName})`;
  }
  
  return display;
}

/**
 * Determines the package name to use for checking if a brew package is installed
 * Domain-specific version that ensures consistent tool naming
 */
export function getToolBrewPackageName(brewConfig: any, toolId: string): string {
  return normalizeBrewConfig(brewConfig, toolId).packageName;
}

/**
 * Determines if a brew config specifies a cask
 * Domain-specific version for tool configurations
 */
export function isToolBrewCask(brewConfig: any): boolean {
  if (typeof brewConfig === 'object' && brewConfig !== null) {
    return brewConfig.cask === true || typeof brewConfig.cask === 'string';
  }
  return false;
} 
