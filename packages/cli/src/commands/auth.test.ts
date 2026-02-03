/**
 * Auth Commands Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ClaudeAuthProvider, SETUP_TOKEN_PREFIX, SETUP_TOKEN_MIN_LENGTH } from '@openbotman/orchestrator';

// Helper to create valid setup token
function createValidToken(): string {
  return SETUP_TOKEN_PREFIX + 'a'.repeat(SETUP_TOKEN_MIN_LENGTH - SETUP_TOKEN_PREFIX.length);
}

describe('Auth Commands', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openbotman-cli-auth-test-'));
  });
  
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });
  
  describe('ClaudeAuthProvider integration', () => {
    it('should work with CLI storage path', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      
      // Initially no auth
      expect(provider.getStatus().authenticated).toBe(false);
      
      // Import token
      const token = createValidToken();
      provider.importSetupToken(token, 'cli-test');
      
      // Now authenticated
      const status = provider.getStatus();
      expect(status.authenticated).toBe(true);
      expect(status.method).toBe('setup_token');
      expect(status.profile).toBe('cli-test');
    });
    
    it('should list profiles correctly', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      
      // Add multiple profiles
      provider.importSetupToken(createValidToken(), 'profile-a');
      provider.importSetupToken(createValidToken(), 'profile-b');
      
      const profiles = provider.listProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles.map(p => p.name)).toContain('profile-a');
      expect(profiles.map(p => p.name)).toContain('profile-b');
    });
    
    it('should remove profiles correctly', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      
      provider.importSetupToken(createValidToken(), 'to-delete');
      expect(provider.listProfiles()).toHaveLength(1);
      
      provider.removeProfile('to-delete');
      expect(provider.listProfiles()).toHaveLength(0);
    });
    
    it('should set default profile correctly', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      
      provider.importSetupToken(createValidToken(), 'first');
      provider.importSetupToken(createValidToken(), 'second');
      
      // First is default
      let profiles = provider.listProfiles();
      const firstProfile = profiles.find(p => p.name === 'first');
      expect(firstProfile?.isDefault).toBe(true);
      
      // Change default
      provider.setDefaultProfile('second');
      profiles = provider.listProfiles();
      const secondProfile = profiles.find(p => p.name === 'second');
      expect(secondProfile?.isDefault).toBe(true);
    });
  });
  
  describe('Token validation', () => {
    it('should validate correct setup-token format', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      const validToken = createValidToken();
      
      // Should not throw
      expect(() => provider.importSetupToken(validToken)).not.toThrow();
    });
    
    it('should reject invalid token prefix', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      const invalidToken = 'sk-invalid-prefix-' + 'a'.repeat(80);
      
      expect(() => provider.importSetupToken(invalidToken)).toThrow();
    });
    
    it('should reject too short token', () => {
      const provider = new ClaudeAuthProvider({ storagePath: tempDir });
      const shortToken = SETUP_TOKEN_PREFIX + 'short';
      
      expect(() => provider.importSetupToken(shortToken)).toThrow();
    });
  });
});
