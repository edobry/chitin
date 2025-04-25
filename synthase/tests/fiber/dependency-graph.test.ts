#!/usr/bin/env bun
import { describe, test, expect, beforeEach } from 'bun:test';
import { 
  buildFiberDependencyGraph, 
  FiberEnvironment 
} from '../../src/fiber/dependency-graph';
import { FIBER_NAMES } from '../../src/fiber/types';
import { Module } from '../../src/modules/types';
import { CONFIG_FIELDS } from '../../src/config/types';

describe('Fiber Dependency Graph', () => {
  let mockEnvironment: FiberEnvironment;
  
  beforeEach(() => {
    // Set up a mock environment with some fibers
    mockEnvironment = {
      config: {
        core: {
          enabled: true
        },
        dev: {
          enabled: true,
          fiberDeps: ['core']
        },
        cloud: {
          enabled: true,
          fiberDeps: ['dev']
        },
        data: {
          enabled: true,
          fiberDeps: ['dev', 'cloud']
        },
        disabled: {
          enabled: false,
          fiberDeps: ['core']
        }
      } as any,
      moduleResult: {
        modules: [
          { 
            id: 'core', 
            type: 'fiber', 
            config: {},
            name: 'Core Fiber',
            path: '/path/to/core',
            metadata: {}
          } as Module,
          { 
            id: 'dev', 
            type: 'fiber', 
            config: { fiberDeps: ['core'] },
            name: 'Dev Fiber',
            path: '/path/to/dev',
            metadata: {}
          } as Module,
          { 
            id: 'cloud', 
            type: 'fiber', 
            config: { fiberDeps: ['dev'] },
            name: 'Cloud Fiber',
            path: '/path/to/cloud',
            metadata: {}
          } as Module,
          { 
            id: 'data', 
            type: 'fiber', 
            config: { fiberDeps: ['dev', 'cloud'] },
            name: 'Data Fiber',
            path: '/path/to/data',
            metadata: {}
          } as Module,
          { 
            id: 'disabled', 
            type: 'fiber', 
            config: { fiberDeps: ['core'] },
            name: 'Disabled Fiber',
            path: '/path/to/disabled',
            metadata: {}
          } as Module
        ]
      },
      displayFiberIds: ['core', 'dev', 'cloud', 'data', 'disabled'],
      orderedFibers: ['core', 'dev', 'cloud', 'data', 'disabled']
    };
  });
  
  test('buildFiberDependencyGraph should create correct dependency maps', () => {
    const graph = buildFiberDependencyGraph(mockEnvironment);
    
    // Check direct dependencies
    expect(graph.dependencyMap.get('core')).toEqual([]);
    expect(graph.dependencyMap.get('dev')).toContain('core');
    expect(graph.dependencyMap.get('cloud')).toContain('dev');
    expect(graph.dependencyMap.get('data')?.sort()).toEqual(['cloud', 'core', 'dev'].sort());
    
    // Check reverse dependencies
    expect(graph.reverseDependencyMap.get('core')).toContain('dev');
    expect(graph.reverseDependencyMap.get('dev')).toContain('cloud');
    expect(graph.reverseDependencyMap.get('dev')).toContain('data');
    expect(graph.reverseDependencyMap.get('cloud')).toContain('data');
    
    // Check fibersToShow contains all fibers
    expect(graph.fibersToShow.sort()).toEqual(['core', 'dev', 'cloud', 'data', 'disabled'].sort());
    
    // Check root fibers (should be core)
    expect(graph.rootFibers).toContain('core');
  });
  
  test('buildFiberDependencyGraph should respect hideDisabled option', () => {
    const graph = buildFiberDependencyGraph(mockEnvironment, { hideDisabled: true });
    
    // Should exclude disabled fibers
    expect(graph.fibersToShow).not.toContain('disabled');
    expect(graph.fibersToShow.sort()).toEqual(['core', 'dev', 'cloud', 'data'].sort());
    
    // Dependency maps should not include disabled fibers
    expect(graph.dependencyMap.has('disabled')).toBe(false);
    expect(graph.reverseDependencyMap.has('disabled')).toBe(false);
  });
  
  test('buildFiberDependencyGraph should support reverse option', () => {
    const graph = buildFiberDependencyGraph(mockEnvironment, { reverse: true });
    
    // Root fibers in reverse mode should be fibers with no dependents
    expect(graph.rootFibers).toContain('data');
    expect(graph.rootFibers).toContain('disabled');
  });
  
  test('dependency detection should find dependencies from various sources', () => {
    // Add a fiber with tool dependencies
    (mockEnvironment.config as any).tools = {
      enabled: true,
      toolDeps: ['some-tool']
    };
    
    // Add provides to dev fiber
    (mockEnvironment.config.dev as any).provides = ['some-tool'];
    
    mockEnvironment.moduleResult.modules.push({
      id: 'tools',
      type: 'fiber',
      config: { toolDeps: ['some-tool'] },
      name: 'Tools Fiber',
      path: '/path/to/tools',
      metadata: {}
    } as Module);
    
    mockEnvironment.displayFiberIds.push('tools');
    mockEnvironment.orderedFibers.push('tools');
    
    const graph = buildFiberDependencyGraph(mockEnvironment);
    
    // Tool dependencies should create fiber dependencies
    const toolDetectionSources = graph.detectionInfo.get('tools');
    const hasToolDepsSource = toolDetectionSources?.some(
      source => source.source === 'toolDeps providers' && source.deps.includes('dev')
    );
    
    expect(hasToolDepsSource).toBe(true);
    expect(graph.dependencyMap.get('tools')).toContain('dev');
  });
}); 
