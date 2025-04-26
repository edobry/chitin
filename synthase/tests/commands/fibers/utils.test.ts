import { describe, test, expect } from 'bun:test';
import { orderFibers } from '../../../src/commands/fibers/utils/dependency-utils';
import { Module } from '../../../src/modules/types';

describe('Fiber Utils', () => {
  test('orderFibers should place core first', () => {
    const fibers = ['dev', 'core', 'dotfiles'];
    const config = {
      dev: { fiberDeps: ['dotfiles', 'core'] },
      dotfiles: { fiberDeps: ['core'] },
      core: {}
    };
    
    const ordered = orderFibers(fibers, config, [], {
      handleSpecialFibers: true
    });
    
    // Core should always be first
    expect(ordered[0]).toBe('core');
    // With our new change, dotfiles should be second
    expect(ordered[1]).toBe('dotfiles');
  });
  
  test('orderFibers should place dotfiles immediately after core', () => {
    const fibers = ['dev', 'cloud', 'core', 'dotfiles'];
    const config = {
      dev: { fiberDeps: ['cloud'] },
      cloud: { fiberDeps: ['dotfiles'] },
      dotfiles: { fiberDeps: [] },
      core: {}
    };
    
    const ordered = orderFibers(fibers, config, [], {
      handleSpecialFibers: true
    });
    
    // Core should be first, dotfiles second
    expect(ordered[0]).toBe('core');
    expect(ordered[1]).toBe('dotfiles');
    
    // Respects topological ordering based on dependencies
    // Note: In raw config, dev depends on cloud, so cloud should come before dev
    expect(ordered.indexOf('cloud')).toBeLessThan(ordered.indexOf('dev'));
  });
  
  test('orderFibers should place dotfiles after core even if other fibers depend on core', () => {
    const fibers = ['dev', 'core', 'dotfiles', 'external'];
    const config = {
      dev: { fiberDeps: ['core'] }, // dev depends on core, but should still come after dotfiles
      dotfiles: { fiberDeps: ['core'] },
      external: { fiberDeps: ['core'] },
      core: {}
    };
    
    const ordered = orderFibers(fibers, config, [], {
      handleSpecialFibers: true
    });
    
    // Core should be first, dotfiles second
    expect(ordered[0]).toBe('core');
    expect(ordered[1]).toBe('dotfiles');
  });
  
  test('orderFibers should place dependencies before dependents', () => {
    const fibers = ['chainalysis', 'cloud', 'dev', 'dotfiles'];
    const config = {
      chainalysis: { fiberDeps: ['cloud'] },
      cloud: { fiberDeps: ['dev'] },
      dev: { fiberDeps: ['dotfiles'] },
      dotfiles: {}
    };
    
    const ordered = orderFibers(fibers, config, [], {
      handleSpecialFibers: true
    });
    
    // Dependencies before dependents
    expect(ordered.indexOf('dotfiles')).toBeLessThan(ordered.indexOf('dev'));
    expect(ordered.indexOf('dev')).toBeLessThan(ordered.indexOf('cloud'));
    expect(ordered.indexOf('cloud')).toBeLessThan(ordered.indexOf('chainalysis'));
  });
  
  test('orderFibers should use module metadata if available', () => {
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
    
    const ordered = orderFibers(fibers, config, modules, {
      handleSpecialFibers: true
    });
    
    // Dependencies before dependents, even when using module metadata
    expect(ordered.indexOf('dev')).toBeLessThan(ordered.indexOf('cloud'));
    expect(ordered.indexOf('cloud')).toBeLessThan(ordered.indexOf('chainalysis'));
  });
  
  test('orderFibers should handle circular dependencies', () => {
    const fibers = ['a', 'b', 'c'];
    const config = {
      a: { fiberDeps: ['c'] },
      b: { fiberDeps: ['a'] },
      c: { fiberDeps: ['b'] }
    };
    
    // This should not throw an error, even with circular dependencies
    const ordered = orderFibers(fibers, config, [], {
      handleSpecialFibers: true
    });
    
    // All fibers should still be in the result
    expect(ordered.length).toBe(3);
    expect(ordered).toContain('a');
    expect(ordered).toContain('b');
    expect(ordered).toContain('c');
  });
  
  test('orderFibers should prioritize configured fibers', () => {
    const fibers = ['core', 'dev', 'cloud'];
    const config = {
      core: {},
      dev: { fiberDeps: ['core'] },
      cloud: { fiberDeps: ['dev'] }
    };
    
    // Add some discovered fibers through modules
    const modules: Module[] = [
      {
        id: 'utils',
        name: 'utils',
        path: '/test/utils',
        type: 'fiber',
        metadata: {
          dependencies: [{ moduleId: 'core' }]
        }
      },
      {
        id: 'tools',
        name: 'tools',
        path: '/test/tools',
        type: 'fiber',
        metadata: {
          dependencies: [{ moduleId: 'utils' }]
        }
      }
    ];
    
    const ordered = orderFibers(fibers, config, modules, {
      handleSpecialFibers: true,
      prioritizeConfigured: true,
      includeDiscovered: true
    });
    
    // Configured fibers should come before discovered ones
    const configuredFibers = new Set(fibers);
    let lastConfiguredIndex = -1;
    let firstDiscoveredIndex = ordered.length;
    
    ordered.forEach((fiberId, index) => {
      if (configuredFibers.has(fiberId)) {
        lastConfiguredIndex = Math.max(lastConfiguredIndex, index);
      } else {
        firstDiscoveredIndex = Math.min(firstDiscoveredIndex, index);
      }
    });
    
    expect(lastConfiguredIndex).toBeLessThan(firstDiscoveredIndex);
  });
  
  test('orderFibers should handle disabled fibers', () => {
    const fibers = ['core', 'dev', 'cloud', 'disabled'];
    const config = {
      core: { enabled: true },
      dev: { enabled: true, fiberDeps: ['core'] },
      cloud: { enabled: true, fiberDeps: ['dev'] },
      disabled: { enabled: false, fiberDeps: ['cloud'] }
    };
    
    const ordered = orderFibers(fibers, config, [], {
      handleSpecialFibers: true,
      hideDisabled: true
    });
    
    // Should not include disabled fibers
    expect(ordered).not.toContain('disabled');
    
    // Should maintain correct order for enabled fibers
    expect(ordered[0]).toBe('core');
    expect(ordered.indexOf('dev')).toBeLessThan(ordered.indexOf('cloud'));
  });
}); 
