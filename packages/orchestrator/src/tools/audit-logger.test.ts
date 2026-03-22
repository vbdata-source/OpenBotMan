/**
 * AuditLogger Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuditLogger, type AuditEntry } from './audit-logger.js';

function createEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    agentId: 'agent-1',
    agentName: 'Test Agent',
    toolName: 'test_tool',
    params: { input: 'hello' },
    result: { success: true, output: 'done' },
    durationMs: 42,
    ...overrides,
  };
}

describe('AuditLogger', () => {
  describe('in-memory logging', () => {
    let logger: AuditLogger;

    beforeEach(() => {
      logger = new AuditLogger(null);
    });

    it('should log entries', () => {
      logger.log(createEntry());
      expect(logger.size).toBe(1);
    });

    it('should return all entries', () => {
      logger.log(createEntry({ toolName: 'tool_a' }));
      logger.log(createEntry({ toolName: 'tool_b' }));

      const entries = logger.getEntries();
      expect(entries).toHaveLength(2);
    });

    it('should filter by agentId', () => {
      logger.log(createEntry({ agentId: 'a' }));
      logger.log(createEntry({ agentId: 'b' }));
      logger.log(createEntry({ agentId: 'a' }));

      expect(logger.getEntries({ agentId: 'a' })).toHaveLength(2);
      expect(logger.getEntries({ agentId: 'b' })).toHaveLength(1);
    });

    it('should filter by toolName', () => {
      logger.log(createEntry({ toolName: 'jira_create' }));
      logger.log(createEntry({ toolName: 'fs_read' }));

      expect(logger.getEntries({ toolName: 'jira_create' })).toHaveLength(1);
    });

    it('should filter by jobId', () => {
      logger.log(createEntry({ jobId: 'job-1' }));
      logger.log(createEntry({ jobId: 'job-2' }));
      logger.log(createEntry());

      expect(logger.getEntries({ jobId: 'job-1' })).toHaveLength(1);
    });

    it('should filter by since date', () => {
      const old = createEntry({ timestamp: '2026-01-01T00:00:00Z' });
      const recent = createEntry({ timestamp: '2026-03-22T12:00:00Z' });

      logger.log(old);
      logger.log(recent);

      const since = new Date('2026-03-01T00:00:00Z');
      expect(logger.getEntries({ since })).toHaveLength(1);
    });

    it('should evict oldest entries when over limit', () => {
      const logger3 = new AuditLogger(null, 3);

      logger3.log(createEntry({ toolName: 'first' }));
      logger3.log(createEntry({ toolName: 'second' }));
      logger3.log(createEntry({ toolName: 'third' }));
      logger3.log(createEntry({ toolName: 'fourth' }));

      expect(logger3.size).toBe(3);
      const entries = logger3.getEntries();
      expect(entries[0]!.toolName).toBe('second');
      expect(entries[2]!.toolName).toBe('fourth');
    });

    it('should clear all entries', () => {
      logger.log(createEntry());
      logger.log(createEntry());

      logger.clear();
      expect(logger.size).toBe(0);
    });

    it('should log via convenience method', () => {
      logger.logToolCall(
        'agent-1', 'Agent One', 'my_tool',
        { key: 'value' },
        { success: true, output: 'ok' },
        100, 'job-1'
      );

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.agentId).toBe('agent-1');
      expect(entries[0]!.toolName).toBe('my_tool');
      expect(entries[0]!.durationMs).toBe(100);
      expect(entries[0]!.jobId).toBe('job-1');
    });
  });

  describe('file logging', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'audit-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should write entries to JSONL file', () => {
      const logger = new AuditLogger(tempDir);

      logger.log(createEntry({ toolName: 'file_tool_1' }));
      logger.log(createEntry({ toolName: 'file_tool_2' }));

      // Find the log file
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(tempDir, `audit-${date}.jsonl`);
      const content = readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);

      const parsed1 = JSON.parse(lines[0]!);
      expect(parsed1.toolName).toBe('file_tool_1');

      const parsed2 = JSON.parse(lines[1]!);
      expect(parsed2.toolName).toBe('file_tool_2');
    });

    it('should create log directory if it does not exist', () => {
      const nestedDir = join(tempDir, 'nested', 'audit');
      const logger = new AuditLogger(nestedDir);

      logger.log(createEntry());
      expect(logger.size).toBe(1);
    });
  });
});
