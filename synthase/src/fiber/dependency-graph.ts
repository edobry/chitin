#!/usr/bin/env bun

import { UserConfig } from '../config/types';
import { Module } from '../modules/types';
import { FIBER_NAMES } from './types';
import { CONFIG_FIELDS } from '../config/types';
import { isFiberEnabled } from '../commands/fibers/utils';
import { ensureCoreDependencies } from '../commands/fibers/utils';

/**
 * Represents a source of dependency detection
 */
export interface DependencySource {
  source: string;
  deps: string[];
}

/**
 * Represents the complete dependency graph for fibers
 */
export interface FiberDependencyGraph {
  /** Map of fiber ID to its dependencies */
  dependencyMap: Map<string, string[]>;
  /** Map of fiber ID to fibers that depend on it */
  reverseDependencyMap: Map<string, string[]>;
  /** Map of fiber ID to information about how dependencies were detected */
  detectionInfo: Map<string, DependencySource[]>;
  /** List of fiber IDs to show */
  fibersToShow: string[];
  /** Root fibers for hierarchical display */
  rootFibers: string[];
}

/**
 * Options for building a fiber dependency graph
 */
export interface BuildDependencyGraphOptions {
  /** Whether to hide disabled fibers */
  hideDisabled?: boolean;
  /** Whether to show reverse dependencies */
  reverse?: boolean;
}

/**
 * Represents the environment needed to build a fiber dependency graph
 */
export interface FiberEnvironment {
  /** The user configuration */
  config: UserConfig;
  /** The result of module discovery */
  moduleResult: {
    modules: Module[];
  };
  /** All fiber IDs available for display */
  displayFiberIds: string[];
  /** Fibers in their dependency order */
  orderedFibers: string[];
}

/**
 * Builds a complete dependency graph for fibers
 * 
 * @param env The fiber environment containing config and module information
 * @param options Options for building the dependency graph
 * @returns A complete fiber dependency graph
 */
export function buildFiberDependencyGraph(
  env: FiberEnvironment,
  options: BuildDependencyGraphOptions = {}
): FiberDependencyGraph {
  const { config, moduleResult, displayFiberIds, orderedFibers } = env;
  const { hideDisabled = false, reverse = false } = options;
  
  // Filter out disabled fibers if requested
  let fibersToShow = displayFiberIds;
  if (hideDisabled) {
    fibersToShow = fibersToShow.filter((fiberId: string) => {
      const isCore = fiberId === FIBER_NAMES.CORE;
      return isCore || isFiberEnabled(fiberId, config);
    });
  }
  
  // Get dependency map for each fiber
  const dependencyMap = new Map<string, string[]>();
  const reverseDependencyMap = new Map<string, string[]>();
  const dependencyDetectionInfo = new Map<string, DependencySource[]>();
  
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
    const detectionSources: DependencySource[] = [];
    
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
  
  // Calculate root fibers for hierarchical displays
  const rootFibers = getRootFibers(
    fibersToShow,
    dependencyMap,
    reverseDependencyMap,
    reverse
  );
  
  return {
    dependencyMap,
    reverseDependencyMap,
    detectionInfo: dependencyDetectionInfo,
    fibersToShow,
    rootFibers,
  };
}

/**
 * Determines the root fibers for the dependency tree
 */
function getRootFibers(
  fibersToShow: string[],
  dependencyMap: Map<string, string[]>,
  reverseDependencyMap: Map<string, string[]>,
  reverse: boolean = false
): string[] {
  if (reverse) {
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
}

/**
 * Convert a fiber dependency graph to a serializable JSON object
 * 
 * @param graph The fiber dependency graph to convert
 * @returns A JSON-serializable object representing the dependency graph
 */
export function dependencyGraphToJson(graph: FiberDependencyGraph): any {
  const { dependencyMap, reverseDependencyMap, detectionInfo, fibersToShow, rootFibers } = graph;
  
  return {
    dependencies: Object.fromEntries(
      Array.from(dependencyMap.entries()).map(([key, value]) => [key, [...value]])
    ),
    reverseDependencies: Object.fromEntries(
      Array.from(reverseDependencyMap.entries()).map(([key, value]) => [key, [...value]])
    ),
    detectionInfo: Object.fromEntries(
      Array.from(detectionInfo.entries()).map(([key, value]) => [key, [...value]])
    ),
    fibers: fibersToShow,
    rootFibers
  };
} 
