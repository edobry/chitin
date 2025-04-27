import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { loadUserConfig, getDefaultConfig, getFullConfig } from '../../src/config';
import { writeFile } from '../../src/utils';
import path from 'path';
import fs from 'fs';

// Test directory and files
const TEST_DIR = path.join(process.cwd(), '.test-temp');
const TEST_CONFIG_PATH = path.join(TEST_DIR, 'userConfig.yaml');

// Test user config
const TEST_USER_CONFIG = `
core:
  projectDir: ~/projects
  dotfilesDir: ~/dotfiles
  checkTools: true
fibers:
  test-fiber:
    enabled: true
    fiberDeps:
      - core
`;

describe('Configuration Loader', () => {
  // Set up test directory and files
  beforeAll(async () => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Write test config file
    await writeFile(TEST_CONFIG_PATH, TEST_USER_CONFIG);
  });
  
  // Clean up test directory and files
  afterAll(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    
    if (fs.existsSync(TEST_DIR)) {
      fs.rmdirSync(TEST_DIR);
    }
  });
  
  test('getDefaultConfig returns default configuration', () => {
    const defaultConfig = getDefaultConfig();
    
    expect(defaultConfig).toBeDefined();
    expect(defaultConfig.core.checkTools).toBe(false);
    expect(defaultConfig.core.installToolDeps).toBe(false);
    expect(defaultConfig.fibers).toEqual({});
    expect(defaultConfig.chains).toEqual({});
    expect(defaultConfig.tools).toEqual({});
  });
  
  test('loadUserConfig loads configuration from file', async () => {
    const userConfig = await loadUserConfig({
      userConfigPath: TEST_CONFIG_PATH,
    });
    
    expect(userConfig).toBeDefined();
    expect(userConfig?.core.projectDir).toContain('/projects');
    expect(userConfig?.core.dotfilesDir).toContain('/dotfiles');
    expect(userConfig?.core.checkTools).toBe(true);
    expect(userConfig?.fibers?.['test-fiber']).toBeDefined();
    expect(userConfig?.fibers?.['test-fiber'].fiberDeps).toEqual(['core']);
  });
  
  test('getFullConfig merges user config with defaults', async () => {
    const userConfig = await loadUserConfig({
      userConfigPath: TEST_CONFIG_PATH,
    });
    
    const fullConfig = getFullConfig(userConfig);
    
    expect(fullConfig).toBeDefined();
    expect(fullConfig.core.checkTools).toBe(true);
    expect(fullConfig.core.installToolDeps).toBe(false); // from default
    expect(fullConfig.fibers?.['test-fiber']).toBeDefined();
    expect(fullConfig.chains).toEqual({}); // from default
    expect(fullConfig.tools).toEqual({}); // from default
  });
}); 
