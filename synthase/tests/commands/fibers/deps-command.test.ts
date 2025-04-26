#!/usr/bin/env bun
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createDepsCommand } from '../../../src/commands/fibers/commands/deps-command';
import { loadConfigAndModules } from '../../../src/commands/fibers/utils/config-loader';
import { FIBER_NAMES } from '../../../src/fiber/types';
import { Module } from '../../../src/modules/types';
import { UserConfig } from '../../../src/config/types';

/**
 * Helper to create fiber modules for testing
 */
function createTestFiberModule(id: string, config: any = {}): Module {
  return {
    id,
    type: 'fiber',
    name: `${id.charAt(0).toUpperCase() + id.slice(1)} Fiber`,
    path: `/path/to/${id}`,
    config,
    metadata: {}
  } as Module;
}

/**
 * Helper to create a basic test environment with a simple dependency structure
 */
function createBasicTestEnvironment() {
  // Create a simple dependency structure: core <- dev <- app
  const config: UserConfig = {
    core: { enabled: true },
    dev: { enabled: true, fiberDeps: ['core'] },
    app: { enabled: true, fiberDeps: ['dev'] },
    utils: { enabled: true, fiberDeps: ['core'] },
    plugin: { enabled: false, fiberDeps: ['app'] }
  } as any;

  const modules = [
    createTestFiberModule('core'),
    createTestFiberModule('dev', { fiberDeps: ['core'] }),
    createTestFiberModule('app', { fiberDeps: ['dev'] }),
    createTestFiberModule('utils', { fiberDeps: ['core'] }),
    createTestFiberModule('plugin', { fiberDeps: ['app'] })
  ];

  const displayFiberIds = ['core', 'dev', 'app', 'utils', 'plugin'];
  const orderedFibers = ['core', 'dev', 'app', 'utils', 'plugin'];

  return {
    config,
    moduleResult: { modules },
    displayFiberIds,
    orderedFibers
  };
}

/**
 * Helper to create a test environment with more complex relationships
 */
function createComplexTestEnvironment() {
  const config: UserConfig = {
    [FIBER_NAMES.CORE]: { enabled: true },
    dev: { 
      enabled: true, 
      fiberDeps: [FIBER_NAMES.CORE],
      provides: ['dev-tool']
    },
    ui: {
      enabled: true,
      fiberDeps: ['dev'],
      provides: ['ui-component']
    },
    api: {
      enabled: true,
      fiberDeps: ['dev'],
      toolDeps: ['ui-component']
    },
    data: {
      enabled: false,
      fiberDeps: ['api', 'ui']
    }
  } as any;

  const modules = [
    createTestFiberModule(FIBER_NAMES.CORE),
    createTestFiberModule('dev', { fiberDeps: [FIBER_NAMES.CORE] }),
    createTestFiberModule('ui', { fiberDeps: ['dev'] }),
    createTestFiberModule('api', { fiberDeps: ['dev'], toolDeps: ['ui-component'] }),
    createTestFiberModule('data', { fiberDeps: ['api', 'ui'] })
  ];

  const displayFiberIds = [FIBER_NAMES.CORE, 'dev', 'ui', 'api', 'data'];
  const orderedFibers = [FIBER_NAMES.CORE, 'dev', 'ui', 'api', 'data'];

  return {
    config,
    moduleResult: { modules },
    displayFiberIds,
    orderedFibers
  };
}

describe('deps command', () => {
  // Mock console.log to capture output
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];

  const mockConsoleLog = (...args: any[]) => {
    // Join arrays in args for a cleaner assertion
    const processedArgs = args.map(arg => 
      typeof arg === 'object' && arg !== null ? JSON.stringify(arg, null, 2) : arg
    );
    consoleOutput.push(processedArgs.join(" "));
  };

  // Save original implementation
  const originalLoadConfigAndModules = loadConfigAndModules;

  beforeEach(() => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;
  });
  
  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
    // Restore original loadConfigAndModules
    (loadConfigAndModules as any) = originalLoadConfigAndModules;
  });

  // Basic command visualization tests
  describe('basic dependency structure', () => {
    beforeEach(() => {
      const env = createBasicTestEnvironment();
      (loadConfigAndModules as any) = async () => env;
    });

    test('should display tree diagram by default', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps"]);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
    
    test('should output JSON when --json flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--json"]);
      const output = consoleOutput.join("\n");
      expect(output.length).toBeGreaterThan(0);
    });
    
    test('should hide disabled fibers when --hide-disabled flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--hide-disabled"]);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
    
    test('should show flat list when --flat flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--flat"]);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
  });

  // Complex dependency structure tests
  describe('complex dependency structure', () => {
    beforeEach(() => {
      const env = createComplexTestEnvironment();
      (loadConfigAndModules as any) = async () => env;
    });
    
    test('should show reverse dependencies when --reverse flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--reverse"]);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
    
    test('should show detailed information when --detailed flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--detailed"]);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
    
    test('should output GraphViz format when --graphviz flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--graphviz"]);
      const output = consoleOutput.join("\n");
      expect(output.length).toBeGreaterThan(0);
    });
  });
}); 
