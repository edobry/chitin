/**
 * Tool discovery utilities for tools command
 */
import { UserConfig, ToolConfig, FiberConfig, ChainConfig, Module } from '../../types';
import { loadYamlFile } from '../../utils/yaml';
import { debug } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load the parent configuration if available
 * @param filePath Current directory or file path
 * @returns Parent configuration or null
 */
export function loadParentConfig(filePath: string): any {
  try {
    const dir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const parentConfigPath = path.join(dir, 'config.yaml');

    if (fs.existsSync(parentConfigPath)) {
      debug(`Found parent config at ${parentConfigPath}`);
      return loadYamlFile(parentConfigPath);
    }
  } catch (err) {
    debug(`Error loading parent config: ${err}`);
  }
  
  return null;
}

/**
 * Extract all tools from the configuration and modules
 * @param config User configuration
 * @param modules Discovered modules
 * @param rootModuleName Optional root module name
 * @returns Map of tools with their configurations and sources
 */
export function extractAllTools(
  config: UserConfig, 
  modules: Module[] = [],
  rootModuleName: string = ''
): Map<string, { config: ToolConfig, source: string }> {
  const tools = new Map<string, { config: ToolConfig, source: string }>();
  
  // Function to add a tool to the map
  const addTool = (toolId: string, toolConfig: ToolConfig, source: string) => {
    if (!tools.has(toolId)) {
      tools.set(toolId, { config: toolConfig, source });
    }
  };
  
  // Process a module's tools
  const processModuleTools = (moduleId: string, moduleConfig: ChainConfig | FiberConfig) => {
    if (!moduleConfig || !moduleConfig.tools) return;
    
    for (const [toolId, toolConfig] of Object.entries(moduleConfig.tools)) {
      addTool(toolId, toolConfig, moduleId);
    }
  };
  
  // Process modules discovered from the file system
  modules.forEach(module => {
    const moduleId = module.id;
    const moduleConfig = module.config;
    
    if (moduleConfig) {
      processModuleTools(moduleId, moduleConfig);
    }
  });
  
  // Process user config for explicit tool definitions
  Object.entries(config).forEach(([fiberName, fiberConfig]) => {
    if (fiberName === 'core') return; // Skip core config as it's not a fiber
    
    // Process fiber-level tools
    processModuleTools(fiberName, fiberConfig as FiberConfig);
    
    // Process chain-level tools
    const moduleConfig = (fiberConfig as FiberConfig).moduleConfig;
    if (moduleConfig) {
      Object.entries(moduleConfig).forEach(([chainName, chainConfig]) => {
        const chainId = `${fiberName}:${chainName}`;
        processModuleTools(chainId, chainConfig);
      });
    }
  });
  
  // Process core config for global tools
  if (config.core && config.core.moduleConfig) {
    Object.entries(config.core.moduleConfig).forEach(([chainName, chainConfig]) => {
      const chainId = `chitin:${chainName}`;
      processModuleTools(chainId, chainConfig);
    });
  }
  
  return tools;
} 
