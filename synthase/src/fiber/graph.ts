/**
 * Utilities for generating graph visualizations for fibers
 */

import { UserConfig } from '../types';
import { isFiberEnabled } from '../commands/fibers/utils';
import { FIBER_NAMES } from './types';

// GraphViz styling constants
const GRAPH_STYLES = {
  // Common style values
  VALUES: {
    FONT: 'Arial',
    FONTSIZE: {
      GRAPH: '12',
      NODE: '10',
      EDGE: '9'
    },
    SHAPE: 'box',
    DIRECTION: 'LR'
  },
  
  // Style components
  STYLE: {
    ROUNDED: 'rounded',
    FILLED: 'filled',
    DASHED: 'dashed'
  },
  
  // Node colors
  COLORS: {
    CORE: '#D0E0FF',    // Light blue for core
    ENABLED: '#D0FFD0',  // Light green for enabled
    DISABLED: '#FFD0D0', // Light red for disabled
    DISABLED_TEXT: '#606060' // Gray text for disabled
  },
  
  // Graph settings (using template literals with extracted constants)
  get SETTINGS() {
    const { FONT, FONTSIZE, SHAPE, DIRECTION } = this.VALUES;
    return `  graph [rankdir=${DIRECTION}, fontname="${FONT}", fontsize=${FONTSIZE.GRAPH}];
  node [fontname="${FONT}", fontsize=${FONTSIZE.NODE}, shape=${SHAPE}];
  edge [fontname="${FONT}", fontsize=${FONTSIZE.EDGE}];`;
  },
  
  // Node styles (using extracted constants with comma separation)
  NODE_STYLES: {
    get ROUNDED() {
      const { ROUNDED } = GRAPH_STYLES.STYLE;
      return `style="${ROUNDED}"`;
    },
    get FILLED() {
      const { ROUNDED, FILLED } = GRAPH_STYLES.STYLE;
      return `style="${ROUNDED},${FILLED}"`;
    },
    get DISABLED() {
      const { ROUNDED, FILLED, DASHED } = GRAPH_STYLES.STYLE;
      return `style="${ROUNDED},${FILLED},${DASHED}"`;
    }
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
    const isCore = fiberId === FIBER_NAMES.CORE;
    const isEnabled = isCore || isFiberEnabled(fiberId, config);
    
    // Determine node style and colors
    let nodeStyle = '';
    let fillColor = '';
    let fontColor = '';
    
    if (isCore) {
      nodeStyle = GRAPH_STYLES.NODE_STYLES.FILLED;
      fillColor = ` fillcolor="${GRAPH_STYLES.COLORS.CORE}"`;
    } else if (isEnabled) {
      nodeStyle = GRAPH_STYLES.NODE_STYLES.FILLED;
      fillColor = ` fillcolor="${GRAPH_STYLES.COLORS.ENABLED}"`;
    } else {
      nodeStyle = GRAPH_STYLES.NODE_STYLES.DISABLED;
      fillColor = ` fillcolor="${GRAPH_STYLES.COLORS.DISABLED}"`;
      fontColor = ` fontcolor="${GRAPH_STYLES.COLORS.DISABLED_TEXT}"`;
    }
    
    output += `  "${fiberId}" [${nodeStyle}${fillColor}${fontColor}];\n`;
  }
  
  // Extract direct dependencies from detection info
  const directDeps = extractDirectDependencies(
    fibersToShow, 
    dependencyDetectionInfo, 
    { CORE: FIBER_NAMES.CORE, DOTFILES: FIBER_NAMES.DOTFILES }
  );
  
  // Generate edges for the dependencies
  output += generateDependencyEdges(directDeps, options.reverse);
  
  output += `}`;
  
  return output;
}

/**
 * Extract direct dependencies from detection info
 * Filter out redundant dependencies 
 */
function extractDirectDependencies(
  fibersToShow: string[],
  dependencyDetectionInfo: Map<string, {source: string, deps: string[]}[]>,
  specialFibers: { CORE: string, DOTFILES: string }
): Map<string, string[]> {
  const { CORE, DOTFILES } = specialFibers;
  
  // Create a map for the final dependencies
  const finalDeps = new Map<string, string[]>();
  
  // Process all fibers and collect their direct dependencies
  for (const fiberId of fibersToShow) {
    const allDeps: string[] = [];
    const detectionSources = dependencyDetectionInfo.get(fiberId) || [];
    
    for (const source of detectionSources) {
      for (const dep of source.deps) {
        if (fibersToShow.includes(dep) && !allDeps.includes(dep)) {
          allDeps.push(dep);
        }
      }
    }
    
    finalDeps.set(fiberId, allDeps);
  }

  // Special case: dotfiles always depends directly on core if both exist
  if (fibersToShow.includes(DOTFILES) && fibersToShow.includes(CORE)) {
    const dotfilesDeps = finalDeps.get(DOTFILES) || [];
    if (!dotfilesDeps.includes(CORE)) {
      dotfilesDeps.push(CORE);
      finalDeps.set(DOTFILES, dotfilesDeps);
    }
  }
  
  // Add core dependency only to top-level fibers (those with no other dependencies)
  for (const fiberId of fibersToShow) {
    if (fiberId === CORE) continue; // Skip core itself
    
    const deps = finalDeps.get(fiberId) || [];
    
    // If the fiber has no dependencies other than possibly core
    // or if it only depends on dotfiles, add core dependency
    if ((deps.length === 0) || 
        (deps.length === 1 && deps[0] === DOTFILES)) {
      if (!deps.includes(CORE)) {
        deps.push(CORE);
        finalDeps.set(fiberId, deps);
      }
    }
  }
  
  return finalDeps;
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
