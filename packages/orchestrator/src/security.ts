/**
 * Security Module
 * 
 * Handles authentication, authorization, and audit logging.
 * Provides secure communication between agents and channels.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Enable security features */
  enabled: boolean;
  
  /** Secret key for signing */
  secretKey: string;
  
  /** JWT settings */
  jwt: {
    /** Token expiry in seconds */
    expiresIn: number;
    /** Refresh token expiry */
    refreshExpiresIn: number;
    /** Issuer */
    issuer: string;
  };
  
  /** Rate limiting */
  rateLimit: {
    /** Max requests per window */
    maxRequests: number;
    /** Window size in seconds */
    windowSeconds: number;
  };
  
  /** Audit settings */
  audit: {
    /** Enable audit logging */
    enabled: boolean;
    /** Log level */
    level: 'minimal' | 'normal' | 'verbose';
    /** Retention days */
    retentionDays: number;
  };
  
  /** Allowed origins for CORS */
  allowedOrigins: string[];
  
  /** IP allowlist (empty = all allowed) */
  ipAllowlist: string[];
}

/**
 * User/Agent identity
 */
export interface Identity {
  id: string;
  type: 'user' | 'agent' | 'service';
  name: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  lastActive?: Date;
}

/**
 * Session
 */
export interface Session {
  id: string;
  identityId: string;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActive: Date;
  ip?: string;
  userAgent?: string;
}

/**
 * Audit log entry
 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  identityId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure' | 'denied';
  ip?: string;
  duration?: number;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Security events
 */
export interface SecurityEvents {
  'auth:login': (identity: Identity, session: Session) => void;
  'auth:logout': (sessionId: string) => void;
  'auth:failed': (reason: string, ip?: string) => void;
  'access:denied': (identityId: string, action: string, resource?: string) => void;
  'audit:entry': (entry: AuditEntry) => void;
  'rate:exceeded': (identityId: string, ip?: string) => void;
}

/**
 * Default permissions by role
 */
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  user: [
    'chat:send',
    'chat:receive',
    'task:view',
    'task:create',
    'knowledge:read',
  ],
  agent: [
    'task:execute',
    'task:update',
    'knowledge:read',
    'knowledge:write',
    'discussion:participate',
  ],
  orchestrator: [
    'agent:invoke',
    'task:*',
    'knowledge:*',
    'discussion:*',
    'workflow:*',
  ],
  viewer: [
    'chat:receive',
    'task:view',
    'knowledge:read',
  ],
};

/**
 * Security Manager
 */
