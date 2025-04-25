export interface FiberCommandOptions {
  path?: string;
  baseDirs?: string[];
  available?: boolean;
  hideDisabled?: boolean;
  detailed?: boolean;
  json?: boolean;
  checkDependencies?: boolean;
  allModules?: boolean;
  yaml?: boolean;
  name?: string;
}

export interface ConfigAndModulesResult {
  config: any;
  validation: any;
  moduleResult: any;
  validationResults: any;
  allFibers: string[];
  loadableFibers: string[];
  displayFiberIds: string[];
  discoveredFiberModules: any[];
  discoveredFiberMap: Map<string, any>;
  discoveredChainModules: any[];
  discoveredChainMap: Map<string, any>;
  orderedFibers: string[];
  orderedChains: string[];
  fiberChainMap: Map<string, any[]>;
  loadableChains: string[];
  dependencyChecker: (tool: string) => boolean;
  dependencyGraph?: {
    dependencyMap: Map<string, string[]>;
    detectionInfo: Map<string, Array<{source: string, deps: string[]}>>;
  };
} 
