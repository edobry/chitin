import { Command } from 'commander';
import { serializeToYaml } from '../../utils';
import { loadAndValidateConfig } from '../utils';
import { discoverModulesFromConfig } from '../../modules/discovery';
import { validateModulesAgainstConfig } from '../../modules/validator';
import { 
  getLoadableFibers, 
  areFiberDependenciesSatisfied, 
  createChainFilter,
  getFiberIds,
  getChainIds,
  orderChainsByDependencies,
  generateFiberDependencyGraph
} from '../../fiber';
import {
  orderFibersByDependencies,
  getDependentFibers,
  isFiberEnabled,
  getChainDependencies,
  countDisplayedModules,
  ensureCoreDependencies
} from './utils';
import {
  associateChainsByFiber,
  filterDisabledFibers,
  orderFibersByConfigAndName
} from './organization';
import { join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { FIBER_NAMES, CONFIG_FIELDS, FILE_NAMES, DISPLAY } from '../../constants';
import { loadConfigAndModules } from './shared';

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
    .action(async (options) => {
      try {
        const {
          config,
          moduleResult,
          displayFiberIds,
          orderedFibers
        } = await loadConfigAndModules(options);

        // Filter out disabled fibers if requested
        let fibersToShow = displayFiberIds;
        if (options.hideDisabled) {
          fibersToShow = fibersToShow.filter((fiberId: string) => {
            const isCore = fiberId === 'core';
            return isCore || isFiberEnabled(fiberId, config);
          });
        }
        
        // Get dependency map for each fiber
        const dependencyMap = new Map<string, string[]>();
        const reverseDependencyMap = new Map<string, string[]>();
        const dependencyDetectionInfo = new Map<string, {source: string, deps: string[]}[]>();
        
        // Initialize maps with empty arrays
        for (const fiberId of fibersToShow) {
          dependencyMap.set(fiberId, []);
          reverseDependencyMap.set(fiberId, []);
          dependencyDetectionInfo.set(fiberId, []);
        }
        
        // Ensure all fibers have an implicit dependency on core
        ensureCoreDependencies(fibersToShow, dependencyMap, dependencyDetectionInfo, reverseDependencyMap);
        
        // Collect all possible dependency sources
        for (const fiberId of fibersToShow) {
          const detectionSources: {source: string, deps: string[]}[] = [];
          
          // First try to get dependencies from module metadata
          const fiberModule = moduleResult.modules.find((m: any) => m.id === fiberId && m.type === 'fiber');
          if (fiberModule && fiberModule.metadata && fiberModule.metadata.dependencies) {
            const metadataDeps = fiberModule.metadata.dependencies
              .map((dep: any) => dep.moduleId)
              .filter((depId: string) => fibersToShow.includes(depId));
              
            if (metadataDeps.length > 0) {
              detectionSources.push({
                source: 'module.metadata.dependencies',
                deps: metadataDeps
              });
            }
          }
          
          // Check direct fiber dependencies from discovered module config and merged config
          const fiberConfig = fiberModule?.config || {};
          const moduleFiberDeps = fiberConfig[CONFIG_FIELDS.FIBER_DEPS] || [];
          
          if (moduleFiberDeps.length > 0) {
            detectionSources.push({
              source: 'fiber.config.fiberDeps',
              deps: moduleFiberDeps.filter((depId: string) => fibersToShow.includes(depId))
            });
          }
          
          // Check direct fiber dependencies from user config (merged)
          const configFiberDeps = (config[fiberId] as any)?.fiberDeps || [];
          if (configFiberDeps.length > 0 && 
              !detectionSources.some(source => source.source === 'fiber.config.fiberDeps' && 
                                             JSON.stringify(source.deps) === JSON.stringify(configFiberDeps))) {
            detectionSources.push({
              source: 'config.fiberDeps',
              deps: configFiberDeps.filter((depId: string) => fibersToShow.includes(depId))
            });
          }
          
          // Check tool dependencies that might map to fibers
          const configToolDeps = (config[fiberId] as any)?.toolDeps || [];
          if (configToolDeps.length > 0) {
            // Find fibers that provide these tools
            const toolToFiberMap = new Map<string, string[]>();
            
            // Build map of tool providers
            for (const otherFiberId of fibersToShow) {
              if (otherFiberId === fiberId) continue; // Skip self
              
              // Check for provides in fiber config
              const provides = (config[otherFiberId] as any)?.provides || [];
              for (const tool of provides) {
                if (!toolToFiberMap.has(tool)) {
                  toolToFiberMap.set(tool, []);
                }
                toolToFiberMap.get(tool)?.push(otherFiberId);
              }
              
              // Check for provides in chains
              const moduleConfig = (config[otherFiberId] as any)?.moduleConfig || {};
              for (const [chainId, chainConfig] of Object.entries(moduleConfig)) {
                const chainProvides = (chainConfig as any)?.provides || [];
                for (const tool of chainProvides) {
                  if (!toolToFiberMap.has(tool)) {
                    toolToFiberMap.set(tool, []);
                  }
                  toolToFiberMap.get(tool)?.push(otherFiberId);
                }
              }
            }
            
            // Find fibers providing tools we depend on
            const toolDerivedDeps: string[] = [];
            for (const tool of configToolDeps) {
              const providers = toolToFiberMap.get(tool) || [];
              for (const provider of providers) {
                if (!toolDerivedDeps.includes(provider)) {
                  toolDerivedDeps.push(provider);
                }
              }
            }
            
            if (toolDerivedDeps.length > 0) {
              detectionSources.push({
                source: 'toolDeps providers',
                deps: toolDerivedDeps
              });
            }
          }
          
          // Update dependency map with all detected dependencies
          for (const source of detectionSources) {
            // Record detection source for detailed view
            const existingDetection = dependencyDetectionInfo.get(fiberId) || [];
            existingDetection.push(source);
            dependencyDetectionInfo.set(fiberId, existingDetection);
            
            // Add all dependencies to the dependency map
            const deps = dependencyMap.get(fiberId) || [];
            for (const dep of source.deps) {
              if (!deps.includes(dep)) {
                deps.push(dep);
              }
            }
            dependencyMap.set(fiberId, deps);
            
            // Update reverse dependency map
            for (const dep of source.deps) {
              const reverseDeps = reverseDependencyMap.get(dep) || [];
              if (!reverseDeps.includes(fiberId)) {
                reverseDeps.push(fiberId);
                reverseDependencyMap.set(dep, reverseDeps);
              }
            }
          }
        }
        
        // Count total explicit dependencies
        const totalDeps = Array.from(dependencyMap.values()).reduce(
          (sum, deps) => sum + deps.length, 0
        );
        
        // If no explicit dependencies, infer from load order
        if (totalDeps === 0 && orderedFibers.length > 1) {
          console.error('No explicit dependencies found. Inferring dependencies based on load order...');
          
          // Assume each fiber depends on the one before it
          for (let i = 1; i < orderedFibers.length; i++) {
            const fiberId = orderedFibers[i];
            const prevId = orderedFibers[i-1];
            
            if (fibersToShow.includes(fiberId) && fibersToShow.includes(prevId)) {
              // Add dependency
              const deps = dependencyMap.get(fiberId) || [];
              if (!deps.includes(prevId)) {
                deps.push(prevId);
                dependencyMap.set(fiberId, deps);
                
                // Update detection info
                const detectionInfo = dependencyDetectionInfo.get(fiberId) || [];
                detectionInfo.push({
                  source: 'inferred from load order',
                  deps: [prevId]
                });
                dependencyDetectionInfo.set(fiberId, detectionInfo);
                
                // Update reverse deps
                const reverseDeps = reverseDependencyMap.get(prevId) || [];
                if (!reverseDeps.includes(fiberId)) {
                  reverseDeps.push(fiberId);
                  reverseDependencyMap.set(prevId, reverseDeps);
                }
              }
            }
          }
        }
        
        // Use the appropriate map based on whether we want to show dependencies or reverse dependencies
        const activeMap = options.reverse ? reverseDependencyMap : dependencyMap;
        
        // Output GraphViz DOT format
        if (options.graphviz) {
          console.log('digraph fiber_dependencies {');
          console.log('  rankdir=LR;');
          console.log('  node [shape=box];');
          
          // Output all nodes
          for (const fiberId of fibersToShow) {
            const isCore = fiberId === 'core';
            const isEnabled = isCore || isFiberEnabled(fiberId, config);
            const color = isEnabled ? 'green' : 'gray';
            console.log(`  "${fiberId}" [style=filled, fillcolor=${color}];`);
          }
          
          // Output all edges
          for (const [fiberId, deps] of dependencyMap.entries()) {
            for (const dep of deps) {
              if (fibersToShow.includes(dep)) {
                if (options.reverse) {
                  console.log(`  "${dep}" -> "${fiberId}";`);
                } else {
                  console.log(`  "${fiberId}" -> "${dep}";`);
                }
              }
            }
          }
          
          console.log('}');
          return;
        }
        
        // Sort fibers alphabetically for flat display, with core first
        const sortedFibers = [...fibersToShow].sort((a: string, b: string) => {
          if (a === 'core') return -1;
          if (b === 'core') return 1;
          return a.localeCompare(b);
        });
        
        if (options.flat) {
          console.log('Fiber dependencies:\n');
          
          for (const fiberId of sortedFibers) {
            const isCore = fiberId === 'core';
            const isEnabled = isCore || isFiberEnabled(fiberId, config);
            const statusSymbol = isEnabled ? DISPLAY.EMOJIS.ENABLED : DISPLAY.EMOJIS.DISABLED;
            
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
              const sources = [...(dependencyDetectionInfo.get(fiberId) || [])];
              
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
          console.log('Fiber dependency tree:\n');
          
          const printDependencyTree = (
            fiberId: string, 
            map: Map<string, string[]>, 
            detailInfo: Map<string, {source: string, deps: string[]}[]> | null = null,
            seen: Set<string> = new Set(), 
            prefix = '', 
            isLast = true
          ) => {
            // Prevent cycles
            if (seen.has(fiberId)) {
              console.log(`${prefix}${isLast ? '└── ' : '├── '}${fiberId} (circular dependency)`);
              return;
            }
            
            const isCore = fiberId === 'core';
            const isEnabled = isCore || isFiberEnabled(fiberId, config);
            const statusSymbol = isEnabled ? DISPLAY.EMOJIS.ENABLED : DISPLAY.EMOJIS.DISABLED;
            
            // Print current fiber
            console.log(`${prefix}${isLast ? '└── ' : '├── '}${statusSymbol} ${fiberId}`);
            
            if (options.detailed && detailInfo) {
              const sources = detailInfo.get(fiberId) || [];
              if (sources.length > 0) {
                const detailPrefix = `${prefix}${isLast ? '    ' : '│   '}`;
                console.log(`${detailPrefix}Sources:`);
                for (const source of sources) {
                  console.log(`${detailPrefix}- ${source.source}: ${source.deps.join(', ')}`);
                }
              }
            }
            
            // Mark as seen to prevent cycles
            seen.add(fiberId);
            
            // Get dependencies
            const deps = [...(map.get(fiberId) || [])];
            
            // Add implicit core dependency for non-core fibers
            if (!isCore && fibersToShow.includes('core') && !deps.includes('core')) {
              deps.push('core');
            }
            
            // Sort dependencies with core first, then alphabetically
            const sortedDeps = [...deps].sort((a: string, b: string) => {
              if (a === 'core') return -1;
              if (b === 'core') return 1;
              return a.localeCompare(b);
            });
            
            // Print dependencies
            const newPrefix = `${prefix}${isLast ? '    ' : '│   '}`;
            for (let i = 0; i < sortedDeps.length; i++) {
              // Don't print already seen fibers to avoid circular dependencies
              if (!seen.has(sortedDeps[i])) {
                printDependencyTree(
                  sortedDeps[i], 
                  map, 
                  detailInfo,
                  new Set(seen), 
                  newPrefix, 
                  i === sortedDeps.length - 1
                );
              }
            }
          };
          
          // Function to determine root fibers for the tree
          const getRootFibers = (): string[] => {
            if (options.reverse) {
              // For reverse mode, roots are fibers that nobody depends on
              return fibersToShow.filter((id: string) => 
                (reverseDependencyMap.get(id) || []).length === 0
              );
            } else {
              // For normal mode, we want to show dependency providers at the top
              // Find fibers with dependents but no dependencies of their own,
              // or fibers that have the most dependents (foundational fibers)
              const fibersWithDependents = fibersToShow.filter((id: string) => 
                (reverseDependencyMap.get(id) || []).length > 0
              );
              
              if (fibersWithDependents.length > 0) {
                // Find fibers that don't have dependencies themselves
                const selfContainedFibers = fibersWithDependents.filter((id: string) => 
                  (dependencyMap.get(id) || []).length === 0
                );
                
                if (selfContainedFibers.length > 0) {
                  return selfContainedFibers;
                }
                
                // Fall back to fibers with the most dependents
                const dependentCounts = fibersWithDependents.map((id: string) => ({
                  id,
                  count: (reverseDependencyMap.get(id) || []).length
                }));
                
                // Sort by number of dependents (descending)
                dependentCounts.sort((a: {id: string, count: number}, b: {id: string, count: number}) => b.count - a.count);
                
                // Group fibers with the same number of dependents
                const maxDependents = dependentCounts[0].count;
                const mostDependedOn = dependentCounts
                  .filter((item: {id: string, count: number}) => item.count === maxDependents)
                  .map((item: {id: string, count: number}) => item.id);
                  
                return mostDependedOn;
              }
              
              // Fallback for if no fibers have dependents
              return fibersToShow.filter((id: string) => 
                (dependencyMap.get(id) || []).length === 0
              );
            }
          };
          
          // Get root fibers to start the tree
          let rootFibers = getRootFibers();
          
          // If no clear roots, pick the most foundational fibers
          if (rootFibers.length === 0) {
            if (options.reverse) {
              // Find fibers with most dependents
              const maxDependents = Math.max(...Array.from(
                reverseDependencyMap.entries(),
                ([_, deps]) => deps.length
              ));
              
              rootFibers = Array.from(
                reverseDependencyMap.entries()
              ).filter(([id, deps]) => 
                deps.length === maxDependents
              ).map(([id, _]) => id);
            } else {
              // Find fibers with fewest dependencies
              const minDependencies = Math.min(...Array.from(
                dependencyMap.entries(),
                ([_, deps]) => deps.length
              ));
              
              rootFibers = Array.from(
                dependencyMap.entries()
              ).filter(([id, deps]) => 
                deps.length === minDependencies
              ).map(([id, _]) => id);
            }
          }
          
          // Sort roots with core first, then alphabetically
          rootFibers.sort((a: string, b: string) => {
            if (a === 'core') return -1;
            if (b === 'core') return 1;
            return a.localeCompare(b);
          });
          
          // Function to build and print the dependency tree
          const buildTree = (
            fibers: string[],
            seen: Set<string> = new Set(),
            prefix = '',
            isLastGroup = true
          ) => {
            for (let i = 0; i < fibers.length; i++) {
              const fiberId = fibers[i];
              const isLast = i === fibers.length - 1;
              
              printDependencyTree(
                fiberId, 
                activeMap, 
                options.detailed ? dependencyDetectionInfo : null,
                new Set(seen), 
                prefix, 
                isLast && isLastGroup
              );
            }
          };
          
          // Print the tree
          buildTree(rootFibers);
        }
      } catch (error) {
        console.error('Error displaying fiber dependencies:', error);
        process.exit(1);
      }
    });
} 
