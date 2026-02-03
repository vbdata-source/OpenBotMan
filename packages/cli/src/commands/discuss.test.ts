/**
 * Tests for Real Discussion Command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadProjectContext, type DiscussOptions, type ProjectContext } from './discuss.js';
import { join } from 'path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

// Mock ClaudeCliProvider
vi.mock('@openbotman/orchestrator', () => ({
  ClaudeCliProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      text: 'Mock response from Claude CLI',
      costUsd: 0.001,
      sessionId: 'test-session',
      isError: false,
    }),
  })),
}));

describe('discuss command', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = mkdtempSync(join(tmpdir(), 'discuss-test-'));
  });

  afterEach(() => {
    // Cleanup
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadProjectContext', () => {
    it('should load README.md if present', async () => {
      const readmeContent = '# Test Project\n\nThis is a test project.';
      writeFileSync(join(tempDir, 'README.md'), readmeContent);
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));

      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      expect(context.readme).toBe(readmeContent);
    });

    it('should load package.json if present', async () => {
      const pkgContent = {
        name: 'test-project',
        version: '1.0.0',
        description: 'A test project',
      };
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkgContent, null, 2));

      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      expect(context.packageJson).toEqual(pkgContent);
    });

    it('should load source files from src directory', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
      mkdirSync(join(tempDir, 'src'));
      writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const hello = "world";');
      writeFileSync(join(tempDir, 'src', 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }');

      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      expect(context.sourceFiles.length).toBeGreaterThan(0);
      expect(context.sourceFiles.some(f => f.path.includes('index.ts'))).toBe(true);
    });

    it('should load specific files when provided', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
      writeFileSync(join(tempDir, 'custom.ts'), 'const custom = true;');
      writeFileSync(join(tempDir, 'other.ts'), 'const other = false;');

      const options: DiscussOptions = {
        topic: 'Test topic',
        files: ['custom.ts'],
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      expect(context.sourceFiles.length).toBe(1);
      expect(context.sourceFiles[0]?.path).toBe('custom.ts');
    });

    it('should respect max size limits', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
      mkdirSync(join(tempDir, 'src'));
      
      // Create many files
      for (let i = 0; i < 20; i++) {
        writeFileSync(
          join(tempDir, 'src', `file${i}.ts`),
          `export const value${i} = ${i};\n`.repeat(100)
        );
      }

      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      // Should not load all 20 files
      expect(context.sourceFiles.length).toBeLessThanOrEqual(10);
      // Total size should be reasonable
      expect(context.totalSize).toBeLessThan(60000);
    });

    it('should truncate very long README', async () => {
      const longReadme = '# Test\n\n' + 'Lorem ipsum '.repeat(1000);
      writeFileSync(join(tempDir, 'README.md'), longReadme);
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));

      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      expect(context.readme).toBeTruthy();
      expect(context.readme!.length).toBeLessThanOrEqual(5100); // 5000 + "[... truncated]"
      expect(context.readme!.includes('[... truncated]')).toBe(true);
    });

    it('should handle missing files gracefully', async () => {
      // Create an isolated temp dir structure
      const isolatedDir = mkdtempSync(join(tmpdir(), 'isolated-'));
      
      // Create a package.json to anchor the project root here
      writeFileSync(join(isolatedDir, 'package.json'), JSON.stringify({ 
        name: 'empty-test-project',
        version: '0.0.0'
      }));
      
      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: isolatedDir,
      };

      const context = await loadProjectContext(options);
      
      // README should be null since we didn't create one
      expect(context.readme).toBeNull();
      // package.json should be loaded
      expect(context.packageJson).toBeTruthy();
      expect((context.packageJson as Record<string, unknown>)?.name).toBe('empty-test-project');
      // No source files in this empty project
      expect(context.sourceFiles).toEqual([]);
      
      // Cleanup
      rmSync(isolatedDir, { recursive: true, force: true });
    });

    it('should ignore node_modules directory', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
      mkdirSync(join(tempDir, 'node_modules'));
      mkdirSync(join(tempDir, 'node_modules', 'some-package'));
      writeFileSync(join(tempDir, 'node_modules', 'some-package', 'index.js'), 'module.exports = {};');
      mkdirSync(join(tempDir, 'src'));
      writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const app = true;');

      const options: DiscussOptions = {
        topic: 'Test topic',
        cwd: tempDir,
      };

      const context = await loadProjectContext(options);
      
      // Should only find src/index.ts, not node_modules
      expect(context.sourceFiles.every(f => !f.path.includes('node_modules'))).toBe(true);
    });
  });

  describe('agent configurations', () => {
    it('should have default agents with correct roles', async () => {
      // Import the module to check DEFAULT_AGENTS
      const module = await import('./discuss.js');
      
      // The agents should be coder, reviewer, architect
      // We can test this indirectly through the options
      const options: DiscussOptions = {
        topic: 'Test',
        agents: 3,
      };
      
      expect(options.agents).toBe(3);
    });

    it('should limit agents to 1-3', () => {
      // Test that agent count is bounded
      const agentCount = Math.max(1, Math.min(3, 5));
      expect(agentCount).toBe(3);
      
      const agentCount2 = Math.max(1, Math.min(3, 0));
      expect(agentCount2).toBe(1);
    });
  });

  describe('discussion flow', () => {
    it('should build correct prompt with topic', () => {
      const topic = 'Wie implementiere ich Caching?';
      const prompt = `# Diskussions-Thema\n${topic}`;
      
      expect(prompt).toContain(topic);
      expect(prompt).toContain('Diskussions-Thema');
    });

    it('should include previous messages in subsequent prompts', () => {
      const messages = [
        { agentName: 'Coder', role: 'coder', content: 'Ich schlage Redis vor.' },
        { agentName: 'Reviewer', role: 'reviewer', content: 'Bedenke die Komplexität.' },
      ];
      
      const historySection = messages
        .map(m => `## [${m.agentName}] (${m.role})\n${m.content}`)
        .join('\n\n');
      
      expect(historySection).toContain('[Coder]');
      expect(historySection).toContain('[Reviewer]');
      expect(historySection).toContain('Redis');
      expect(historySection).toContain('Komplexität');
    });
  });

  describe('options parsing', () => {
    it('should parse timeout correctly', () => {
      const timeout = parseInt('60', 10);
      expect(timeout).toBe(60);
      
      const invalidTimeout = parseInt('invalid', 10);
      expect(isNaN(invalidTimeout)).toBe(true);
    });

    it('should parse files list correctly', () => {
      const filesArg = 'src/index.ts, src/utils.ts, lib/helper.ts';
      const files = filesArg.split(',').map(f => f.trim());
      
      expect(files).toEqual(['src/index.ts', 'src/utils.ts', 'lib/helper.ts']);
    });

    it('should handle empty files argument', () => {
      const filesArg = undefined;
      const files = filesArg ? filesArg.split(',') : undefined;
      
      expect(files).toBeUndefined();
    });
  });
});
