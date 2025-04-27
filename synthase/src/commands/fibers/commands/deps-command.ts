import { Command } from 'commander';
import { serializeToYaml } from '../../../utils';
import { loadAndValidateConfig } from '../../utils';
import { discoverModulesFromConfig } from '../../../modules/discovery';
import { validateModulesAgainstConfig } from '../../../modules/validator';
import { 
  getLoadableFibers, 
  areFiberDependenciesSatisfied, 
  createChainFilter,
  getFiberIds,
  getChainIds,
  orderChainsByDependencies,
} from '../../../fiber';
import {
  orderFibers,
  getDependentFibers,
  getChainDependencies,
  ensureCoreDependencies
} from '../utils/dependency-utils';
import {
  isFiberEnabled,
  countDisplayedModules
} from '../utils/fiber-utils';
import {
  associateChainsByFiber,
  filterDisabledFibers
} from '../organization';
import { join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { FIBER_NAMES } from '../../../fiber/types';
import { CONFIG_FIELDS, FILE_NAMES } from '../../../config/types';
import { EMOJI } from '../../../constants';
import { loadConfigAndModules } from '../utils/config-loader';
import { printDependencyNode } from '../utils/dependency-display';
import { DEPENDENCY_DISPLAY } from '../../../fiber/constants';

// Import generateFiberDependencyGraph from fiber/graph.ts
import { generateFiberDependencyGraph } from '../../../fiber/graph';
import { UserConfig } from '../../../config/types';
import { 
  buildFiberDependencyGraph, 
  dependencyGraphToJson,
  FiberDependencyGraph,
  FiberEnvironment
} from '../../../fiber/dependency-graph';

/**
 * Create the 'deps' subcommand for showing fiber dependencies in a diagram
 * @returns Configured Command object
 */
export function createDepsCommand(): Command {
  return new Command('deps')
    .description('Display fiber dependency diagram')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-b, --base-dirs <dirs...>', 'Additional base directories to scan for modules')
    .option('-H, --hide-disabled', 'Hide disabled fibers')
    .option('-r, --reverse', 'Show reverse dependencies (what requires this fiber)')
    .option('-d, --detailed', 'Show detailed dependency information')
    .option('-f, --flat', 'Show flat list instead of tree view')
    .option('-g, --graphviz', 'Output dependencies in GraphViz DOT format')
    .option('-j, --json', 'Output dependency information in JSON format')
    .action(async (options) => {
      try {
        const environment = await loadConfigAndModules(options);
        const { config, moduleResult, displayFiberIds, orderedFibers } = environment;

        // Build the fiber dependency graph using our extracted utility
        const graph = buildFiberDependencyGraph(
          environment as FiberEnvironment,
          { 
            hideDisabled: options.hideDisabled, 
            reverse: options.reverse 
          }
        );
        
        // Output in JSON format if requested
        if (options.json) {
          console.log(JSON.stringify(dependencyGraphToJson(graph), null, 2));
          return;
        }
        
        // Use the appropriate map based on whether we want to show dependencies or reverse dependencies
        const { dependencyMap, reverseDependencyMap, detectionInfo, fibersToShow, rootFibers } = graph;
        const activeMap = options.reverse ? reverseDependencyMap : dependencyMap;
        
        // Output GraphViz DOT format
        if (options.graphviz) {
          // Generate the GraphViz DOT representation using the existing utility
          const graphOutput = generateFiberDependencyGraph(
            fibersToShow,
            dependencyMap,
            reverseDependencyMap,
            detectionInfo,
            config as any,
            { reverse: options.reverse }
          );
          
          console.log(graphOutput);
          return;
        }
        
        // Sort fibers alphabetically for flat display, with core first
        const sortedFibers = orderFibers(fibersToShow, config, moduleResult.modules, {
          sortAlphabetically: true,
          handleSpecialFibers: true,
          includeDiscovered: false,
          hideDisabled: options.hideDisabled,
          reverse: options.reverse
        });
        
        if (options.flat) {
          console.log('Fiber dependencies:\n');
          
          for (const fiberId of sortedFibers) {
            const isCore = fiberId === FIBER_NAMES.CORE;
            const isEnabled = isCore || isFiberEnabled(fiberId, config);
            const statusSymbol = isEnabled ? EMOJI.ACTIVE : EMOJI.DISABLED;
            
            // Get explicit dependencies
            const deps = [...(activeMap.get(fiberId) || [])];
            
            // Add implicit core dependency for non-core fibers
            if (!isCore && fibersToShow.includes('core') && !deps.includes('core')) {
              deps.push('core');
            }
            
            // Sort dependencies alphabetically for consistent display
            const sortedDeps = [...deps].sort((a: string, b: string) => {
              if (a === 'core') return -1;
              if (b === 'core') return 1;
              return a.localeCompare(b);
            });
            
            const depsText = sortedDeps.length > 0 
              ? sortedDeps.join(', ')
              : '(none)';
              
            if (options.reverse) {
              console.log(`${statusSymbol} ${fiberId}: required by ${depsText}`);
            } else {
              console.log(`${statusSymbol} ${fiberId}: requires ${depsText}`);
            }
            
            if (options.detailed) {
              // Get dependency sources
              const sources = [...(detectionInfo.get(fiberId) || [])];
              
              // Add implicit core dependency source if not already present
              if (!isCore && fibersToShow.includes('core') && 
                  !sources.some(s => s.deps.includes('core'))) {
                sources.push({
                  source: 'implicit.core',
                  deps: ['core']
                });
              }
              
              if (sources.length > 0) {
                for (const source of sources) {
                  console.log(`   Source: ${source.source}`);
                  console.log(`   Dependencies: ${source.deps.join(', ')}`);
                }
              }
              console.log('');
            }
          }
        } else {
          // Tree view
          console.log('Fiber Dependency Diagram:');
          console.log('─────────────────────────');
          
          // We'll build a tree in the correct orientation
          const processedFibers = new Set<string>();
          
          // For reverse mode, we need to use the dependency map
          // For normal mode, create a reverse map to show what depends on each fiber
          const displayMap = options.reverse ? 
            dependencyMap :  // Reverse mode: what each fiber requires (directly from dependencyMap)
            new Map<string, string[]>(); // Normal mode: what depends on each fiber (built from dependencyMap)
            
          if (!options.reverse) {
            // Build the reversed map for normal display mode
            for (const [fiberId, deps] of dependencyMap.entries()) {
              for (const dep of deps) {
                if (!displayMap.has(dep)) {
                  displayMap.set(dep, []);
                }
                const dependents = displayMap.get(dep)!;
                if (!dependents.includes(fiberId)) {
                  dependents.push(fiberId);
                }
              }
            }
            
            // Remove redundant paths - if A depends on B and C, and B depends on C,
            // then we should only show A -> B -> C, not A -> C directly
            for (const [parent, dependents] of displayMap.entries()) {
              // Filter out paths where one dependent is also dependent on another in this list
              const directDependents = [...dependents];
              
              for (let i = dependents.length - 1; i >= 0; i--) {
                const dependent = dependents[i];
                
                // Check if this dependent depends on any other dependent
                for (const otherDependent of dependents) {
                  if (dependent !== otherDependent && 
                      (dependencyMap.get(dependent) || []).includes(otherDependent)) {
                    // Remove this path as it's redundant
                    const idx = directDependents.indexOf(dependent);
                    if (idx >= 0) {
                      directDependents.splice(idx, 1);
                    }
                    break;
                  }
                }
              }
              
              // Update with filtered list
              displayMap.set(parent, directDependents);
            }
            
            // Sort dependents in each entry putting dev first for core, etc.
            for (const [fiberId, dependents] of displayMap.entries()) {
              dependents.sort((a, b) => {
                if (fiberId === FIBER_NAMES.CORE) {
                  if (a === 'dev') return -1;
                  if (b === 'dev') return 1;
                  
                  if (a === 'dotfiles') return -1;
                  if (b === 'dotfiles') return 1;
                }
                return a.localeCompare(b);
              });
            }
          }
          
          // Function to print a node and its dependents
          function printDependencyTree(
            fiberId: string,
            prefix = '',
            isLast = true,
            depth = 0
          ) {
            // Skip if already processed (prevents cycles)
            if (processedFibers.has(fiberId)) {
              return;
            }
            
            // Mark as processed
            processedFibers.add(fiberId);
            
            // Print this node and its dependencies
            printDependencyNode(
              config,
              fiberId,
              prefix,
              isLast,
              options.detailed ? detectionInfo : null,
              fibersToShow
            );
            
            // Get and print dependents
            const dependents = displayMap.get(fiberId) || [];
            const newPrefix = `${prefix}${isLast ? DEPENDENCY_DISPLAY.TREE_INDENT : DEPENDENCY_DISPLAY.TREE_VERTICAL}`;
            
            // Print each dependent
            for (let i = 0; i < dependents.length; i++) {
              printDependencyTree(
                dependents[i],
                newPrefix,
                i === dependents.length - 1,
                depth + 1
              );
            }
          }
          
          // Start with core as the root in normal mode
          if (fibersToShow.includes(FIBER_NAMES.CORE)) {
            printDependencyTree(FIBER_NAMES.CORE);
          } else {
            // If core isn't available, find roots by dependency analysis
            const roots = options.reverse ?
              // In reverse mode, roots are fibers with no dependencies
              fibersToShow.filter(id => !dependencyMap.get(id)?.length) :
              // In normal mode, roots are fibers that nobody depends on
              fibersToShow.filter(id => !displayMap.get(id)?.length);
              
            // Sort roots alphabetically
            const sortedRoots = [...roots].sort((a, b) => a.localeCompare(b));
            
            // Print each root
            for (let i = 0; i < sortedRoots.length; i++) {
              printDependencyTree(sortedRoots[i], '', i === sortedRoots.length - 1);
            }
          }
        }
      } catch (error) {
        console.error('Error displaying fiber dependencies:', error);
        process.exit(1);
      }
    });
}

export function displayDependencyStatus(
  fiberId: string,
  isEnabled: boolean,
  isSatisfied: boolean,
  inConfig: boolean
): void {
  const statusSymbol = isEnabled ? EMOJI.ACTIVE : EMOJI.DISABLED;
  console.log(`  ${statusSymbol} ${fiberId}`);
}

export function displayChainDependencyStatus(
  chainId: string,
  isEnabled: boolean,
  isSatisfied: boolean,
  inConfig: boolean
): void {
  const statusSymbol = isEnabled ? EMOJI.ACTIVE : EMOJI.DISABLED;
  console.log(`  ${statusSymbol} ${chainId}`);
} 
