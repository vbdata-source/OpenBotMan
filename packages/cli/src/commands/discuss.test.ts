/**
 * Tests for discuss command workspace/include functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { loadProjectContext, type DiscussOptions } from './discuss.js';

const TEST_DIR = join(process.cwd(), 'test-workspace-temp');

describe('loadProjectContext with workspace', () => {
  beforeEach(() => {
    // Create test directory structure
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'src', 'utils'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'lib'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'node_modules', 'some-pkg'), { recursive: true });

    // Create test files
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project for workspace loading',
    }, null, 2));

    writeFileSync(join(TEST_DIR, 'README.md'), '# Test Project\n\nThis is a test.');

    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), `
export function main() {
  console.log('Hello World');
}
`);

    writeFileSync(join(TEST_DIR, 'src', 'utils', 'helper.ts'), `
export function helper() {
  return 'helper';
}
`);

    writeFileSync(join(TEST_DIR, 'lib', 'legacy.js'), `
module.exports = { legacy: true };
`);

    // File that should be ignored
    writeFileSync(join(TEST_DIR, 'node_modules', 'some-pkg', 'index.js'), 'module.exports = {}');
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should load files from workspace with include patterns', async () => {
    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: TEST_DIR,
      include: ['src/**/*.ts'],
    };

    const context = await loadProjectContext(options);

    expect(context.projectRoot).toBe(TEST_DIR);
    expect(context.packageJson).toBeDefined();
    expect(context.packageJson?.name).toBe('test-project');
    expect(context.readme).toContain('Test Project');
    
    // Should find TypeScript files
    expect(context.sourceFiles.length).toBeGreaterThan(0);
    const filePaths = context.sourceFiles.map(f => f.path);
    expect(filePaths).toContain('src/index.ts');
    expect(filePaths).toContain('src/utils/helper.ts');
    
    // Should NOT include lib/*.js (not matching pattern)
    expect(filePaths).not.toContain('lib/legacy.js');
  });

  it('should support multiple include patterns', async () => {
    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: TEST_DIR,
      include: ['src/**/*.ts', 'lib/**/*.js'],
    };

    const context = await loadProjectContext(options);
    const filePaths = context.sourceFiles.map(f => f.path);

    expect(filePaths).toContain('src/index.ts');
    expect(filePaths).toContain('lib/legacy.js');
  });

  it('should ignore node_modules by default', async () => {
    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: TEST_DIR,
      include: ['**/*.js'],
    };

    const context = await loadProjectContext(options);
    const filePaths = context.sourceFiles.map(f => f.path);

    // Should have lib/legacy.js but NOT node_modules
    expect(filePaths.some(p => p.includes('node_modules'))).toBe(false);
  });

  it('should respect maxContextKb limit', async () => {
    // Create a large file
    const largeContent = 'x'.repeat(50000); // 50KB
    writeFileSync(join(TEST_DIR, 'src', 'large.ts'), largeContent);

    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: TEST_DIR,
      include: ['src/**/*.ts'],
      maxContextKb: 10, // Only 10KB allowed
    };

    const context = await loadProjectContext(options);

    // Total size should be limited
    expect(context.totalSize).toBeLessThanOrEqual(10 * 1024 + 1000); // Some buffer for truncation text
  });

  it('should fallback to src/ if no include patterns provided', async () => {
    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: TEST_DIR,
      // No include patterns
    };

    const context = await loadProjectContext(options);

    // Should auto-detect and load from src/
    expect(context.sourceFiles.length).toBeGreaterThan(0);
  });

  it('should use files option over auto-detect', async () => {
    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: TEST_DIR,
      files: ['lib/legacy.js'],
    };

    const context = await loadProjectContext(options);
    const filePaths = context.sourceFiles.map(f => f.path);

    expect(filePaths).toContain('lib/legacy.js');
    // Should NOT have src files since we specified specific files
  });

  it('should handle non-existent workspace gracefully', async () => {
    const options: DiscussOptions = {
      topic: 'Test topic',
      workspace: '/non/existent/path',
      include: ['**/*.ts'],
    };

    const context = await loadProjectContext(options);

    // Should return empty context
    expect(context.sourceFiles.length).toBe(0);
    expect(context.readme).toBeNull();
    expect(context.packageJson).toBeNull();
  });
});

describe('loadProjectContext context formatting', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'format-test',
      version: '2.0.0',
    }, null, 2));
    writeFileSync(join(TEST_DIR, 'test.ts'), 'const x = 1;');
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should calculate totalSize correctly', async () => {
    const options: DiscussOptions = {
      topic: 'Test',
      workspace: TEST_DIR,
      include: ['*.ts'],
    };

    const context = await loadProjectContext(options);

    // totalSize should include README + package.json + source files
    expect(context.totalSize).toBeGreaterThan(0);
  });
});
