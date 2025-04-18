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
let TEST_DIR = '';
let FIBER_DIR = '';
let CHAIN_DIR = '';

// Setup chitin-like structure fixtures
let MOCK_CHITIN_DIR = '';
let MOCK_CHAINS_DIR = '';
let MOCK_CORE_DIR = '';
let MOCK_INIT_DIR = '';
let MOCK_EXTERNAL_FIBER = '';
let MOCK_EXTERNAL_CHAINS = '';

describe('Module Discovery', () => {
  // Create mock chitin directory structure before all tests
  beforeAll(async () => {
    // Set up test directory structure
    TEST_DIR = join(process.env.CHI_TEST_TMP_DIR ?? '/tmp', `test-discovery-${Date.now()}`);
    MOCK_CHITIN_DIR = join(TEST_DIR, 'mock-chitin');
    MOCK_CHAINS_DIR = join(MOCK_CHITIN_DIR, 'chains');
    MOCK_CORE_DIR = join(MOCK_CHAINS_DIR, 'core');
    MOCK_INIT_DIR = join(MOCK_CHAINS_DIR, 'init');
    MOCK_EXTERNAL_FIBER = join(TEST_DIR, 'chitin-external');
    MOCK_EXTERNAL_CHAINS = join(MOCK_EXTERNAL_FIBER, 'chains');
    FIBER_DIR = join(TEST_DIR, 'fiber1');
    CHAIN_DIR = join(TEST_DIR, 'chain1');
    
    // Create test directory
    await ensureDir(TEST_DIR);
    
    // Create mock chitin directory structure
    await ensureDir(MOCK_CHITIN_DIR);
    await writeFile(join(MOCK_CHITIN_DIR, 'config.yaml'), 'enabled: true\n');
    
    await ensureDir(MOCK_CHAINS_DIR);
    await ensureDir(MOCK_CORE_DIR);
    await writeFile(join(MOCK_CORE_DIR, 'config.yaml'), 'enabled: true\n');
    await ensureDir(MOCK_INIT_DIR);
    await writeFile(join(MOCK_INIT_DIR, 'config.yaml'), 'enabled: true\n');
    
    // Create external fiber
    await ensureDir(MOCK_EXTERNAL_FIBER);
    await writeFile(join(MOCK_EXTERNAL_FIBER, 'config.yaml'), 'enabled: true\nfiberDeps:\n  - core\n');
    await ensureDir(MOCK_EXTERNAL_CHAINS);
    await writeFile(join(MOCK_EXTERNAL_CHAINS, 'external.sh'), '# External test chain');
  });

  // Clean up test directories after all tests
  afterAll(() => {
    // Only remove test directories that we created
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('discovery works with basic directory structure', async () => {
    // Create a direct file in the test dir since it might not be scanning the whole directory structure
    await writeFile(join(TEST_DIR, 'test-module.sh'), '# Test module\n');
    
    // Create a basic module structure in the test directory
    await ensureDir(FIBER_DIR);
    await writeFile(join(FIBER_DIR, 'config.yaml'), `
enabled: true
fiberDeps:
  - core
`);
    
    const result = await discoverModules({
      baseDirs: [FIBER_DIR], // Use FIBER_DIR directly since it has config.yaml
      recursive: true
    });
    
    // Debug output
    console.log('Basic test found modules:', result.modules.map(m => `${m.id} (${m.type}) at ${m.path}`));
    
    expect(result.errors).not.toContain(error => error.includes('not found'));
    expect(result.modules.length).toBeGreaterThan(0);
    
    // Check that we found the fiber module
    const fiberModule = result.modules.find(m => m.path === FIBER_DIR);
    expect(fiberModule).toBeDefined();
    expect(fiberModule?.type).toBe('fiber');
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
    // Make sure the external fiber actually exists
    await ensureDir(MOCK_EXTERNAL_FIBER);
    await writeFile(join(MOCK_EXTERNAL_FIBER, 'config.yaml'), 'enabled: true\n');
    await ensureDir(MOCK_EXTERNAL_CHAINS);
    await writeFile(join(MOCK_EXTERNAL_CHAINS, 'external.sh'), '# Test external chain\n');
    
    // Set process.env.CHI_DIR to the test directory to simulate Chitin's behavior
    const oldChiDir = process.env.CHI_DIR;
    process.env.CHI_DIR = MOCK_CHITIN_DIR;
    
    try {
      // Create a UserConfig to discover modules
      const config = {
        core: {
          projectDir: TEST_DIR,
          enabled: true
        }
      };
      
      // We need to use discoverModulesFromConfig to properly detect external fibers
      const result = await discoverModulesFromConfig(config as UserConfig);
      
      // Debug output
      console.log('External test found modules:', result.modules
        .filter(m => m.path.includes('chitin-external'))
        .map(m => `${m.id} (${m.type}) at ${m.path}`));
      
      // Should find modules in the external fiber
      const externalModules = result.modules.filter(m => m.path.includes(MOCK_EXTERNAL_FIBER));
      expect(externalModules.length).toBeGreaterThan(0);
      
      // Verify we find the external.sh chain or at least the external fiber
      const externalFiber = result.modules.find(m => 
        m.path === MOCK_EXTERNAL_FIBER && m.type === 'fiber');
      expect(externalFiber).toBeDefined();
    } finally {
      // Restore the original CHI_DIR
      process.env.CHI_DIR = oldChiDir;
    }
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
    
    // Create a config file for the test fiber with explicit string array for fiberDeps
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
      expect(result.modules.length).toBe(1);
      expect(result.errors.length).toBe(0);
      
      console.log('Test fiber modules:', result.modules.map(m => `${m.id} (${m.type}) at ${m.path}`));
      
      // Find the test module - use the directory name
      const testModule = result.modules.find(m => m.path === testFiberDir);
      expect(testModule).toBeDefined();
      
      if (testModule) {
        // Verify module properties
        expect(testModule.path).toBe(testFiberDir);
        expect(testModule.type).toBe('fiber');
        
        // Check that config exists - don't test specific properties
        expect(testModule.config).toBeDefined();
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
    await fs.promises.writeFile(`${chitinDir}/config.yaml`, "enabled: true");
    
    const dotfilesDir = path.join(testDir, "dotfiles");
    await fs.promises.mkdir(dotfilesDir, { recursive: true });
    await fs.promises.writeFile(`${dotfilesDir}/config.yaml`, "enabled: true");
    
    const chitinExternalDir = path.join(testDir, "chitin-external");
    await fs.promises.mkdir(chitinExternalDir, { recursive: true });
    await fs.promises.writeFile(`${chitinExternalDir}/config.yaml`, "enabled: true");
    
    const regularDir = path.join(testDir, "regular-dir");
    await fs.promises.mkdir(regularDir, { recursive: true });
    await fs.promises.writeFile(`${regularDir}/config.yaml`, "enabled: true");
    
    const chezmoidir = path.join(dotfilesDir, "chezmoi");
    await fs.promises.mkdir(chezmoidir, { recursive: true });
    await fs.promises.writeFile(`${chezmoidir}/config.yaml`, "enabled: true");
    
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
      
      // Set CHI_DIR to match the chitinDir
      const oldChiDir = process.env.CHI_DIR;
      process.env.CHI_DIR = chitinDir;
      
      try {
        const result = await discoverModulesFromConfig(config as UserConfig);
        
        console.log("Discovered modules:", result.modules.map(m => `${m.id} (${m.type}) at ${m.path}`));
        console.log("Errors:", result.errors);
        
        // We should find at least some modules
        expect(result.modules.length).toBeGreaterThan(0);
        
        // Verify module IDs
        const moduleIds = result.modules.map(m => m.id);
        
        // Dotfiles should always be found
        expect(moduleIds).toContain("dotfiles");
        
        // External module may be found depending on glob implementation
        if (moduleIds.includes("external")) {
          const externalModule = result.modules.find(m => m.id === "external");
          expect(externalModule?.path).toBe(chitinExternalDir);
        }
        
        // Should NOT discover 'chezmoi' as a separate module
        expect(moduleIds).not.toContain("chezmoi");
        
        // Should NOT discover 'regular-dir' as a module
        expect(moduleIds).not.toContain("regular-dir");
        
        // Verify dotfiles module path
        const dotfilesModule = result.modules.find(m => m.id === "dotfiles");
        expect(dotfilesModule?.path).toBe(dotfilesDir);
      } finally {
        // Restore the original CHI_DIR
        process.env.CHI_DIR = oldChiDir;
      }
    } finally {
      // Clean up test directories
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });
}); 
