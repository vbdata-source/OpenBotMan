/**
 * AICP Message Encoder/Decoder
 * 
 * Handles binary serialization and deserialization of protocol messages.
 * Uses MessagePack for efficient payload encoding.
 */

import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  MessageHeader,
  MessageType,
  MessageFlags,
  ShorthandMessage,
  COMPRESSION_DICTIONARY,
} from './types.js';

/** Current protocol version */
export const PROTOCOL_VERSION = 1;

/** Header size in bytes */
export const HEADER_SIZE = 56;

/** Broadcast recipient UUID */
export const BROADCAST_RECIPIENT = '00000000-0000-0000-0000-000000000000';

/**
 * Encode a UUID string to 16 bytes
 */
function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Decode 16 bytes to UUID string
 */
function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * AICP Message Encoder
 */
export class AICPEncoder {
  /**
   * Encode a message to binary format
   */
  static encode<T>(message: Message<T>): Uint8Array {
    // Encode payload with MessagePack
    const payloadBytes = msgpackEncode(message.payload);
    
    // Create header
    const header = new ArrayBuffer(HEADER_SIZE);
    const view = new DataView(header);
    
    // Version (1 byte)
    view.setUint8(0, message.header.version);
    
    // Type (1 byte)
    view.setUint8(1, message.header.type);
    
    // Flags (2 bytes)
    view.setUint16(2, message.header.flags, false); // big-endian
    
    // Payload length (4 bytes)
    view.setUint32(4, payloadBytes.length, false);
    
    // Sender UUID (16 bytes)
    const senderBytes = uuidToBytes(message.header.sender);
    new Uint8Array(header, 8, 16).set(senderBytes);
    
    // Recipient UUID (16 bytes)
    const recipientBytes = uuidToBytes(message.header.recipient);
    new Uint8Array(header, 24, 16).set(recipientBytes);
    
    // Correlation ID (16 bytes)
    const correlationBytes = uuidToBytes(message.header.correlationId);
    new Uint8Array(header, 40, 16).set(correlationBytes);
    
    // Combine header and payload
    const result = new Uint8Array(HEADER_SIZE + payloadBytes.length);
    result.set(new Uint8Array(header), 0);
    result.set(payloadBytes, HEADER_SIZE);
    
    return result;
  }
  
