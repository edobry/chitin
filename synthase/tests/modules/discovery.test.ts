// @ts-ignore
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { discoverModules, discoverModulesFromConfig } from '../../src/modules/discovery';
import { ensureDir, writeFile, fileExists } from '../../src/utils/file';
import { join, resolve } from 'path';
import { rmSync, mkdirSync, existsSync } from 'fs';
import * as fs from "fs";
import path from "path";
import { UserConfig } from "../../src/types/config";

// Setup test fixtures
const TEST_DIR = resolve('./tests/fixtures/modules');
const FIBER_DIR = join(TEST_DIR, 'fiber1');
const CHAIN_DIR = join(TEST_DIR, 'chain1');

// Setup chitin-like structure fixtures
const MOCK_CHITIN_DIR = join(TEST_DIR, 'mock-chitin');
const MOCK_CHAINS_DIR = join(MOCK_CHITIN_DIR, 'chains');
const MOCK_CORE_DIR = join(MOCK_CHAINS_DIR, 'core');
const MOCK_INIT_DIR = join(MOCK_CHAINS_DIR, 'init');
const MOCK_EXTERNAL_FIBER = join(TEST_DIR, 'chitin-external');
const MOCK_EXTERNAL_CHAINS = join(MOCK_EXTERNAL_FIBER, 'chains');

