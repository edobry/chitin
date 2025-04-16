import { FiberManager, FiberState, FiberEvent, FiberActivationOptions, FiberEventListener, FiberFilter } from '../types';
import { join } from 'path';
import { ensureDir, writeFile, fileExists, readFile } from '../utils/file';

// Store fiber states in memory
const fiberStates = new Map<string, FiberState>();
// Store event listeners
const eventListeners: FiberEventListener[] = [];

// Path constants
const FIBER_STATE_DIR = '.cache/chitin/fibers';
const FIBER_STATE_FILE = 'state.json';

/**
 * Creates a fiber manager
 * @returns Fiber manager instance
 */
export function createFiberManager(): FiberManager {
  /**
   * Gets all registered fibers
   * @returns All fiber states
   */
  const getAllFibers = (): FiberState[] => {
    return Array.from(fiberStates.values());
  };
  
  /**
   * Gets all active fibers
   * @returns Active fiber states
   */
  const getActiveFibers = (): FiberState[] => {
    return Array.from(fiberStates.values()).filter(state => state.active);
  };
  
  /**
   * Activates a fiber
   * @param id Fiber ID to activate
   * @param options Activation options
   * @returns Whether activation was successful
   */
  const activateFiber = (id: string, options: FiberActivationOptions = {}): boolean => {
    const state = fiberStates.get(id);
    if (!state) {
      return false;
    }
    
    // Update state
    state.active = true;
    state.lastActivated = new Date();
    
    // Notify listeners
    if (options.notifyListeners !== false) {
      notifyListeners(FiberEvent.ACTIVATED, id);
      notifyListeners(FiberEvent.STATE_CHANGED, id);
    }
    
    // Persist state change
    if (options.persist !== false) {
      persistFiberState();
    }
    
    return true;
  };
  
  /**
   * Deactivates a fiber
   * @param id Fiber ID to deactivate
   * @param options Deactivation options
   * @returns Whether deactivation was successful
   */
  const deactivateFiber = (id: string, options: FiberActivationOptions = {}): boolean => {
    const state = fiberStates.get(id);
    if (!state) {
      return false;
    }
    
    // Update state
    state.active = false;
    
    // Notify listeners
    if (options.notifyListeners !== false) {
      notifyListeners(FiberEvent.DEACTIVATED, id);
      notifyListeners(FiberEvent.STATE_CHANGED, id);
    }
    
    // Persist state change
    if (options.persist !== false) {
      persistFiberState();
    }
    
    return true;
  };
  
  /**
   * Checks if a fiber is active
   * @param id Fiber ID to check
   * @returns Whether the fiber is active
   */
  const isFiberActive = (id: string): boolean => {
    const state = fiberStates.get(id);
    return state?.active || false;
  };
  
  /**
   * Registers a new fiber
   * @param id Fiber ID
   * @param modules Associated modules
   */
  const registerFiber = (id: string, modules: string[] = []): void => {
    const existingState = fiberStates.get(id);
    
    // Create new state or update existing
    fiberStates.set(id, {
      id,
      active: existingState?.active || false,
      modules,
      lastActivated: existingState?.lastActivated,
      data: existingState?.data || {}
    });
    
    // Notify listeners
    notifyListeners(FiberEvent.REGISTERED, id);
  };
  
  /**
   * Persists fiber states to disk
   */
  const persistFiberState = async (): Promise<void> => {
    try {
      const stateDir = getFiberStateDir();
      await ensureDir(stateDir);
      
      const statePath = getFiberStatePath();
      const states = Array.from(fiberStates.values());
      const stateData = JSON.stringify(states, null, 2);
      
      await writeFile(statePath, stateData);
    } catch (error) {
      console.error('Failed to persist fiber states:', error);
    }
  };
  
  /**
   * Loads fiber states from disk
   */
  const loadFiberState = async (): Promise<void> => {
    try {
      const statePath = getFiberStatePath();
      
      if (!await fileExists(statePath)) {
        return;
      }
      
      const stateData = await readFile(statePath);
      const states = JSON.parse(stateData) as FiberState[];
      
      // Clear existing states
      fiberStates.clear();
      
      // Load states from file
      for (const state of states) {
        if (state.id) {
          fiberStates.set(state.id, state);
        }
      }
    } catch (error) {
      console.error('Failed to load fiber states:', error);
    }
  };
  
  return {
    getAllFibers,
    getActiveFibers,
    activateFiber,
    deactivateFiber,
    isFiberActive,
    registerFiber,
    persistFiberState,
    loadFiberState
  };
}

/**
 * Gets the path to the fiber state directory
 * @returns Fiber state directory path
 */
function getFiberStateDir(): string {
  const homeDir = Bun.env.HOME || '~';
  return join(homeDir, FIBER_STATE_DIR);
}

/**
 * Gets the path to the fiber state file
 * @returns Fiber state file path
 */
function getFiberStatePath(): string {
  return join(getFiberStateDir(), FIBER_STATE_FILE);
}

/**
 * Notifies all event listeners
 * @param event Event type
 * @param fiberId Fiber ID
 */
function notifyListeners(event: FiberEvent, fiberId: string): void {
  for (const listener of eventListeners) {
    try {
      listener(event, fiberId);
    } catch (error) {
      console.error(`Error in fiber event listener for ${event}:`, error);
    }
  }
}

/**
 * Adds an event listener
 * @param listener Listener function
 */
export function addFiberEventListener(listener: FiberEventListener): void {
  eventListeners.push(listener);
}

/**
 * Removes an event listener
 * @param listener Listener function to remove
 */
export function removeFiberEventListener(listener: FiberEventListener): void {
  const index = eventListeners.indexOf(listener);
  if (index !== -1) {
    eventListeners.splice(index, 1);
  }
}

/**
 * Creates a filter function for modules based on fiber state
 * @param includeInactive Whether to include modules in inactive fibers
 * @returns Filter function
 */
export function createFiberFilter(includeInactive = false): FiberFilter {
  return (moduleId: string, fiberStates: FiberState[]): boolean => {
    // If no fiber states, allow all modules
    if (fiberStates.length === 0) {
      return true;
    }
    
    // Check if module is in any active fiber
    for (const state of fiberStates) {
      if ((state.active || includeInactive) && state.modules.includes(moduleId)) {
        return true;
      }
    }
    
    return false;
  };
} 
