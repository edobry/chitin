import { describe, test, expect } from 'bun:test';
import { generateFiberDependencyGraph } from '../../src/fiber/graph';
import { FIBER_NAMES } from '../../src/fiber/types';

describe('Fiber Graph', () => {
  test('generateFiberDependencyGraph should not add redundant core dependencies', () => {
    // Mock fiber IDs
    const fibersToShow = ['core', 'dotfiles', 'dev', 'cloud', 'chainalysis', 'shamanic'];
    
    // Mock dependency map (from module detection)
    const dependencyMap = new Map<string, string[]>();
    dependencyMap.set('core', []);
    dependencyMap.set('dotfiles', []);
    dependencyMap.set('dev', []);
    dependencyMap.set('cloud', ['dev']);
    dependencyMap.set('chainalysis', ['cloud']);
    dependencyMap.set('shamanic', ['cloud']);
    
    // Mock reverse dependency map
    const reverseDependencyMap = new Map<string, string[]>();
    reverseDependencyMap.set('core', []);
    reverseDependencyMap.set('dotfiles', []);
    reverseDependencyMap.set('dev', ['cloud']);
    reverseDependencyMap.set('cloud', ['chainalysis', 'shamanic']);
    reverseDependencyMap.set('chainalysis', []);
    reverseDependencyMap.set('shamanic', []);
    
    // Mock dependency detection info
    const dependencyDetectionInfo = new Map<string, {source: string, deps: string[]}[]>();
    for (const fiberId of fibersToShow) {
      dependencyDetectionInfo.set(fiberId, []);
    }
    
    // Add detection info based on dependency map
    for (const [fiberId, deps] of dependencyMap.entries()) {
      if (deps.length > 0) {
        dependencyDetectionInfo.get(fiberId)?.push({
          source: 'test',
          deps: [...deps]
        });
      }
    }
    
    // Mock config with all fibers enabled
    const mockConfig = {
      core: {},
      dotfiles: { enabled: true },
      dev: { enabled: true },
      cloud: { enabled: true },
      chainalysis: { enabled: false },
      shamanic: { enabled: false }
    };
    
    // Generate DOT graph
    const graph = generateFiberDependencyGraph(
      fibersToShow,
      dependencyMap,
      reverseDependencyMap,
      dependencyDetectionInfo,
      mockConfig as any,
      { reverse: false }
    );
    
    // Console.log for debugging if needed
    // console.log(graph);
    
    // Test that dotfiles depends directly on core (special case)
    expect(graph).toContain('"dotfiles" -> "core"');
    
    // Test that dev depends directly on core (top-level fiber)
    expect(graph).toContain('"dev" -> "core"');
    
    // Test that cloud depends on dev
    expect(graph).toContain('"cloud" -> "dev"');
    
    // Test that chainalysis depends on cloud
    expect(graph).toContain('"chainalysis" -> "cloud"');
    
    // Test that shamanic depends on cloud
    expect(graph).toContain('"shamanic" -> "cloud"');
    
    // Test that there's NO redundant transitive dependency from cloud to core
    expect(graph).not.toContain('"cloud" -> "core"');
    
    // Test that there's NO redundant transitive dependency from chainalysis to core
    expect(graph).not.toContain('"chainalysis" -> "core"');
    
    // Test that there's NO redundant transitive dependency from shamanic to core
    expect(graph).not.toContain('"shamanic" -> "core"');
  });
  
  test('generateFiberDependencyGraph should handle deep transitive dependencies', () => {
    // Test a more complex dependency chain: A -> B -> C -> D -> core
    const fibersToShow = ['core', 'A', 'B', 'C', 'D'];
    
    // Mock dependency map
    const dependencyMap = new Map<string, string[]>();
    dependencyMap.set('core', []);
    dependencyMap.set('A', ['B']);
    dependencyMap.set('B', ['C']);
    dependencyMap.set('C', ['D']);
    dependencyMap.set('D', []);
    
    // Mock reverse dependency map
    const reverseDependencyMap = new Map<string, string[]>();
    reverseDependencyMap.set('core', ['D']);
    reverseDependencyMap.set('A', []);
    reverseDependencyMap.set('B', ['A']);
    reverseDependencyMap.set('C', ['B']);
    reverseDependencyMap.set('D', ['C']);
    
    // Mock dependency detection info
    const dependencyDetectionInfo = new Map<string, {source: string, deps: string[]}[]>();
    for (const fiberId of fibersToShow) {
      dependencyDetectionInfo.set(fiberId, []);
    }
    
    // Add detection info based on dependency map
    for (const [fiberId, deps] of dependencyMap.entries()) {
      if (deps.length > 0) {
        dependencyDetectionInfo.get(fiberId)?.push({
          source: 'test',
          deps: [...deps]
        });
      }
    }
    
    // Mock config with all fibers enabled
    const mockConfig = {
      core: {},
      A: { enabled: true },
      B: { enabled: true },
      C: { enabled: true },
      D: { enabled: true }
    };
    
    // Generate DOT graph
    const graph = generateFiberDependencyGraph(
      fibersToShow,
      dependencyMap,
      reverseDependencyMap,
      dependencyDetectionInfo,
      mockConfig as any,
      { reverse: false }
    );
    
    // Test that D depends directly on core (top-level fiber)
    expect(graph).toContain('"D" -> "core"');
    
    // Test that the dependency chain is preserved
    expect(graph).toContain('"A" -> "B"');
    expect(graph).toContain('"B" -> "C"');
    expect(graph).toContain('"C" -> "D"');
    
    // Test that there are NO redundant transitive dependencies to core
    expect(graph).not.toContain('"A" -> "core"');
    expect(graph).not.toContain('"B" -> "core"');
    expect(graph).not.toContain('"C" -> "core"');
  });
}); 
