import { describe, test, expect } from 'bun:test';
import { createDependencyGraph, resolveDependencies } from '../../src/modules/dependency';

describe('Dependency Resolution', () => {
  test('should create a dependency graph', () => {
    const graph = createDependencyGraph<string>();
    
    // Add nodes
    graph.addNode('A', 'A-Value');
    graph.addNode('B', 'B-Value');
    graph.addNode('C', 'C-Value');
    
    // Add dependencies
    graph.addDependency('B', 'A'); // B depends on A
    graph.addDependency('C', 'B'); // C depends on B
    
    // Get all nodes
    const nodes = graph.getAll();
    expect(nodes.length).toBe(3);
    expect(nodes).toContain('A-Value');
    expect(nodes).toContain('B-Value');
    expect(nodes).toContain('C-Value');
    
    // Get topological sort
    const sorted = graph.getTopologicalSort();
    expect(sorted.length).toBe(3);
    
    // A should come before B, and B should come before C
    const aIndex = sorted.indexOf('A-Value');
    const bIndex = sorted.indexOf('B-Value');
    const cIndex = sorted.indexOf('C-Value');
    
    expect(aIndex).toBeLessThan(bIndex);
    expect(bIndex).toBeLessThan(cIndex);
  });
  
  test('should detect circular dependencies', () => {
    const graph = createDependencyGraph<string>();
    
    // Add nodes
    graph.addNode('A', 'A-Value');
    graph.addNode('B', 'B-Value');
    graph.addNode('C', 'C-Value');
    
    // Add dependencies
    graph.addDependency('B', 'A'); // B depends on A
    graph.addDependency('C', 'B'); // C depends on B
    graph.addDependency('A', 'C'); // A depends on C - creates a cycle
    
    // Detect circular dependencies
    const circles = graph.detectCircularDependencies();
    expect(circles.length).toBeGreaterThan(0);
    
    // Check one of the detected circles
    const circle = circles[0];
    expect(circle.path.length).toBeGreaterThan(1);
  });
  
  test('should resolve dependencies', () => {
    // Items with dependencies
    const items = [
      { id: 'A', deps: [] },
      { id: 'B', deps: ['A'] },
      { id: 'C', deps: ['B'] },
      { id: 'D', deps: ['A', 'C'] }
    ];
    
    const result = resolveDependencies(
      items,
      item => item.id,
      item => item.deps
    );
    
    expect(result.hasCircular).toBe(false);
    expect(result.sorted.length).toBe(4);
    
    // A should come first, D should come last
    expect(result.sorted[0].id).toBe('A');
    expect(result.sorted[3].id).toBe('D');
  });
  
  test('should handle circular dependencies in resolution', () => {
    // Items with dependencies
    const items = [
      { id: 'A', deps: ['C'] },
      { id: 'B', deps: ['A'] },
      { id: 'C', deps: ['B'] }
    ];
    
    const result = resolveDependencies(
      items,
      item => item.id,
      item => item.deps
    );
    
    expect(result.hasCircular).toBe(true);
    expect(result.circularDependencies.length).toBeGreaterThan(0);
    expect(result.sorted.length).toBe(3);
  });
}); 
