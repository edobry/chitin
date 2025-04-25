import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { displayChain, getChainStatus } from '../../../src/commands/fibers/display';
import { UserConfig } from '../../../src/config/types';
import { Module } from '../../../src/modules/types';

// Extend Module type for testing purposes
interface TestModule extends Module {
  isEnabled?: boolean;
}

// Mock console.log to capture output
const originalConsoleLog = console.log;
let consoleOutput: string[] = [];

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args) => {
    consoleOutput.push(args.join(' '));
  };
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('Chain Display', () => {
  describe('getChainStatus', () => {
    it('should return black circle emoji for disabled chains', () => {
      expect(getChainStatus(false, true)).toBe('⚫');
    });

    it('should return green circle emoji for enabled chains', () => {
      expect(getChainStatus(true, true)).toBe('🟢');
    });

    it('should not show status when hideDisabled is true for enabled chains', () => {
      expect(getChainStatus(true, true, true)).toBe('🟢');
    });
  });

  describe('displayChain', () => {
    const mockConfig: UserConfig = {
      core: { enabled: true },
      testFiber: { 
        enabled: true,
        moduleConfig: {
          enabledChain: { enabled: true },
          disabledChain: { enabled: false },
          defaultChain: {}
        }
      },
      disabledFiber: {
        enabled: false,
        moduleConfig: {
          explicitlyEnabledChain: { enabled: true },
          explicitlyDisabledChain: { enabled: false },
          defaultChain: {}
        }
      }
    };

    const validationResults = {};
    const options = { detailed: false, hideDisabled: false };

    it('should display enabled chains in enabled fibers as enabled', () => {
      displayChain(
        'enabledChain',
        mockConfig.testFiber.moduleConfig.enabledChain,
        'testFiber',
        mockConfig,
        validationResults,
        1,
        options
      );

      expect(consoleOutput[0]).toContain('🟢');
      expect(consoleOutput[0]).toContain('enabledChain');
    });

    it('should display disabled chains in enabled fibers as disabled', () => {
      displayChain(
        'disabledChain',
        mockConfig.testFiber.moduleConfig.disabledChain,
        'testFiber',
        mockConfig,
        validationResults,
        2,
        options
      );

      expect(consoleOutput[0]).toContain('⚫');
      expect(consoleOutput[0]).toContain('disabledChain');
    });

    it('should display default chains in enabled fibers as enabled', () => {
      displayChain(
        'defaultChain',
        mockConfig.testFiber.moduleConfig.defaultChain,
        'testFiber',
        mockConfig,
        validationResults,
        3,
        options
      );

      expect(consoleOutput[0]).toContain('🟢');
      expect(consoleOutput[0]).toContain('defaultChain');
    });

    // Test for inheritance of fiber disabled state
    it('should display all chains in disabled fibers as disabled, regardless of chain config', () => {
      // Test explicitly enabled chain in disabled fiber
      displayChain(
        'explicitlyEnabledChain',
        mockConfig.disabledFiber.moduleConfig.explicitlyEnabledChain,
        'disabledFiber',
        mockConfig,
        validationResults,
        4,
        options
      );

      expect(consoleOutput[0]).toContain('⚫');
      expect(consoleOutput[0]).toContain('explicitlyEnabledChain');
      
      consoleOutput = []; // Reset output for next test
      
      // Test explicitly disabled chain in disabled fiber
      displayChain(
        'explicitlyDisabledChain',
        mockConfig.disabledFiber.moduleConfig.explicitlyDisabledChain,
        'disabledFiber',
        mockConfig,
        validationResults,
        5,
        options
      );

      expect(consoleOutput[0]).toContain('⚫');
      expect(consoleOutput[0]).toContain('explicitlyDisabledChain');
      
      consoleOutput = []; // Reset output for next test
      
      // Test default chain in disabled fiber
      displayChain(
        'defaultChain',
        mockConfig.disabledFiber.moduleConfig.defaultChain,
        'disabledFiber',
        mockConfig,
        validationResults,
        6,
        options
      );

      expect(consoleOutput[0]).toContain('⚫');
      expect(consoleOutput[0]).toContain('defaultChain');
    });

    it('should respect the module object isEnabled property if provided', () => {
      const moduleEnabled: TestModule = {
        id: 'moduleChain',
        name: 'Module Chain',
        type: 'chain',
        path: '/test/path',
        metadata: {},
        isEnabled: true
      };
      
      const moduleDisabled: TestModule = {
        id: 'moduleChain',
        name: 'Module Chain',
        type: 'chain',
        path: '/test/path',
        metadata: {},
        isEnabled: false
      };
      
      consoleOutput = [];
      displayChain(
        'moduleChain',
        { enabled: false }, // Config says disabled
        'testFiber',
        mockConfig,
        validationResults,
        7,
        options,
        moduleEnabled as Module // But module says enabled
      );
      
      expect(consoleOutput[0]).toContain('🟢');
      expect(consoleOutput[0]).toContain('moduleChain');
      
      consoleOutput = [];
      displayChain(
        'moduleChain',
        { enabled: true }, // Config says enabled
        'testFiber',
        mockConfig,
        validationResults,
        8,
        options,
        moduleDisabled as Module // But module says disabled
      );
      
      expect(consoleOutput[0]).toContain('⚫');
      expect(consoleOutput[0]).toContain('moduleChain');
    });

    // Test that module in disabled fiber is always disabled regardless of module.isEnabled
    it('should override module.isEnabled when fiber is disabled', () => {
      const moduleEnabled: TestModule = {
        id: 'moduleChain',
        name: 'Module Chain',
        type: 'chain',
        path: '/test/path',
        metadata: {},
        isEnabled: true // Explicitly enabled in module
      };
      
      displayChain(
        'moduleChain',
        { enabled: true }, // Explicitly enabled in config
        'disabledFiber', // But fiber is disabled
        mockConfig,
        validationResults,
        9,
        options,
        moduleEnabled as Module
      );
      
      expect(consoleOutput[0]).toContain('⚫');
      expect(consoleOutput[0]).toContain('moduleChain');
    });
  });
}); 
