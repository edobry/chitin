import { describe, test, expect, beforeEach } from 'bun:test';
import { createFiberManager, createFiberFilter } from '../../src/fiber';

describe('Fiber Manager', () => {
  test('should register and retrieve fibers', () => {
    const manager = createFiberManager();
    
    // Register fibers
    manager.registerFiber('fiber1', ['module1', 'module2']);
    manager.registerFiber('fiber2', ['module3']);
    
    // Get all fibers
    const fibers = manager.getAllFibers();
    expect(fibers.length).toBe(2);
    
    // Check fiber content
    const fiber1 = fibers.find(f => f.id === 'fiber1');
    expect(fiber1).toBeDefined();
    expect(fiber1?.modules).toContain('module1');
    expect(fiber1?.modules).toContain('module2');
    
    const fiber2 = fibers.find(f => f.id === 'fiber2');
    expect(fiber2).toBeDefined();
    expect(fiber2?.modules).toContain('module3');
  });
  
  test('should activate and deactivate fibers', () => {
    const manager = createFiberManager();
    
    // Register a fiber
    manager.registerFiber('fiber1', ['module1', 'module2']);
    
    // Activate the fiber
    const activateResult = manager.activateFiber('fiber1');
    expect(activateResult).toBe(true);
    
    // Check if fiber is active
    const isActive = manager.isFiberActive('fiber1');
    expect(isActive).toBe(true);
    
    // Check active fibers list
    const activefibers = manager.getActiveFibers();
    expect(activefibers.length).toBe(1);
    expect(activefibers[0].id).toBe('fiber1');
    
    // Deactivate the fiber
    const deactivateResult = manager.deactivateFiber('fiber1');
    expect(deactivateResult).toBe(true);
    
    // Check if fiber is now inactive
    const isActiveAfterDeactivate = manager.isFiberActive('fiber1');
    expect(isActiveAfterDeactivate).toBe(false);
    
    // Check active fibers list again
    const activefibersAfterDeactivate = manager.getActiveFibers();
    expect(activefibersAfterDeactivate.length).toBe(0);
  });
  
  test('should filter modules based on fiber state', () => {
    // Create fiber states
    const fiberStates = [
      { id: 'fiber1', active: true, modules: ['module1', 'module2'], lastActivated: new Date() },
      { id: 'fiber2', active: false, modules: ['module3', 'module4'], lastActivated: new Date() }
    ];
    
    // Create fiber filter
    const filter = createFiberFilter(false); // Don't include inactive fibers
    
    // Test filter
    expect(filter('module1', fiberStates)).toBe(true); // In active fiber
    expect(filter('module3', fiberStates)).toBe(false); // In inactive fiber
    expect(filter('module5', fiberStates)).toBe(false); // Not in any fiber
    
    // Create inclusive filter
    const inclusiveFilter = createFiberFilter(true); // Include inactive fibers
    
    // Test inclusive filter
    expect(inclusiveFilter('module1', fiberStates)).toBe(true); // In active fiber
    expect(inclusiveFilter('module3', fiberStates)).toBe(true); // In inactive fiber
    expect(inclusiveFilter('module5', fiberStates)).toBe(false); // Not in any fiber
  });
}); 
