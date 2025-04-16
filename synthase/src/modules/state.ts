import { ModuleState } from '../types';
import { join } from 'path';
import { ensureDir, writeFile, fileExists, readFile } from '../utils/file';
import { getAllModuleStates, updateModuleState } from './loader';

// Path constants
const STATE_DIR_NAME = '.cache/chitin/modules';
const STATE_FILE_NAME = 'state.json';

/**
 * Gets the path to the module state directory
 * @returns State directory path
 */
function getStateDir(): string {
  const homeDir = Bun.env.HOME || '~';
  return join(homeDir, STATE_DIR_NAME);
}

/**
 * Gets the path to the module state file
 * @returns State file path
 */
function getStateFilePath(): string {
  return join(getStateDir(), STATE_FILE_NAME);
}

/**
 * Persists all module states to disk
 * @returns Whether the operation was successful
 */
export async function persistModuleStates(): Promise<boolean> {
  try {
    const stateDir = getStateDir();
    await ensureDir(stateDir);
    
    const states = getAllModuleStates();
    const stateData = JSON.stringify(states, null, 2);
    
    await writeFile(getStateFilePath(), stateData);
    return true;
  } catch (error) {
    console.error('Failed to persist module states:', error);
    return false;
  }
}

/**
 * Loads module states from disk
 * @returns Whether the operation was successful
 */
export async function loadModuleStates(): Promise<boolean> {
  try {
    const statePath = getStateFilePath();
    
    if (!await fileExists(statePath)) {
      return false;
    }
    
    const stateData = await readFile(statePath);
    const states = JSON.parse(stateData) as ModuleState[];
    
    // Update module states in memory
    for (const state of states) {
      if (state.moduleId) {
        // Reset loaded status - modules need to be explicitly loaded again
        updateModuleState(state.moduleId, {
          ...state,
          loaded: false
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to load module states:', error);
    return false;
  }
}

/**
 * Clears all module states
 * @returns Whether the operation was successful
 */
export async function clearModuleStates(): Promise<boolean> {
  try {
    const statePath = getStateFilePath();
    
    if (await fileExists(statePath)) {
      await writeFile(statePath, '[]');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to clear module states:', error);
    return false;
  }
}

/**
 * Gets historical state data for a module
 * @param moduleId Module ID
 * @returns Historical state data or null if not found
 */
export async function getModuleHistory(moduleId: string): Promise<{
  loadCount: number;
  firstLoaded?: Date;
  lastLoaded?: Date;
  errorCount: number;
  lastError?: string;
} | null> {
  try {
    const statePath = getStateFilePath();
    
    if (!await fileExists(statePath)) {
      return null;
    }
    
    const stateData = await readFile(statePath);
    const states = JSON.parse(stateData) as ModuleState[];
    
    const moduleState = states.find(state => state.moduleId === moduleId);
    if (!moduleState) {
      return null;
    }
    
    // Extract historical data
    const history = moduleState.data?.history || {};
    
    return {
      loadCount: history.loadCount || 0,
      firstLoaded: history.firstLoaded ? new Date(history.firstLoaded) : undefined,
      lastLoaded: moduleState.lastLoaded ? new Date(moduleState.lastLoaded) : undefined,
      errorCount: history.errorCount || 0,
      lastError: moduleState.lastError
    };
  } catch (error) {
    console.error(`Failed to get history for module ${moduleId}:`, error);
    return null;
  }
}

/**
 * Updates historical data for a module
 * @param moduleId Module ID
 * @param historyUpdate History update
 */
export async function updateModuleHistory(
  moduleId: string,
  historyUpdate: { loaded?: boolean; error?: string }
): Promise<void> {
  try {
    const state = getAllModuleStates().find(state => state.moduleId === moduleId);
    if (!state) {
      return;
    }
    
    // Initialize history data if not exists
    if (!state.data) {
      state.data = {};
    }
    
    if (!state.data.history) {
      state.data.history = {
        loadCount: 0,
        errorCount: 0
      };
    }
    
    const history = state.data.history;
    
    // Update load count and timestamps
    if (historyUpdate.loaded) {
      history.loadCount = (history.loadCount || 0) + 1;
      
      if (!history.firstLoaded) {
        history.firstLoaded = new Date().toISOString();
      }
    }
    
    // Update error count
    if (historyUpdate.error) {
      history.errorCount = (history.errorCount || 0) + 1;
    }
    
    // Update state with new history data
    updateModuleState(moduleId, {
      data: {
        ...state.data,
        history
      }
    });
    
    // Persist changes
    await persistModuleStates();
  } catch (error) {
    console.error(`Failed to update history for module ${moduleId}:`, error);
  }
} 
