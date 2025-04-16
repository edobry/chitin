import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { discoverModules } from '../../src/modules/discovery';
import { ensureDir, writeFile, fileExists } from '../../src/utils/file';
import { join, resolve } from 'path';
import { rmSync, mkdirSync, existsSync } from 'fs';

// Setup test fixtures
const TEST_DIR = resolve('./tests/fixtures/modules');
const FIBER_DIR = join(TEST_DIR, 'fiber1');
const CHAIN_DIR = join(TEST_DIR, 'chain1');

describe('Module Discovery', () => {
  test('should discover modules in directories', async () => {
    // Skip the test if the directories don't exist
    if (!existsSync(TEST_DIR) || !existsSync(FIBER_DIR) || !existsSync(CHAIN_DIR)) {
      console.log('Skipping test because directories do not exist');
      return;
    }
    
    const result = await discoverModules({
      baseDirs: [TEST_DIR],
      recursive: true
    });
    
    expect(result.errors.length).toBe(0);
    expect(result.modules.length).toBe(2);
    
    // Check fiber module
    const fiberModule = result.modules.find(m => m.id === 'fiber1');
    expect(fiberModule).toBeDefined();
    expect(fiberModule?.type).toBe('fiber');
    expect(fiberModule?.metadata.dependencies).toBeDefined();
    expect(fiberModule?.metadata.dependencies?.length).toBe(1);
    expect(fiberModule?.metadata.dependencies?.[0].moduleId).toBe('core');
    
    // Check chain module
    const chainModule = result.modules.find(m => m.id === 'chain1');
    expect(chainModule).toBeDefined();
    expect(chainModule?.type).toBe('chain');
    expect(chainModule?.metadata.dependencies).toBeDefined();
    expect(chainModule?.metadata.dependencies?.length).toBe(2);
    expect(chainModule?.metadata.dependencies?.map(d => d.moduleId)).toContain('git');
    expect(chainModule?.metadata.dependencies?.map(d => d.moduleId)).toContain('node');
  });
}); 
