/**
 * Represents a fiber state
 */
export interface FiberState {
  /** Fiber ID */
  id: string;
  /** Whether the fiber is enabled in configuration */
  enabled?: boolean;
  /** Associated modules */
  modules: string[];
  /** Required tools for this fiber */
  requiredTools?: string[];
  /** Additional fiber configuration data */
  config?: Record<string, any>;
}

/**
 * Fiber manager for handling fiber configurations
 */
export interface FiberManager {
  /** Get all registered fibers */
  getAllFibers: () => FiberState[];
  /** Get enabled fibers with satisfied dependencies */
  getLoadableFibers: () => FiberState[];
  /** Check if a fiber is enabled in configuration */
  isFiberEnabled: (id: string) => boolean;
  /** Check if a fiber's tool dependencies are satisfied */
  areDependenciesSatisfied: (id: string) => boolean;
  /** Register a new fiber from configuration */
  registerFiber: (id: string, config: Partial<FiberState>) => void;
}

/**
 * Tool dependency checker function
 */
export type ToolDependencyChecker = (tool: string) => boolean;

/**
 * Filter function for filtering modules based on fiber configs
 */
export type ModuleFilter = (moduleId: string) => boolean; 
