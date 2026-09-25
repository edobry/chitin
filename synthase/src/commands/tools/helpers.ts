/**
 * Helper functions for the tools command
 */
import { Module } from '../../types/module';
import { ToolConfig } from '../../types/config';
import { debug, setLogLevel, LogLevel } from '../../utils/logger';
import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { loadParentConfig, extractAllTools } from './discovery';
import { filterTools } from './filter';

/**
 * Context for tools command handlers
 */
export interface ToolSetupContext {
  tools: Map<string, { config: ToolConfig, source: string }>;
  filteredTools: Map<string, { config: ToolConfig, source: string }>;
  modules: Module[];
  options: any;
}

/**
 * Set up the tools command environment and execute a callback
 * @param callback Function to execute with the tools context
 * @param options Command options
 * @returns Result from the callback
 */
export async function withToolSetup<T>(
  callback: (context: ToolSetupContext) => Promise<T>,
  options: any
): Promise<T> {
  try {
    if (process.env.DEBUG === 'true') {
      setLogLevel(LogLevel.DEBUG);
    }
    
    // Load configuration and validate
    const { config } = await loadAndValidateConfig();
    debug('Discovering modules');
    // Discover modules
    const discoveryResult = await discoverModulesFromConfig(config);
    const modules: Module[] = discoveryResult.modules || [];
    debug(`Found ${modules.length} modules`);
    
    // Initialize the parent project configuration
    // Always try to find the parent first
    loadParentConfig(process.cwd());
    
    // Extract tools from all sources
    const tools = extractAllTools(config, modules);
    
    // Apply filters
    const filteredTools = filterTools(tools, {
      filterSource: options.filterSource,
      filterCheck: options.filterCheck,
      filterInstall: options.filterInstall
    });
    
    // Call the specific handler with the prepared context
    return await callback({ tools, filteredTools, modules, options });
  } catch (err) {
    // Explicitly log the error
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    
    // Re-throw the error instead of calling process.exit
    // This allows promise rejection to propagate naturally
    throw err;
  }
} 
