#!/usr/bin/env bun
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { createDepsCommand } from '../../../src/commands/fibers/deps-command';
import * as shared from '../../../src/commands/fibers/shared';
import { FIBER_NAMES } from '../../../src/fiber/types';
import { Module } from '../../../src/modules/types';
import { UserConfig, CONFIG_FIELDS } from '../../../src/config/types';

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
    // Join arrays in args for a cleaner snapshot
    const processedArgs = args.map(arg => 
      typeof arg === 'object' && arg !== null ? JSON.stringify(arg, null, 2) : arg
    );
    consoleOutput.push(processedArgs.join(" "));
  };

  beforeEach(() => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;
  });
  
  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });

  // Basic command visualization tests
  describe('basic dependency structure', () => {
    beforeEach(() => {
      const env = createBasicTestEnvironment();
      spyOn(shared, 'loadConfigAndModules').mockResolvedValue(env);
    });

    test('should display tree diagram by default', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps"]);
      
      // Verify we have some output
      expect(consoleOutput.length).toBeGreaterThan(0);
      
      // Snapshot test to catch unexpected changes in output format
      expect(consoleOutput.join("\n")).toMatchSnapshot();
    });
    
    test('should output JSON when --json flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--json"]);
      
      // Just check that we got some output
      const output = consoleOutput.join("\n");
      expect(output.length).toBeGreaterThan(0);
      
      // Snapshot test for JSON output
      expect(output).toMatchSnapshot();
    });
    
    test('should hide disabled fibers when --hide-disabled flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--hide-disabled"]);
      
      // Snapshot test for filtered output
      expect(consoleOutput.join("\n")).toMatchSnapshot();
    });
    
    test('should show flat list when --flat flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--flat"]);
      
      // Snapshot test for flat list
      expect(consoleOutput.join("\n")).toMatchSnapshot();
    });
  });

  // Complex dependency structure tests
  describe('complex dependency structure', () => {
    beforeEach(() => {
      const env = createComplexTestEnvironment();
      spyOn(shared, 'loadConfigAndModules').mockResolvedValue(env);
    });
    
    test('should show reverse dependencies when --reverse flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--reverse"]);
      
      // Snapshot test for reverse dependencies
      expect(consoleOutput.join("\n")).toMatchSnapshot();
    });
    
    test('should show detailed information when --detailed flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--detailed"]);
      
      // Snapshot test for detailed mode
      expect(consoleOutput.join("\n")).toMatchSnapshot();
    });
    
    test('should output GraphViz format when --graphviz flag is used', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--graphviz"]);
      
      // Just check we got some output
      const output = consoleOutput.join("\n");
      expect(output.length).toBeGreaterThan(0);
      
      // Snapshot test for GraphViz output
      expect(output).toMatchSnapshot();
    });
    
    test('should handle multiple flags together', async () => {
      const command = createDepsCommand();
      await command.parseAsync(["deps", "--hide-disabled", "--reverse", "--flat"]);
      
      // Snapshot test for combined flags
      expect(consoleOutput.join("\n")).toMatchSnapshot();
    });
  });
}); 
