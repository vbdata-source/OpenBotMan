/**
 * Protocol Types Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  MessageType, 
  Priority, 
  AgentRole, 
  LLMProvider, 
  MessageFlags,
  COMPRESSION_DICTIONARY,
} from './types.js';

describe('MessageType', () => {
  it('should have correct core protocol values', () => {
    expect(MessageType.PING).toBe(0x01);
    expect(MessageType.PONG).toBe(0x02);
    expect(MessageType.ACK).toBe(0x03);
    expect(MessageType.NACK).toBe(0x04);
    expect(MessageType.HELLO).toBe(0x05);
    expect(MessageType.GOODBYE).toBe(0x06);
    expect(MessageType.ERROR).toBe(0x0F);
  });

  it('should have correct task management values', () => {
    expect(MessageType.TASK_ASSIGN).toBe(0x10);
    expect(MessageType.TASK_ACCEPT).toBe(0x11);
    expect(MessageType.TASK_REJECT).toBe(0x12);
    expect(MessageType.TASK_PROGRESS).toBe(0x13);
    expect(MessageType.TASK_COMPLETE).toBe(0x14);
    expect(MessageType.TASK_FAILED).toBe(0x15);
  });

  it('should have correct knowledge base values', () => {
    expect(MessageType.KB_QUERY).toBe(0x20);
    expect(MessageType.KB_RESULT).toBe(0x21);
    expect(MessageType.KB_UPDATE).toBe(0x22);
  });

  it('should have correct discussion values', () => {
    expect(MessageType.DISCUSS_START).toBe(0x30);
    expect(MessageType.DISCUSS_VOTE).toBe(0x36);
    expect(MessageType.DISCUSS_CONSENSUS).toBe(0x37);
  });

  it('should have correct system values', () => {
    expect(MessageType.SYS_STATUS).toBe(0xF0);
    expect(MessageType.SYS_SHUTDOWN).toBe(0xFE);
    expect(MessageType.SYS_RESTART).toBe(0xFF);
  });
});

describe('Priority', () => {
  it('should have correct ordering', () => {
    expect(Priority.LOW).toBe(0);
    expect(Priority.NORMAL).toBe(1);
    expect(Priority.HIGH).toBe(2);
    expect(Priority.URGENT).toBe(3);
    expect(Priority.CRITICAL).toBe(4);
  });

  it('should allow numerical comparison', () => {
    expect(Priority.CRITICAL > Priority.URGENT).toBe(true);
    expect(Priority.LOW < Priority.NORMAL).toBe(true);
    expect(Priority.HIGH >= Priority.HIGH).toBe(true);
  });
});

describe('AgentRole', () => {
  it('should have correct string values', () => {
    expect(AgentRole.ORCHESTRATOR).toBe('orchestrator');
    expect(AgentRole.ARCHITECT).toBe('architect');
    expect(AgentRole.CODER).toBe('coder');
    expect(AgentRole.REVIEWER).toBe('reviewer');
    expect(AgentRole.TESTER).toBe('tester');
    expect(AgentRole.SECURITY).toBe('security');
    expect(AgentRole.DEVOPS).toBe('devops');
    expect(AgentRole.DOCUMENTATION).toBe('documentation');
  });
});

describe('LLMProvider', () => {
  it('should have correct provider values', () => {
    expect(LLMProvider.ANTHROPIC).toBe('anthropic');
    expect(LLMProvider.OPENAI).toBe('openai');
    expect(LLMProvider.GOOGLE).toBe('google');
    expect(LLMProvider.OLLAMA).toBe('ollama');
    expect(LLMProvider.AZURE).toBe('azure');
    expect(LLMProvider.AWS).toBe('aws');
    expect(LLMProvider.CUSTOM).toBe('custom');
  });
});

describe('MessageFlags', () => {
  it('should have correct bitfield values', () => {
    expect(MessageFlags.NONE).toBe(0x0000);
    expect(MessageFlags.REQUIRES_ACK).toBe(0x0001);
    expect(MessageFlags.ENCRYPTED).toBe(0x0002);
    expect(MessageFlags.COMPRESSED).toBe(0x0004);
    expect(MessageFlags.SIGNED).toBe(0x0008);
    expect(MessageFlags.BROADCAST).toBe(0x0010);
    expect(MessageFlags.URGENT).toBe(0x0020);
  });

  it('should allow bitwise combination', () => {
    const combined = MessageFlags.REQUIRES_ACK | MessageFlags.URGENT | MessageFlags.ENCRYPTED;
    
    expect((combined & MessageFlags.REQUIRES_ACK) !== 0).toBe(true);
    expect((combined & MessageFlags.URGENT) !== 0).toBe(true);
    expect((combined & MessageFlags.ENCRYPTED) !== 0).toBe(true);
    expect((combined & MessageFlags.BROADCAST) !== 0).toBe(false);
  });

  it('should allow checking individual flags', () => {
    const flags = MessageFlags.BROADCAST | MessageFlags.FINAL;
    
    const hasFlag = (flags: number, flag: number) => (flags & flag) === flag;
    
    expect(hasFlag(flags, MessageFlags.BROADCAST)).toBe(true);
    expect(hasFlag(flags, MessageFlags.FINAL)).toBe(true);
    expect(hasFlag(flags, MessageFlags.SIGNED)).toBe(false);
  });
});

describe('COMPRESSION_DICTIONARY', () => {
  it('should have agent abbreviations', () => {
    expect(COMPRESSION_DICTIONARY['ORCH']).toBe('orchestrator');
    expect(COMPRESSION_DICTIONARY['ARCH']).toBe('architect');
    expect(COMPRESSION_DICTIONARY['CODE']).toBe('coder');
    expect(COMPRESSION_DICTIONARY['SEC']).toBe('security');
  });

  it('should have action abbreviations', () => {
    expect(COMPRESSION_DICTIONARY['TASK']).toBe('task_assign');
    expect(COMPRESSION_DICTIONARY['DONE']).toBe('task_complete');
    expect(COMPRESSION_DICTIONARY['FAIL']).toBe('task_failed');
    expect(COMPRESSION_DICTIONARY['QUERY']).toBe('kb_query');
  });

  it('should have priority abbreviations', () => {
    expect(COMPRESSION_DICTIONARY['P0']).toBe('critical');
    expect(COMPRESSION_DICTIONARY['P1']).toBe('urgent');
    expect(COMPRESSION_DICTIONARY['P2']).toBe('high');
    expect(COMPRESSION_DICTIONARY['P3']).toBe('normal');
    expect(COMPRESSION_DICTIONARY['P4']).toBe('low');
  });

  it('should not have duplicate keys', () => {
    const keys = Object.keys(COMPRESSION_DICTIONARY);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
});
