/**
 * Audit Logger for Tool Calls
 *
 * Logs every tool execution with timestamp, agent, tool, parameters,
 * result, and duration. Security requirement from Phase 1.
 *
 * Entries are kept in memory and optionally written to a JSONL file.
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import type { ToolResult } from '@openbotman/protocol';

/**
 * A single audit log entry.
 */
export interface AuditEntry {
  timestamp: string;
  agentId: string;
  agentName: string;
  toolName: string;
  params: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
  jobId?: string;
}

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private logFilePath: string | null;
  private maxMemoryEntries: number;

  /**
   * @param logDir - Directory for JSONL log files. Pass null to disable file logging.
   * @param maxMemoryEntries - Max entries kept in memory (oldest evicted). Default: 1000.
   */
  constructor(logDir: string | null = null, maxMemoryEntries = 1000) {
    this.maxMemoryEntries = maxMemoryEntries;

    if (logDir) {
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      const date = new Date().toISOString().split('T')[0];
      this.logFilePath = join(logDir, `audit-${date}.jsonl`);
    } else {
      this.logFilePath = null;
    }
  }

  /**
   * Log a tool execution.
   */
  log(entry: AuditEntry): void {
    this.entries.push(entry);

    // Evict oldest if over limit
    if (this.entries.length > this.maxMemoryEntries) {
      this.entries.shift();
    }

    // Append to file
    if (this.logFilePath) {
      try {
        appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n', 'utf-8');
      } catch {
        // Silent fail - audit logging should not crash the system
      }
    }
  }

  /**
   * Create an audit entry and log it. Convenience wrapper.
   */
  logToolCall(
    agentId: string,
    agentName: string,
    toolName: string,
    params: Record<string, unknown>,
    result: ToolResult,
    durationMs: number,
    jobId?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      agentId,
      agentName,
      toolName,
      params,
      result,
      durationMs,
      jobId,
    });
  }

  /**
   * Get entries, optionally filtered.
   */
  getEntries(filter?: {
    agentId?: string;
    toolName?: string;
    jobId?: string;
    since?: Date;
  }): AuditEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter(entry => {
      if (filter.agentId && entry.agentId !== filter.agentId) return false;
      if (filter.toolName && entry.toolName !== filter.toolName) return false;
      if (filter.jobId && entry.jobId !== filter.jobId) return false;
      if (filter.since && new Date(entry.timestamp) < filter.since) return false;
      return true;
    });
  }

  /**
   * Number of entries in memory.
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Clear all in-memory entries.
   */
  clear(): void {
    this.entries = [];
  }
}