export class SecurityManager extends EventEmitter<SecurityEvents> {
  private config: SecurityConfig;
  private identities: Map<string, Identity> = new Map();
  private sessions: Map<string, Session> = new Map();
  private auditLog: AuditEntry[] = [];
  private rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();
  
  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      secretKey: config.secretKey ?? this.generateSecretKey(),
      jwt: {
        expiresIn: 3600, // 1 hour
        refreshExpiresIn: 604800, // 7 days
        issuer: 'openbotman',
        ...config.jwt,
      },
      rateLimit: {
        maxRequests: 100,
        windowSeconds: 60,
        ...config.rateLimit,
      },
      audit: {
        enabled: true,
        level: 'normal',
        retentionDays: 90,
        ...config.audit,
      },
      allowedOrigins: config.allowedOrigins ?? ['*'],
      ipAllowlist: config.ipAllowlist ?? [],
    };
  }
  
  /**
   * Generate a secure secret key
   */
  private generateSecretKey(): string {
    return randomBytes(32).toString('hex');
  }
  
  /**
   * Create a new identity
   */
  createIdentity(
    type: Identity['type'],
    name: string,
    roles: string[] = [],
    metadata?: Record<string, unknown>
  ): Identity {
    const identity: Identity = {
      id: uuidv4(),
      type,
      name,
      roles,
      permissions: this.computePermissions(roles),
      metadata,
      createdAt: new Date(),
    };
    
    this.identities.set(identity.id, identity);
    return identity;
  }
  
  /**
   * Compute permissions from roles
   */
  private computePermissions(roles: string[]): string[] {
    const permissions = new Set<string>();
    
    for (const role of roles) {
      const rolePerms = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }
    
    return Array.from(permissions);
  }
  
  /**
   * Create a session for an identity
   */
  createSession(identityId: string, ip?: string, userAgent?: string): Session | null {
    const identity = this.identities.get(identityId);
    if (!identity) return null;
    
    const now = new Date();
    const session: Session = {
      id: uuidv4(),
      identityId,
      token: this.generateToken(identity),
      refreshToken: this.generateRefreshToken(identity),
      expiresAt: new Date(now.getTime() + this.config.jwt.expiresIn * 1000),
      createdAt: now,
      lastActive: now,
      ip,
      userAgent,
    };
    
    this.sessions.set(session.id, session);
    identity.lastActive = now;
    
    this.emit('auth:login', identity, session);
    this.audit(identityId, 'auth:login', 'session', session.id, { ip }, 'success');
    
    return session;
  }
  
  /**
   * Generate an auth token
   */
  private generateToken(identity: Identity): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: identity.id,
      name: identity.name,
      type: identity.type,
      roles: identity.roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwt.expiresIn,
      iss: this.config.jwt.issuer,
    };
    
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = createHmac('sha256', this.config.secretKey)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    
    return `${headerB64}.${payloadB64}.${signature}`;
  }
  
  /**
   * Generate a refresh token
   */
  private generateRefreshToken(identity: Identity): string {
    const payload = {
      sub: identity.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwt.refreshExpiresIn,
    };
    
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.config.secretKey)
      .update(payloadB64)
      .digest('base64url');
    
    return `${payloadB64}.${signature}`;
  }
  
  /**
   * Verify a token
   */
  verifyToken(token: string): Identity | null {
    try {
      const parts = token.split('.');
      const headerB64 = parts[0];
      const payloadB64 = parts[1];
      const signature = parts[2];
      
      if (!headerB64 || !payloadB64 || !signature) {
        return null;
      }
      
      // Verify signature
      const expectedSig = createHmac('sha256', this.config.secretKey)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');
      
      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }
      
      // Parse payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      
      // Check expiry
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      
      return this.identities.get(payload.sub) ?? null;
    } catch {
      return null;
    }
  }
  
  /**
   * Invalidate a session
   */
  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('auth:logout', sessionId);
      this.audit(session.identityId, 'auth:logout', 'session', sessionId, {}, 'success');
    }
  }
  
  /**
   * Check if identity has permission
   */
  checkPermission(identityId: string, action: string, resource?: string): PermissionResult {
    const identity = this.identities.get(identityId);
    if (!identity) {
      return { allowed: false, reason: 'Identity not found' };
    }
    
    // Admin has all permissions
    if (identity.permissions.includes('*')) {
      return { allowed: true };
    }
    
    // Check exact permission
    if (identity.permissions.includes(action)) {
      return { allowed: true };
    }
    
    // Check wildcard permissions
    const [category] = action.split(':');
    if (identity.permissions.includes(`${category}:*`)) {
      return { allowed: true };
    }
    
    this.emit('access:denied', identityId, action, resource);
    return { allowed: false, reason: `Permission denied: ${action}` };
  }
  
  /**
   * Check rate limit
   */
  checkRateLimit(key: string): boolean {
    const now = Date.now();
    const counter = this.rateLimitCounters.get(key);
    
    if (!counter || counter.resetAt < now) {
      this.rateLimitCounters.set(key, {
        count: 1,
        resetAt: now + this.config.rateLimit.windowSeconds * 1000,
      });
      return true;
    }
    
    if (counter.count >= this.config.rateLimit.maxRequests) {
      this.emit('rate:exceeded', key);
      return false;
    }
    
    counter.count++;
    return true;
  }
  
  /**
   * Validate origin
   */
  validateOrigin(origin: string): boolean {
    if (this.config.allowedOrigins.includes('*')) {
      return true;
    }
    return this.config.allowedOrigins.includes(origin);
  }
  
  /**
   * Validate IP
   */
  validateIP(ip: string): boolean {
    if (this.config.ipAllowlist.length === 0) {
      return true;
    }
    return this.config.ipAllowlist.includes(ip);
  }
  
  /**
   * Add audit log entry
   */
  audit(
    identityId: string,
    action: string,
    resource?: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    result: AuditEntry['result'] = 'success'
  ): void {
    if (!this.config.audit.enabled) return;
    
    const entry: AuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      identityId,
      action,
      resource,
      resourceId,
      details,
      result,
    };
    
    this.auditLog.push(entry);
    this.emit('audit:entry', entry);
    
    // Cleanup old entries
    this.cleanupAuditLog();
  }
  
  /**
   * Cleanup old audit entries
   */
  private cleanupAuditLog(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.audit.retentionDays);
    
    this.auditLog = this.auditLog.filter(e => e.timestamp >= cutoff);
  }
  
  /**
   * Get audit log
   */
  getAuditLog(options?: {
    identityId?: string;
    action?: string;
    since?: Date;
    limit?: number;
  }): AuditEntry[] {
    let entries = [...this.auditLog];
    
    if (options?.identityId) {
      entries = entries.filter(e => e.identityId === options.identityId);
    }
    if (options?.action) {
      entries = entries.filter(e => e.action.startsWith(options.action!));
    }
    if (options?.since) {
      entries = entries.filter(e => e.timestamp >= options.since!);
    }
    
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }
    
    return entries;
  }
  
  /**
   * Hash sensitive data
   */
  hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Encrypt data (simple XOR for demo - use proper encryption in production)
   */
  encrypt(data: string): string {
    // In production, use proper encryption like AES-256-GCM
    const key = this.config.secretKey;
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return Buffer.from(result).toString('base64');
  }
  
  /**
   * Decrypt data
   */
  decrypt(encrypted: string): string {
    const key = this.config.secretKey;
    const data = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  }
  
  /**
   * Get identity by ID
   */
  getIdentity(id: string): Identity | undefined {
    return this.identities.get(id);
  }
  
  /**
   * Get session by ID
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }
  
  /**
   * Get active sessions for identity
   */
  getSessionsForIdentity(identityId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.identityId === identityId);
  }
  
  /**
   * Revoke all sessions for identity
   */
  revokeAllSessions(identityId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.identityId === identityId) {
        this.invalidateSession(id);
      }
    }
  }
}
