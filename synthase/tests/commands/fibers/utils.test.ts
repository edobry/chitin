import { describe, test, expect } from 'bun:test';
import { orderFibersByDependencies } from '../../../src/commands/fibers/utils';
import { Module } from '../../../src/types';

describe('Fiber Utils', () => {
  test('orderFibersByDependencies should place core first', () => {
    const fibers = ['dev', 'core', 'dotfiles'];
    const config = {
      dev: { fiberDeps: ['dotfiles', 'core'] },
      dotfiles: { fiberDeps: ['core'] },
      core: {}
    };
    
    const ordered = orderFibersByDependencies(fibers, config);
    
    // Core should always be first
    expect(ordered[0]).toBe('core');
    // With our new change, dotfiles should be second
    expect(ordered[1]).toBe('dotfiles');
  });
  
  test('orderFibersByDependencies should place dotfiles immediately after core', () => {
    const fibers = ['dev', 'cloud', 'core', 'dotfiles'];
    const config = {
      dev: { fiberDeps: ['cloud'] },
      cloud: { fiberDeps: ['dotfiles'] },
      dotfiles: { fiberDeps: [] },
      core: {}
    };
    
    const ordered = orderFibersByDependencies(fibers, config);
    
    // Core should be first, dotfiles second
    expect(ordered[0]).toBe('core');
    expect(ordered[1]).toBe('dotfiles');
    
    // Respects topological ordering based on dependencies
    // Note: In raw config, dev depends on cloud, so cloud should come before dev
    expect(ordered.indexOf('cloud')).toBeLessThan(ordered.indexOf('dev'));
  });
  
  test('orderFibersByDependencies should place dotfiles after core even if other fibers depend on core', () => {
    const fibers = ['dev', 'core', 'dotfiles', 'external'];
    const config = {
      dev: { fiberDeps: ['core'] }, // dev depends on core, but should still come after dotfiles
      dotfiles: { fiberDeps: ['core'] },
      external: { fiberDeps: ['core'] },
      core: {}
    };
    
    const ordered = orderFibersByDependencies(fibers, config);
    
    // Core should be first, dotfiles second
    expect(ordered[0]).toBe('core');
    expect(ordered[1]).toBe('dotfiles');
  });
  
  test('orderFibersByDependencies should place dependencies before dependents', () => {
    const fibers = ['chainalysis', 'cloud', 'dev', 'dotfiles'];
    const config = {
      chainalysis: { fiberDeps: ['cloud'] },
      cloud: { fiberDeps: ['dev'] },
      dev: { fiberDeps: ['dotfiles'] },
      dotfiles: {}
    };
    
    const ordered = orderFibersByDependencies(fibers, config);
    
    // Dependencies before dependents
    expect(ordered.indexOf('dotfiles')).toBeLessThan(ordered.indexOf('dev'));
    expect(ordered.indexOf('dev')).toBeLessThan(ordered.indexOf('cloud'));
    expect(ordered.indexOf('cloud')).toBeLessThan(ordered.indexOf('chainalysis'));
  });
  
  test('orderFibersByDependencies should use module metadata if available', () => {
    const fibers = ['chainalysis', 'cloud', 'dev'];
    const config = {
      chainalysis: {},
      cloud: {},
      dev: {}
    };
    
    // Create mock module metadata
    const modules: Module[] = [
      {
        id: 'chainalysis',
        name: 'chainalysis',
        path: '/test/chainalysis',
        type: 'fiber',
        metadata: {
          dependencies: [{ moduleId: 'cloud' }]
        }
      },
      {
        id: 'cloud',
        name: 'cloud',
        path: '/test/cloud',
        type: 'fiber',
        metadata: {
          dependencies: [{ moduleId: 'dev' }]
        }
      },
      {
        id: 'dev',
        name: 'dev',
        path: '/test/dev',
        type: 'fiber',
        metadata: {
          dependencies: []
        }
      }
    ];
    
    const ordered = orderFibersByDependencies(fibers, config, modules);
    
    // Dependencies before dependents, even when using module metadata
    expect(ordered.indexOf('dev')).toBeLessThan(ordered.indexOf('cloud'));
    expect(ordered.indexOf('cloud')).toBeLessThan(ordered.indexOf('chainalysis'));
  });
  
  test('orderFibersByDependencies should handle circular dependencies', () => {
    const fibers = ['a', 'b', 'c'];
    const config = {
      a: { fiberDeps: ['c'] },
      b: { fiberDeps: ['a'] },
      c: { fiberDeps: ['b'] }
    };
    
    // This should not throw an error, even with circular dependencies
    const ordered = orderFibersByDependencies(fibers, config);
    
    // All fibers should still be in the result
    expect(ordered.length).toBe(3);
    expect(ordered).toContain('a');
    expect(ordered).toContain('b');
    expect(ordered).toContain('c');
  });
}); 
