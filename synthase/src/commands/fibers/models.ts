/**
 * @file models.ts
 * @description Data model interfaces for the fiber command refactoring
 */

import { Module } from '../../types/module';
import { UserConfig, ConfigValidationResult } from '../../types/config';
import { EMOJI } from '../../constants';

/**
 * Interface for fiber display model
 */
export interface FiberDisplayModel {
  id: string;
  isCore: boolean;
  isEnabled: boolean;
  path: string;
  dependencies: Array<{
    id: string;
    source: string;
    isSatisfied: boolean;
  }>;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  chains: ChainDisplayModel[];
}

/**
 * Interface for chain display model
 */
export interface ChainDisplayModel {
  id: string;
  isEnabled: boolean;
  isAvailable: boolean;
  isConfigured: boolean;
  dependencies: Array<{
    id: string;
    isSatisfied: boolean;
  }>;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  order: number;
  toolDependencies?: string[];
  provides?: string[];
}

/**
 * Interface for fiber summary model
 */
export interface FiberSummaryModel {
  displayedFibers: number;
  totalFibers: number;
  configuredFibers: number;
  displayedChains: number;
  totalChains: number;
  configuredChains: number;
  validModules: number;
  totalModules: number;
}

/**
 * Interface for processed fiber data
 */
export interface ProcessedFiberData {
  fibers: FiberDisplayModel[];
  summary: FiberSummaryModel;
}

/**
 * Interface for fiber command options
 */
export interface FiberCommandOptions {
  name?: string;
  available?: boolean;
  checkDependencies?: boolean;
  detailed?: boolean;
  allModules?: boolean;
  hideDisabled?: boolean;
  json?: boolean;
  yaml?: boolean;
  path?: string;
  baseDirs?: string[];
}

/**
 * Interface for fiber environment
 */
export interface FiberEnvironment {
  config: UserConfig;
  validationResults: Record<string, ConfigValidationResult>;
  allFibers: string[];
  loadableFibers: string[];
  displayFiberIds: string[];
  discoveredFiberModules: Module[];
  discoveredFiberMap: Map<string, Module>;
  discoveredChainModules: Module[];
  moduleResult: {
    modules: Module[];
  };
  orderedChains: string[];
  fiberChainMap: Map<string, string[]>;
  loadableChains: string[];
  dependencyChecker: any; // TODO: Type this properly
  dependencyGraph: {
    dependencyMap: Map<string, string[]>;
    detectionInfo: Map<string, Array<{source: string, deps: string[]}>>;
  };
  orderedFibers: string[];
} 
