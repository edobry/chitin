/**
 * Utilities for generating graph visualizations for fibers
 */

import { UserConfig } from '../types';
import { isFiberEnabled } from '../commands/fibers/utils';

// GraphViz styling constants
const GRAPH_STYLES = {
  // Node colors
  COLORS: {
    CORE: '#D0E0FF',    // Light blue for core
    ENABLED: '#D0FFD0',  // Light green for enabled
    DISABLED: '#FFD0D0', // Light red for disabled
    DISABLED_TEXT: '#606060' // Gray text for disabled
  },
  
  // Graph settings
  SETTINGS: `  graph [rankdir=LR, fontname="Arial", fontsize=12];
  node [fontname="Arial", fontsize=10, shape=box, style=rounded];
  edge [fontname="Arial", fontsize=9];`,
  
  // Node styles
  NODE_STYLES: {
    BASE: 'style="rounded',
    FILLED: ',filled"',
    DISABLED: ',filled,dashed"'
  },
  
  // Special fiber IDs
  SPECIAL_FIBERS: {
    CORE: 'core',
    DOTFILES: 'dotfiles',
    DEV: 'dev'
  }
};

/**
 * Generate a GraphViz DOT representation of fiber dependencies
 * 
 * @param fibersToShow Array of fiber IDs to include in the graph
 * @param dependencyMap Map of fiber IDs to their dependencies
 * @param reverseDependencyMap Map of fiber IDs to fibers that depend on them
 * @param dependencyDetectionInfo Map of dependency detection sources and their detected dependencies
 * @param config User configuration
 * @param options Options for graph generation
 * @returns String containing the GraphViz DOT representation
 */
export function generateFiberDependencyGraph(
  fibersToShow: string[],
  dependencyMap: Map<string, string[]>,
  reverseDependencyMap: Map<string, string[]>,
  dependencyDetectionInfo: Map<string, {source: string, deps: string[]}[]>,
  config: UserConfig,
  options: { reverse?: boolean }
): string {
  // Build graph header with settings
  let output = `digraph G {
${GRAPH_STYLES.SETTINGS}

  // Nodes (fibers)
`;

  // Create nodes with appropriate styling
  for (const fiberId of fibersToShow) {
    const { CORE, DOTFILES, DEV } = GRAPH_STYLES.SPECIAL_FIBERS;
    const isCore = fiberId === CORE;
    const isEnabled = isCore || isFiberEnabled(fiberId, config);
    
    // Determine node style and colors
    let style, fillColor = '', fontColor = '';
    
    if (isCore) {
      style = `${GRAPH_STYLES.NODE_STYLES.BASE}${GRAPH_STYLES.NODE_STYLES.FILLED}`;
      fillColor = ` fillcolor="${GRAPH_STYLES.COLORS.CORE}"`;
    } else if (isEnabled) {
      style = `${GRAPH_STYLES.NODE_STYLES.BASE}${GRAPH_STYLES.NODE_STYLES.FILLED}`;
      fillColor = ` fillcolor="${GRAPH_STYLES.COLORS.ENABLED}"`;
    } else {
      style = `${GRAPH_STYLES.NODE_STYLES.BASE}${GRAPH_STYLES.NODE_STYLES.DISABLED}`;
      fillColor = ` fillcolor="${GRAPH_STYLES.COLORS.DISABLED}"`;
      fontColor = ` fontcolor="${GRAPH_STYLES.COLORS.DISABLED_TEXT}"`;
    }
    
    output += `  "${fiberId}" [${style}${fillColor}${fontColor}];\n`;
  }
  
  // Extract direct dependencies from detection info
  const directDeps = extractDirectDependencies(
    fibersToShow, 
    dependencyDetectionInfo, 
    GRAPH_STYLES.SPECIAL_FIBERS
  );
  
  // Generate edges for the dependencies
  output += generateDependencyEdges(directDeps, options.reverse);
  
  output += `}`;
  
  return output;
}

/**
 * Extract direct dependencies for each fiber from dependency detection info
 */
function extractDirectDependencies(
  fibersToShow: string[],
  dependencyDetectionInfo: Map<string, {source: string, deps: string[]}[]>,
  specialFibers: { CORE: string, DOTFILES: string, DEV: string }
): Map<string, string[]> {
  const directDeps = new Map<string, string[]>();
  const { CORE, DOTFILES, DEV } = specialFibers;
  
  // Get explicit dependencies from all detection sources
  for (const [fiberId, sources] of dependencyDetectionInfo.entries()) {
    if (fiberId === CORE) continue; // Skip core as it has no dependencies
    
    // Combine all dependencies from all sources
    const allDeps = Array.from(
      new Set(
        sources.flatMap(source => source.deps)
      )
    );
    
    directDeps.set(fiberId, allDeps);
  }
  
  // Add special implicit dependencies if needed
  if (fibersToShow.includes(CORE)) {
    // Ensure dotfiles depends on core
    if (fibersToShow.includes(DOTFILES)) {
      ensureDependency(directDeps, DOTFILES, CORE);
    }
    
    // Ensure dev depends on core
    if (fibersToShow.includes(DEV)) {
      ensureDependency(directDeps, DEV, CORE);
    }
  }
  
  return directDeps;
}

/**
 * Ensure a dependency exists in the dependency map
 */
function ensureDependency(
  depMap: Map<string, string[]>,
  sourceId: string, 
  depId: string
): void {
  const deps = depMap.get(sourceId) || [];
  if (!deps.includes(depId)) {
    depMap.set(sourceId, [...deps, depId]);
  }
}

/**
 * Generate the edges section of the graph
 */
function generateDependencyEdges(
  directDeps: Map<string, string[]>,
  isReversed: boolean = false
): string {
  let edgesOutput = `\n  // Edges (dependencies)\n`;
  
  for (const [fiberId, deps] of directDeps.entries()) {
    if (deps.length > 0) {
      for (const depId of deps) {
        const source = isReversed ? depId : fiberId;
        const target = isReversed ? fiberId : depId;
        edgesOutput += `  "${source}" -> "${target}";\n`;
      }
    }
  }
  
  return edgesOutput;
} 
