import { describe, test, expect, beforeEach } from 'bun:test';
import { createFiberManager, addFiberEventListener, removeFiberEventListener, createFiberFilter } from '../../src/fiber';
import { FiberEvent } from '../../src/types';

describe('Fiber Manager', () => {
  beforeEach(() => {
    // Clear event listeners between tests
    const listeners = [] as any[];
    addFiberEventListener(listeners[0]);
    removeFiberEventListener(listeners[0]);
  });
  
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
  
  test('should fire events when fiber state changes', async () => {
    const manager = createFiberManager();
    
    // Create event tracking variables
    let activatedEventFired = false;
    let deactivatedEventFired = false;
    let registeredEventFired = false;
    
    // Add event listener
    const listener = (event: FiberEvent, fiberId: string) => {
      if (event === FiberEvent.ACTIVATED && fiberId === 'fiber1') {
        activatedEventFired = true;
      } else if (event === FiberEvent.DEACTIVATED && fiberId === 'fiber1') {
        deactivatedEventFired = true;
      } else if (event === FiberEvent.REGISTERED && fiberId === 'fiber1') {
        registeredEventFired = true;
      }
    };
    
    addFiberEventListener(listener);
    
    // Register a fiber
    manager.registerFiber('fiber1', ['module1']);
    expect(registeredEventFired).toBe(true);
    
    // Activate the fiber
    manager.activateFiber('fiber1');
    expect(activatedEventFired).toBe(true);
    
    // Deactivate the fiber
    manager.deactivateFiber('fiber1');
    expect(deactivatedEventFired).toBe(true);
    
    // Remove the listener
    removeFiberEventListener(listener);
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
