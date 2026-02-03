/**
 * Protocol Encoder/Decoder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  AICPEncoder, 
  ShorthandParser, 
  MessageCompressor,
  PROTOCOL_VERSION,
  HEADER_SIZE,
  BROADCAST_RECIPIENT,
} from './encoder.js';
import { MessageType, MessageFlags } from './types.js';

describe('AICPEncoder', () => {
  const testSender = '11111111-1111-1111-1111-111111111111';
  const testRecipient = '22222222-2222-2222-2222-222222222222';

  describe('encode/decode', () => {
    it('should encode and decode a simple message', () => {
      const message = AICPEncoder.createMessage(
        MessageType.PING,
        testSender,
        testRecipient,
        { data: 'hello' },
      );

      const encoded = AICPEncoder.encode(message);
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(HEADER_SIZE);

      const decoded = AICPEncoder.decode<{ data: string }>(encoded);
      expect(decoded.header.version).toBe(PROTOCOL_VERSION);
      expect(decoded.header.type).toBe(MessageType.PING);
      expect(decoded.header.sender).toBe(testSender);
      expect(decoded.header.recipient).toBe(testRecipient);
      expect(decoded.payload.data).toBe('hello');
    });

    it('should handle complex payloads', () => {
      const complexPayload = {
        taskId: 'task-123',
        description: 'Test task with complex data',
        metadata: {
          nested: {
            array: [1, 2, 3],
            bool: true,
            null: null,
          },
        },
        priority: 2,
      };

      const message = AICPEncoder.createMessage(
        MessageType.TASK_ASSIGN,
        testSender,
        testRecipient,
        complexPayload,
      );

      const encoded = AICPEncoder.encode(message);
      const decoded = AICPEncoder.decode<typeof complexPayload>(encoded);

      expect(decoded.payload.taskId).toBe('task-123');
      expect(decoded.payload.metadata.nested.array).toEqual([1, 2, 3]);
      expect(decoded.payload.metadata.nested.bool).toBe(true);
    });

    it('should throw on truncated message', () => {
      const message = AICPEncoder.createMessage(
        MessageType.PING,
        testSender,
        testRecipient,
        { data: 'test' },
      );

      const encoded = AICPEncoder.encode(message);
      const truncated = encoded.slice(0, HEADER_SIZE - 1);

      expect(() => AICPEncoder.decode(truncated)).toThrow('too short');
    });

    it('should throw on wrong protocol version', () => {
      const message = AICPEncoder.createMessage(
        MessageType.PING,
        testSender,
        testRecipient,
        { data: 'test' },
      );

      const encoded = AICPEncoder.encode(message);
      encoded[0] = 99; // Wrong version

      expect(() => AICPEncoder.decode(encoded)).toThrow('Unsupported protocol version');
    });
  });

  describe('createMessage', () => {
    it('should create message with default flags', () => {
      const message = AICPEncoder.createMessage(
        MessageType.PONG,
        testSender,
        testRecipient,
        {},
      );

      expect(message.header.flags).toBe(MessageFlags.NONE);
      expect(message.header.correlationId).toBeDefined();
      expect(message.header.correlationId.length).toBe(36); // UUID format
    });

    it('should create message with custom flags', () => {
      const message = AICPEncoder.createMessage(
        MessageType.SEC_ALERT,
        testSender,
        testRecipient,
        { alert: 'critical' },
        MessageFlags.URGENT | MessageFlags.REQUIRES_ACK,
      );

      expect(message.header.flags).toBe(MessageFlags.URGENT | MessageFlags.REQUIRES_ACK);
    });

    it('should use provided correlation ID', () => {
      const correlationId = '33333333-3333-3333-3333-333333333333';
      const message = AICPEncoder.createMessage(
        MessageType.ACK,
        testSender,
        testRecipient,
        {},
        MessageFlags.NONE,
        correlationId,
      );

      expect(message.header.correlationId).toBe(correlationId);
    });
  });

  describe('createBroadcast', () => {
    it('should create broadcast message', () => {
      const message = AICPEncoder.createBroadcast(
        MessageType.SYS_STATUS,
        testSender,
        { status: 'online' },
      );

      expect(message.header.recipient).toBe(BROADCAST_RECIPIENT);
      expect(message.header.flags & MessageFlags.BROADCAST).toBeTruthy();
    });
  });
});

describe('ShorthandParser', () => {
  describe('parse', () => {
    it('should parse basic shorthand message', () => {
      const result = ShorthandParser.parse('@ARCH>CODER:TASK:impl_oauth');
      
      expect(result).not.toBeNull();
      expect(result!.sender).toBe('architect');
      expect(result!.recipient).toBe('coder');
      expect(result!.type).toBe('task_assign');
      expect(result!.data).toBe('impl_oauth');
    });

    it('should parse message with params', () => {
      const result = ShorthandParser.parse('@SEC>*:TASK:review:P1:ETA=2h');
      
      expect(result).not.toBeNull();
      expect(result!.sender).toBe('security');
      expect(result!.recipient).toBe('broadcast');
      expect(result!.params['P1']).toBe('true');
      expect(result!.params['ETA']).toBe('2h');
    });

    it('should return null for invalid format', () => {
      expect(ShorthandParser.parse('invalid')).toBeNull();
      expect(ShorthandParser.parse('@')).toBeNull();
      expect(ShorthandParser.parse('@ARCH')).toBeNull();
      expect(ShorthandParser.parse('ARCH>CODER:TASK:data')).toBeNull();
    });
  });

  describe('format', () => {
    it('should format shorthand message', () => {
      const result = ShorthandParser.format({
        sender: 'orchestrator',
        recipient: 'coder',
        type: 'task_assign',
        data: 'impl_oauth',
        params: {},
      });

      expect(result).toBe('@ORCH>CODE:TASK:impl_oauth');
    });

    it('should format with params', () => {
      const result = ShorthandParser.format({
        sender: 'security',
        recipient: 'broadcast',
        type: 'sec_alert',
        data: 'CVE-2026-1234',
        params: { CRIT: 'true', notify: 'all' },
      });

      expect(result).toContain('@SEC>*');
      expect(result).toContain('CVE-2026-1234');
      expect(result).toContain('CRIT');
      expect(result).toContain('notify=all');
    });
  });

  describe('expand/compress', () => {
    it('should expand abbreviations', () => {
      expect(ShorthandParser.expand('ARCH')).toBe('architect');
      expect(ShorthandParser.expand('ORCH')).toBe('orchestrator');
      expect(ShorthandParser.expand('TASK')).toBe('task_assign');
      expect(ShorthandParser.expand('P0')).toBe('critical');
    });

    it('should compress full terms', () => {
      expect(ShorthandParser.compress('architect')).toBe('ARCH');
      expect(ShorthandParser.compress('orchestrator')).toBe('ORCH');
      expect(ShorthandParser.compress('task_assign')).toBe('TASK');
    });

    it('should handle unknown terms', () => {
      expect(ShorthandParser.expand('UNKNOWN')).toBe('unknown');
      expect(ShorthandParser.compress('verylongterm')).toBe('VERY');
    });
  });

  describe('toMessage', () => {
    it('should convert shorthand to full message', () => {
      const shorthand = ShorthandParser.parse('@ARCH>CODER:TASK:impl_oauth:P1');
      expect(shorthand).not.toBeNull();

      const message = ShorthandParser.toMessage(
        shorthand!,
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
      );

      expect(message.header.type).toBe(MessageType.TASK_ASSIGN);
      expect(message.payload['data']).toBe('impl_oauth');
      expect(message.payload['P1']).toBe('true');
    });

    it('should set broadcast flag for wildcard recipient', () => {
      const shorthand = ShorthandParser.parse('@SEC>*:DONE:audit_complete');
      expect(shorthand).not.toBeNull();

      const message = ShorthandParser.toMessage(
        shorthand!,
        '11111111-1111-1111-1111-111111111111',
        BROADCAST_RECIPIENT,
      );

      expect(message.header.flags & MessageFlags.BROADCAST).toBeTruthy();
    });
  });
});

describe('MessageCompressor', () => {
  let compressor: MessageCompressor;

  beforeEach(() => {
    compressor = new MessageCompressor();
  });

  describe('compress/decompress', () => {
    it('should compress and decompress text', () => {
      const original = 'hello world hello';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should reuse dictionary entries', () => {
      const text1 = 'hello world';
      const text2 = 'hello there';
      
      compressor.compress(text1);
      const compressed2 = compressor.compress(text2);
      const decompressed2 = compressor.decompress(compressed2);

      expect(decompressed2).toBe(text2);
    });

    it('should handle single word', () => {
      const original = 'single';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });
  });

  describe('exportDictionary/importDictionary', () => {
    it('should export and import dictionary', () => {
      compressor.compress('test words for dictionary');
      const exported = compressor.exportDictionary();

      const newCompressor = new MessageCompressor();
      newCompressor.importDictionary(exported);

      const text = 'test words';
      const compressed = newCompressor.compress(text);
      const decompressed = newCompressor.decompress(compressed);

      expect(decompressed).toBe(text);
    });
  });
});
