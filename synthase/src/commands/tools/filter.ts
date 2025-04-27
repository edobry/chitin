/**
 * Filtering utilities for tools command
 */
import { ToolConfig } from '../../types';
import { getToolCheckMethod, getToolInstallMethod } from '../../utils/tools';

/**
 * Filter options for filtering tools
 */
export interface ToolFilterOptions {
  filterSource?: string;
  filterCheck?: string;
  filterInstall?: string;
}

/**
 * Filter tools based on specified criteria
 * @param tools Tools map
 * @param options Filter options
 * @returns Filtered tools map
 */
export function filterTools(
  tools: Map<string, { config: ToolConfig, source: string }>,
  options: ToolFilterOptions
): Map<string, { config: ToolConfig, source: string }> {
  const { filterSource, filterCheck, filterInstall } = options;
  
  if (!filterSource && !filterCheck && !filterInstall) {
    return tools;
  }
  
  const filtered = new Map();
  
  for (const [toolId, { config, source }] of tools.entries()) {
    let include = true;
    
    // Filter by source
    if (filterSource && !source.toLowerCase().includes(filterSource.toLowerCase())) {
      include = false;
    }
    
    // Filter by check method
    if (filterCheck && getToolCheckMethod(config).toLowerCase() !== filterCheck.toLowerCase()) {
      include = false;
    }
    
    // Filter by install method
    if (filterInstall && getToolInstallMethod(config).toLowerCase() !== filterInstall.toLowerCase()) {
      include = false;
    }
    
    if (include) {
      filtered.set(toolId, { config, source });
    }
  }
  
  return filtered;
} 
