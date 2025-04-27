import { EMOJI } from '../../../constants';
import { FIBER_NAMES } from '../../../fiber/types';
import { DEPENDENCY_TYPES, DEPENDENCY_SOURCES, DEPENDENCY_DISPLAY } from '../../../fiber/constants';
import { isFiberEnabled } from './fiber-utils';
import { UserConfig } from '../../../config/types';

interface DependencySource {
  source: string;
  deps: string[];
}

interface DependencyInfo {
  fiberId: string;
  isEnabled: boolean;
  dependencies: Map<string, string>; // dep -> source type
}

/**
 * Get the status symbol for a fiber
 */
export function getFiberStatusSymbol(isEnabled: boolean): string {
  return isEnabled ? EMOJI.ACTIVE : EMOJI.DISABLED;
}

/**
 * Format dependencies into a clean display string
 */
export function formatDependencies(dependencies: Map<string, string>, prefix: string = ''): string[] {
  return Array.from(dependencies.entries()).map(([dep, sourceType]) => 
    `${prefix}${DEPENDENCY_DISPLAY.BULLET} ${dep}  (${sourceType})`
  );
}

/**
 * Process dependency sources into a consolidated map
 */
export function processDependencySources(
  sources: DependencySource[],
  isCore: boolean,
  hasCore: boolean
): Map<string, string> {
  const dependencies = new Map<string, string>();
  
  // Add implicit core dependency if needed
  if (!isCore && hasCore && !sources.some(s => s.deps.includes(FIBER_NAMES.CORE))) {
    dependencies.set(FIBER_NAMES.CORE, DEPENDENCY_TYPES.IMPLICIT);
  }

  // Process all other dependencies
  for (const source of sources) {
    for (const dep of source.deps) {
      dependencies.set(
        dep, 
        source.source === DEPENDENCY_SOURCES.CORE ? 
          DEPENDENCY_TYPES.IMPLICIT : 
          DEPENDENCY_TYPES.EXPLICIT
      );
    }
  }

  return dependencies;
}

/**
 * Generate the tree node prefix
 */
export function getNodePrefix(prefix: string, isLast: boolean): string {
  return `${prefix}${isLast ? DEPENDENCY_DISPLAY.TREE_LAST : DEPENDENCY_DISPLAY.TREE_BRANCH}`;
}

/**
 * Generate the detail prefix for dependency info
 */
export function getDetailPrefix(prefix: string, isLast: boolean): string {
  return `${prefix}${isLast ? DEPENDENCY_DISPLAY.TREE_INDENT : DEPENDENCY_DISPLAY.TREE_VERTICAL}`;
}

/**
 * Print a dependency node and its details
 */
export function printDependencyNode(
  config: UserConfig,
  fiberId: string,
  prefix: string,
  isLast: boolean,
  detectionInfo: Map<string, DependencySource[]> | null,
  fibersToShow: string[]
): void {
  const isCore = fiberId === FIBER_NAMES.CORE;
  const isEnabled = isCore || isFiberEnabled(fiberId, config);
  const statusSymbol = getFiberStatusSymbol(isEnabled);
  
  // Print the node header
  console.log(`${getNodePrefix(prefix, isLast)}${statusSymbol} ${fiberId}`);
  
  // Print dependency details if we have them
  if (detectionInfo) {
    const sources = detectionInfo.get(fiberId) || [];
    if (sources.length > 0) {
      const detailPrefix = getDetailPrefix(prefix, isLast);
      const dependencies = processDependencySources(sources, isCore, fibersToShow.includes(FIBER_NAMES.CORE));
      
      console.log(`${detailPrefix}${DEPENDENCY_DISPLAY.INDENT}Dependencies:`);
      for (const depLine of formatDependencies(dependencies, `${detailPrefix}${DEPENDENCY_DISPLAY.INDENT}${DEPENDENCY_DISPLAY.INDENT}`)) {
        console.log(depLine);
      }
    }
  }
} 