describe('Module Discovery', () => {
  // Create mock chitin directory structure before all tests
  beforeAll(async () => {
    // Ensure test directory exists
    await ensureDir(TEST_DIR);
    
    // Create fiber1 setup
    await ensureDir(FIBER_DIR);
    await writeFile(join(FIBER_DIR, 'config.yaml'), `
enabled: true
fiberDeps: [core]
    `);
    
    // Create chain1 setup
    await ensureDir(CHAIN_DIR);
    await writeFile(join(CHAIN_DIR, 'config.yaml'), `
enabled: true
toolDeps: [git, node]
    `);
    
    // Create mock chitin structure
    await ensureDir(MOCK_CHITIN_DIR);
    await ensureDir(MOCK_CHAINS_DIR);
    await ensureDir(MOCK_CORE_DIR);
    await ensureDir(MOCK_INIT_DIR);
    
    // Create core config
    await writeFile(join(MOCK_CHITIN_DIR, 'config.yaml'), `
enabled: true
fiberDeps: []
    `);

    // Create core chain files
    await writeFile(join(MOCK_CORE_DIR, 'module.sh'), '# Test core module');
    await writeFile(join(MOCK_CORE_DIR, 'tools.sh'), '# Test core tools');
    
    // Create init chain files
    await writeFile(join(MOCK_INIT_DIR, 'init.sh'), '# Test init script');
    
    // Create external fiber
    await ensureDir(MOCK_EXTERNAL_FIBER);
    await ensureDir(MOCK_EXTERNAL_CHAINS);
    
    // Create external fiber config
    await writeFile(join(MOCK_EXTERNAL_FIBER, 'config.yaml'), `
enabled: true
fiberDeps: [core]
    `);
    
    // Create external fiber chain
    await writeFile(join(MOCK_EXTERNAL_CHAINS, 'external.sh'), '# Test external chain');
  });

  // Clean up test directories after all tests
  afterAll(() => {
    // Only remove test directories that we created
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('discovery works with basic directory structure', async () => {
    const result = await discoverModules({
      baseDirs: [TEST_DIR],
      recursive: true
    });
    
    // Debug output
    console.log('Basic test found modules:', result.modules.map(m => `${m.id} (${m.type}) at ${m.path}`));
    
    expect(result.errors).not.toContain(error => error.includes('not found'));
    expect(result.modules.length).toBeGreaterThan(0);
    
    // Check that modules from TEST_DIR were discovered
    const testDirModules = result.modules.filter(m => m.path.startsWith(TEST_DIR));
    expect(testDirModules.length).toBeGreaterThan(0);
  });

  test('discovers chains within mock chitin structure', async () => {
    const result = await discoverModules({
      baseDirs: [MOCK_CHITIN_DIR],
      recursive: false
    });

    // Debug output
    console.log('Chitin structure test found modules:', result.modules.map(m => `${m.id} (${m.type}) at ${m.path}`));
    
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }
    
    // There should be no errors
    expect(result.errors.length).toBe(0);
    
    // Core fiber may be discovered depending on implementation
    // But we should at least find core chains
    const coreChains = result.modules.filter(m => 
      m.type === 'chain' && m.path.includes(MOCK_CORE_DIR));
    
    expect(coreChains.length).toBeGreaterThan(0);
    
    // Init chain should be discovered
    const initChains = result.modules.filter(m => 
      m.type === 'chain' && m.path.includes(MOCK_INIT_DIR));
    
    expect(initChains.length).toBeGreaterThan(0);
  });

  test('discovers external fibers', async () => {
    const result = await discoverModules({
      baseDirs: [TEST_DIR],
      recursive: false
    });

    // Debug output
    console.log('External test found modules:', result.modules
      .filter(m => m.path.includes('chitin-external'))
      .map(m => `${m.id} (${m.type}) at ${m.path}`));
    
    // Should find modules in the external fiber
    const externalModules = result.modules.filter(m => m.path.includes(MOCK_EXTERNAL_FIBER));
    expect(externalModules.length).toBeGreaterThan(0);
    
    // Verify we find the external.sh chain
    const externalChain = result.modules.find(m => 
      m.path.includes(join(MOCK_EXTERNAL_CHAINS, 'external.sh')));
    expect(externalChain).toBeDefined();
  });

  test('handles both directory and file chains correctly', async () => {
    // Create a temporary chain directory and file for testing
    const tempChainDir = join(MOCK_CHAINS_DIR, 'temp-chain-dir');
    const tempChainFile = join(MOCK_CHAINS_DIR, 'temp-chain-file.sh');
    
    try {
      // Create a chain directory with config and script
      await ensureDir(tempChainDir);
      await writeFile(join(tempChainDir, 'config.yaml'), 'enabled: true');
      await writeFile(join(tempChainDir, 'temp-chain-dir-init.sh'), '# Test directory chain');
      
      // Create a chain file
      await writeFile(tempChainFile, '# Test file chain');
      
      // Discover modules
      const result = await discoverModules({
        baseDirs: [MOCK_CHITIN_DIR],
        recursive: false
      });
      
      // Debug output
      console.log('Directory/file test found chains:', result.modules
        .filter(m => m.path.includes('temp-chain-'))
        .map(m => `${m.id} (${m.type}) at ${m.path}`));
      
      // Directory chain should be discovered
      const dirChain = result.modules.find(m => m.path.includes(tempChainDir));
      expect(dirChain).toBeDefined();
      
      // File chain should be discovered
      const fileChain = result.modules.find(m => m.path.includes(tempChainFile));
      expect(fileChain).toBeDefined();
    } finally {
      // Clean up
      if (existsSync(tempChainDir)) {
        rmSync(tempChainDir, { recursive: true, force: true });
      }
      if (existsSync(tempChainFile)) {
        rmSync(tempChainFile, { force: true });
      }
    }
  });

  // This test is now successfully implemented and verified
  test('discovers modules from config with additional base directories', async () => {
    // Set up test fixture for this specific test
    const testFiberDir = path.join(process.env.CHI_TEST_TMP_DIR ?? "/tmp", `fiber-test-${Date.now()}`);
    const testFiberName = path.basename(testFiberDir);
    await fs.promises.mkdir(testFiberDir, { recursive: true });
    
    // Create a config file for the test fiber
    await fs.promises.writeFile(path.join(testFiberDir, 'config.yaml'), `
enabled: true
fiberDeps:
  - core
  - dotfiles
  - dev
`);
    
    try {
      // Create a minimal user config
      const userConfig = {
        core: {
          projectDir: testFiberDir,
          enabled: true
        }
      };
      
      // Test with additional base directory
      const result = await discoverModulesFromConfig(
        userConfig as UserConfig, 
        [testFiberDir]  // Pass the actual test fiber directory path
      );
      
      // Verify results
      expect(result.modules).toBeInstanceOf(Array);
      expect(result.errors.length).toBe(0);
      
      console.log('Test fiber modules:', result.modules.map(m => `${m.name} (${m.type}) at ${m.path}`));
      
      // Find the test module - use the directory name
      const testModule = result.modules.find(m => m.path === testFiberDir);
      expect(testModule).toBeDefined();
      
      if (testModule) {
        // Verify module properties
        expect(testModule.path).toBe(testFiberDir);
        expect(testModule.type).toBe('fiber');
        
        // Verify config properties from the config.yaml
        expect(testModule.config?.fiberDeps).toContain('core');
        expect(testModule.config?.fiberDeps).toContain('dotfiles');
        expect(testModule.config?.fiberDeps).toContain('dev');
      }
    } finally {
      // Clean up test directory
      await fs.promises.rm(testFiberDir, { recursive: true, force: true });
    }
  });

  test("discovers modules correctly according to Chitin's behavior", async () => {
    // Create temporary directories to simulate Chitin's structure
    const testDir = path.join(process.env.CHI_TEST_TMP_DIR ?? "/tmp", `chitin-test-${Date.now()}`);
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.writeFile(`${testDir}/.keep`, "");
    
    const chitinDir = path.join(testDir, "chitin");
    await fs.promises.mkdir(chitinDir, { recursive: true });
    await fs.promises.writeFile(`${chitinDir}/config.yaml`, "");
    
    const dotfilesDir = path.join(testDir, "dotfiles");
    await fs.promises.mkdir(dotfilesDir, { recursive: true });
    await fs.promises.writeFile(`${dotfilesDir}/config.yaml`, "");
    
    const chitinExternalDir = path.join(testDir, "chitin-external");
    await fs.promises.mkdir(chitinExternalDir, { recursive: true });
    await fs.promises.writeFile(`${chitinExternalDir}/config.yaml`, "");
    
    const regularDir = path.join(testDir, "regular-dir");
    await fs.promises.mkdir(regularDir, { recursive: true });
    await fs.promises.writeFile(`${regularDir}/config.yaml`, "");
    
    const chezmoidir = path.join(dotfilesDir, "chezmoi");
    await fs.promises.mkdir(chezmoidir, { recursive: true });
    await fs.promises.writeFile(`${chezmoidir}/config.yaml`, "");
    
    try {
      const config = {
        core: {
          projectDir: testDir,
          dotfilesDir: dotfilesDir,
          enabled: true
        },
        chitin: {
          modulesDir: chitinDir,
          chiDir: chitinDir
        }
      };
      
      const result = await discoverModulesFromConfig(config as UserConfig);
      
      // Should discover 3 modules: core, dotfiles, and chitin-external
      expect(result.modules.length).toBe(3);
      
      // Verify module names
      const moduleNames = result.modules.map(m => m.name);
      expect(moduleNames).toContain("core");
      expect(moduleNames).toContain("dotfiles");
      expect(moduleNames).toContain("external");
      
      // Should NOT discover 'chezmoi' as a separate module
      expect(moduleNames).not.toContain("chezmoi");
      
      // Should NOT discover 'regular-dir' as a module
      expect(moduleNames).not.toContain("regular-dir");
      
      // Verify core module path
      const coreModule = result.modules.find(m => m.name === "core");
      expect(coreModule?.path).toBe(chitinDir);
      
      // Verify dotfiles module path
      const dotfilesModule = result.modules.find(m => m.name === "dotfiles");
      expect(dotfilesModule?.path).toBe(dotfilesDir);
      
      // Verify external module path
      const externalModule = result.modules.find(m => m.name === "external");
      expect(externalModule?.path).toBe(chitinExternalDir);
    } finally {
      // Clean up test directories
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });
}); 
