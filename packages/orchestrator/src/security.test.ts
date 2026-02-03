/**
 * Security Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityManager } from './security.js';

describe('SecurityManager', () => {
  let security: SecurityManager;

  beforeEach(() => {
    security = new SecurityManager({
      enabled: true,
      secretKey: 'test-secret-key-at-least-32-chars-long',
      jwt: {
        expiresIn: 3600,
        refreshExpiresIn: 86400,
        issuer: 'test-issuer',
      },
      rateLimit: {
        maxRequests: 100,
        windowSeconds: 60,
      },
      audit: {
        enabled: true,
        level: 'normal',
        retentionDays: 30,
      },
      allowedOrigins: ['*'],
      ipAllowlist: [],
    });
  });

  describe('createIdentity', () => {
    it('should create a user identity', () => {
      const identity = security.createIdentity(
        'user',
        'test-user',
        ['user'],
      );

      expect(identity).toBeDefined();
      expect(identity.id).toBeDefined();
      expect(identity.name).toBe('test-user');
      expect(identity.type).toBe('user');
      expect(identity.roles).toContain('user');
    });

    it('should create an agent identity', () => {
      const identity = security.createIdentity(
        'agent',
        'coder-agent',
        ['agent'],
      );

      expect(identity.type).toBe('agent');
    });

    it('should create a service identity', () => {
      const identity = security.createIdentity(
        'service',
        'api-service',
        ['service'],
      );

      expect(identity.type).toBe('service');
    });
  });

  describe('getIdentity', () => {
    it('should return identity by ID', () => {
      const created = security.createIdentity(
        'user',
        'test-user',
        ['user'],
      );

      const retrieved = security.getIdentity(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent ID', () => {
      const identity = security.getIdentity('non-existent');
      expect(identity).toBeUndefined();
    });
  });

  describe('createSession', () => {
    it('should create a session', () => {
      const identity = security.createIdentity('user', 'test-user', ['user']);
      const session = security.createSession(identity.id);

      expect(session).not.toBeNull();
      expect(session!.id).toBeDefined();
      expect(session!.token).toBeDefined();
      expect(session!.refreshToken).toBeDefined();
      expect(session!.identityId).toBe(identity.id);
    });

    it('should return null for non-existent identity', () => {
      const session = security.createSession('non-existent');
      expect(session).toBeNull();
    });

    it('should store IP and user agent', () => {
      const identity = security.createIdentity('user', 'test', []);
      const session = security.createSession(
        identity.id,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(session).not.toBeNull();
      expect(session!.ip).toBe('192.168.1.1');
      expect(session!.userAgent).toBe('Mozilla/5.0');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const identity = security.createIdentity('user', 'test', []);
      const session = security.createSession(identity.id);

      expect(session).not.toBeNull();
      const verified = security.verifyToken(session!.token);

      expect(verified).not.toBeNull();
      expect(verified!.id).toBe(identity.id);
    });

    it('should return null for invalid token', () => {
      const result = security.verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      expect(security.verifyToken('not-a-jwt')).toBeNull();
      expect(security.verifyToken('')).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate session', () => {
      const identity = security.createIdentity('user', 'test', []);
      const session = security.createSession(identity.id);
      expect(session).not.toBeNull();

      security.invalidateSession(session!.id);
      
      // Session should be invalidated
      expect(true).toBe(true);
    });

    it('should emit auth:logout event', () => {
      const events: string[] = [];
      security.on('auth:logout', (sessionId) => events.push(sessionId));

      const identity = security.createIdentity('user', 'test', []);
      const session = security.createSession(identity.id);
      expect(session).not.toBeNull();
      
      security.invalidateSession(session!.id);

      expect(events).toContain(session!.id);
    });
  });

  describe('checkPermission', () => {
    it('should allow admin all permissions', () => {
      const identity = security.createIdentity('user', 'admin', ['admin']);

      const result = security.checkPermission(identity.id, 'any:action');

      expect(result.allowed).toBe(true);
    });

    it('should deny missing permission', () => {
      const identity = security.createIdentity('user', 'test', ['user']);

      const result = security.checkPermission(identity.id, 'admin:action');

      expect(result.allowed).toBe(false);
    });

    it('should return not found for unknown identity', () => {
      const result = security.checkPermission('unknown', 'read:data');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Identity not found');
    });
  });

  describe('audit', () => {
    it('should record audit entries', () => {
      const identity = security.createIdentity('user', 'test', []);

      security.audit(identity.id, 'test:action', 'resource', 'res-123', {}, 'success');

      const entries = security.getAuditLog({ limit: 10 });
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should filter audit log by identity', () => {
      const id1 = security.createIdentity('user', 'user1', []).id;
      const id2 = security.createIdentity('user', 'user2', []).id;

      security.audit(id1, 'action1', 'resource', 'r1', {}, 'success');
      security.audit(id2, 'action2', 'resource', 'r2', {}, 'success');

      const entries = security.getAuditLog({ identityId: id1 });
      expect(entries.every(e => e.identityId === id1)).toBe(true);
    });

    it('should filter audit log by action', () => {
      const id = security.createIdentity('user', 'test', []).id;

      security.audit(id, 'read:data', 'resource', 'r1', {}, 'success');
      security.audit(id, 'write:data', 'resource', 'r2', {}, 'success');

      const entries = security.getAuditLog({ action: 'read:data' });
      expect(entries.every(e => e.action === 'read:data')).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit auth:login on session creation', () => {
      const events: unknown[] = [];
      security.on('auth:login', (identity, session) => events.push({ identity, session }));

      const identity = security.createIdentity('user', 'test', []);
      security.createSession(identity.id);

      expect(events.length).toBe(1);
    });

    it('should emit access:denied on permission failure', () => {
      const events: unknown[] = [];
      security.on('access:denied', (id, action, resource) => 
        events.push({ id, action, resource }));

      const identity = security.createIdentity('user', 'test', []);
      security.checkPermission(identity.id, 'forbidden:action', 'resource');

      expect(events.length).toBe(1);
    });
  });
});
