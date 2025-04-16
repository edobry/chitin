/**
 * Represents the state of a fiber
 */
export interface FiberState {
  /** Fiber ID */
  id: string;
  /** Whether the fiber is activated */
  active: boolean;
  /** Associated modules */
  modules: string[];
  /** Last activation timestamp */
  lastActivated?: Date;
  /** Additional fiber state data */
  data?: Record<string, any>;
}

/**
 * Fiber manager for controlling active fibers
 */
export interface FiberManager {
  /** Get all registered fibers */
  getAllFibers: () => FiberState[];
  /** Get active fibers */
  getActiveFibers: () => FiberState[];
  /** Activate a fiber */
  activateFiber: (id: string) => boolean;
  /** Deactivate a fiber */
  deactivateFiber: (id: string) => boolean;
  /** Check if a fiber is active */
  isFiberActive: (id: string) => boolean;
  /** Register a new fiber */
  registerFiber: (id: string, modules?: string[]) => void;
  /** Persist fiber states */
  persistFiberState: () => Promise<void>;
  /** Load fiber states */
  loadFiberState: () => Promise<void>;
}

/**
 * Filter function for filtering modules based on fiber state
 */
export type FiberFilter = (moduleId: string, fiberStates: FiberState[]) => boolean;

/**
 * Options for fiber activation/deactivation
 */
export interface FiberActivationOptions {
  /** Whether to persist the state change */
  persist?: boolean;
  /** Whether to reload affected modules */
  reloadModules?: boolean;
  /** Whether to notify listeners of the state change */
  notifyListeners?: boolean;
}

/**
 * Events emitted by the fiber manager
 */
export enum FiberEvent {
  ACTIVATED = 'fiber:activated',
  DEACTIVATED = 'fiber:deactivated',
  REGISTERED = 'fiber:registered',
  STATE_CHANGED = 'fiber:state-changed'
}

/**
 * Listener function for fiber events
 */
export type FiberEventListener = (event: FiberEvent, fiberId: string) => void; 