  /**
   * Decode a binary message
   */
  static decode<T>(data: Uint8Array): Message<T> {
    if (data.length < HEADER_SIZE) {
      throw new Error(`Invalid message: too short (${data.length} < ${HEADER_SIZE})`);
    }
    
    const view = new DataView(data.buffer, data.byteOffset, HEADER_SIZE);
    
    // Parse header
    const header: MessageHeader = {
      version: view.getUint8(0),
      type: view.getUint8(1) as MessageType,
      flags: view.getUint16(2, false),
      length: view.getUint32(4, false),
      sender: bytesToUuid(data.slice(8, 24)),
      recipient: bytesToUuid(data.slice(24, 40)),
      correlationId: bytesToUuid(data.slice(40, 56)),
    };
    
    // Validate version
    if (header.version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported protocol version: ${header.version}`);
    }
    
    // Validate length
    if (data.length < HEADER_SIZE + header.length) {
      throw new Error(`Invalid message: payload truncated`);
    }
    
    // Decode payload
    const payloadBytes = data.slice(HEADER_SIZE, HEADER_SIZE + header.length);
    const payload = msgpackDecode(payloadBytes) as T;
    
    return {
      header,
      payload,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Create a new message with auto-generated IDs
   */
  static createMessage<T>(
    type: MessageType,
    sender: string,
    recipient: string,
    payload: T,
    flags: number = MessageFlags.NONE,
    correlationId?: string
  ): Message<T> {
    return {
      header: {
        version: PROTOCOL_VERSION,
        type,
        flags,
        length: 0, // Will be set during encoding
        sender,
        recipient,
        correlationId: correlationId ?? uuidv4(),
      },
      payload,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Create a broadcast message
   */
  static createBroadcast<T>(
    type: MessageType,
    sender: string,
    payload: T,
    flags: number = MessageFlags.BROADCAST
  ): Message<T> {
    return this.createMessage(
      type,
      sender,
      BROADCAST_RECIPIENT,
      payload,
      flags | MessageFlags.BROADCAST
    );
  }
}

/**
 * Shorthand notation parser/formatter
 * 
 * Format: @SENDER>RECIPIENT:TYPE:DATA:KEY=VALUE:KEY2=VALUE2
 * Examples:
 *   @ARCH>CODER:TASK:impl_oauth:P1:ETA=2h
 *   @SEC>*:ALERT:CVE-2026-1234:CRIT
 *   @CODER>ARCH:DONE:oauth_routes:tests=42
 */
export class ShorthandParser {
  private static readonly PATTERN = /^@(\w+)>(\w+|\*):(\w+):([^:]+)(?::(.+))?$/;
  
  /**
   * Parse a shorthand message
   */
  static parse(input: string): ShorthandMessage | null {
    const match = input.match(this.PATTERN);
    if (!match) return null;
    
    const [, sender, recipient, type, data, paramsStr] = match;
    
    // Parse params
    const params: Record<string, string> = {};
    if (paramsStr) {
      for (const part of paramsStr.split(':')) {
        if (part.includes('=')) {
          const [key, value] = part.split('=', 2);
          params[key] = value;
        } else {
          // Priority or status shorthand
          params[part] = 'true';
        }
      }
    }
    
    return {
      sender: this.expand(sender),
      recipient: recipient === '*' ? 'broadcast' : this.expand(recipient),
      type: this.expand(type),
      data,
      params,
    };
  }
  
  /**
   * Format a message to shorthand
   */
  static format(msg: ShorthandMessage): string {
    const sender = this.compress(msg.sender);
    const recipient = msg.recipient === 'broadcast' ? '*' : this.compress(msg.recipient);
    const type = this.compress(msg.type);
    
    let result = `@${sender}>${recipient}:${type}:${msg.data}`;
    
    // Add params
    const paramParts: string[] = [];
    for (const [key, value] of Object.entries(msg.params)) {
      if (value === 'true') {
        paramParts.push(key);
      } else {
        paramParts.push(`${key}=${value}`);
      }
    }
    if (paramParts.length > 0) {
      result += ':' + paramParts.join(':');
    }
    
    return result;
  }
  
  /**
   * Expand a compressed term
   */
  static expand(term: string): string {
    return COMPRESSION_DICTIONARY[term.toUpperCase()] ?? term.toLowerCase();
  }
  
  /**
   * Compress a term
   */
  static compress(term: string): string {
    const upper = term.toUpperCase();
    for (const [short, full] of Object.entries(COMPRESSION_DICTIONARY)) {
      if (full === term.toLowerCase()) {
        return short;
      }
    }
    return upper.slice(0, 4);
  }
  
  /**
   * Convert shorthand to full message
   */
  static toMessage<T extends Record<string, unknown>>(
    shorthand: ShorthandMessage,
    senderUuid: string,
    recipientUuid: string,
    additionalPayload?: Partial<T>
  ): Message<T> {
    const typeMap: Record<string, MessageType> = {
      'task_assign': MessageType.TASK_ASSIGN,
      'task_complete': MessageType.TASK_COMPLETE,
      'task_failed': MessageType.TASK_FAILED,
      'task_progress': MessageType.TASK_PROGRESS,
      'kb_query': MessageType.KB_QUERY,
      'kb_update': MessageType.KB_UPDATE,
      'discuss_start': MessageType.DISCUSS_START,
      'discuss_vote': MessageType.DISCUSS_VOTE,
      'discuss_consensus': MessageType.DISCUSS_CONSENSUS,
      'sec_alert': MessageType.SEC_ALERT,
    };
    
    const msgType = typeMap[shorthand.type] ?? MessageType.SYS_LOG;
    
    return AICPEncoder.createMessage(
      msgType,
      senderUuid,
      recipientUuid,
      {
        ...shorthand.params,
        data: shorthand.data,
        ...additionalPayload,
      } as T,
      shorthand.recipient === 'broadcast' ? MessageFlags.BROADCAST : MessageFlags.NONE
    );
  }
}

/**
 * Message compression utilities
 */
export class MessageCompressor {
  private dictionary: Map<string, number> = new Map();
  private reverseDictionary: Map<number, string> = new Map();
  private nextId = 0;
  
  /**
   * Add a term to the dictionary
   */
  addTerm(term: string): number {
    if (this.dictionary.has(term)) {
      return this.dictionary.get(term)!;
    }
    
    const id = this.nextId++;
    this.dictionary.set(term, id);
    this.reverseDictionary.set(id, term);
    return id;
  }
  
  /**
   * Compress a string using dictionary encoding
   */
  compress(text: string): Uint8Array {
    const words = text.split(/\s+/);
    const encoded: number[] = [];
    
    for (const word of words) {
      if (this.dictionary.has(word)) {
        encoded.push(this.dictionary.get(word)!);
      } else {
        // Add new word to dictionary
        encoded.push(this.addTerm(word));
      }
    }
    
    // Variable-length encoding
    const result: number[] = [];
    for (const id of encoded) {
      if (id < 128) {
        result.push(id);
      } else if (id < 16384) {
        result.push(0x80 | (id >> 7));
        result.push(id & 0x7F);
      } else {
        result.push(0x80 | (id >> 14));
        result.push(0x80 | ((id >> 7) & 0x7F));
        result.push(id & 0x7F);
      }
    }
    
    return new Uint8Array(result);
  }
  
  /**
   * Decompress using dictionary
   */
  decompress(data: Uint8Array): string {
    const ids: number[] = [];
    let i = 0;
    
    while (i < data.length) {
      let id = 0;
      while (data[i] & 0x80) {
        id = (id << 7) | (data[i] & 0x7F);
        i++;
      }
      id = (id << 7) | data[i];
      ids.push(id);
      i++;
    }
    
    return ids
      .map(id => this.reverseDictionary.get(id) ?? `[${id}]`)
      .join(' ');
  }
  
  /**
   * Export dictionary for persistence
   */
  exportDictionary(): Record<string, number> {
    return Object.fromEntries(this.dictionary);
  }
  
  /**
   * Import dictionary
   */
  importDictionary(dict: Record<string, number>): void {
    this.dictionary.clear();
    this.reverseDictionary.clear();
    this.nextId = 0;
    
    for (const [term, id] of Object.entries(dict)) {
      this.dictionary.set(term, id);
      this.reverseDictionary.set(id, term);
      if (id >= this.nextId) {
        this.nextId = id + 1;
      }
    }
  }
}
