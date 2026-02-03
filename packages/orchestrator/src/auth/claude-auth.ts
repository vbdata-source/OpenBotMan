/**
 * Claude Auth Provider
 * 
 * Supports multiple authentication methods for Claude API:
 * - API Key (ANTHROPIC_API_KEY) - Traditional approach
 * - Setup Token (sk-ant-oat01-*) - Claude Code CLI Pro subscription auth
 * 
 * Based on OpenClaw's implementation of Claude Code CLI authentication.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import Anthropic from '@anthropic-ai/sdk';

// Claude Code CLI setup-token prefix
export const SETUP_TOKEN_PREFIX = 'sk-ant-oat01-';
export const SETUP_TOKEN_MIN_LENGTH = 80;

/**
 * Authentication method type
 */
export type AuthMethod = 'api_key' | 'setup_token' | 'oauth';

/**
 * Authentication credential
 */
export interface AuthCredential {
  type: AuthMethod;
  provider: 'anthropic';
  
  /** API key or token value */
  token: string;
  
  /** Token profile name (for setup-token) */
  profileName?: string;
  
  /** Expiration timestamp (if known) */
  expiresAt?: number;
}

/**
 * Auth profile storage structure
 */
export interface AuthProfileStore {
  version: number;
  profiles: Record<string, AuthCredential>;
  defaultProfile?: string;
}

/**
 * Claude Auth Provider configuration
 */
export interface ClaudeAuthConfig {
  /** Path to store auth profiles */
  storagePath?: string;
  
  /** Prefer setup-token over API key */
  preferSetupToken?: boolean;
  
  /** Environment variable for API key */
  apiKeyEnvVar?: string;
  
  /** Allow fallback to API key if setup-token fails */
  allowFallback?: boolean;
}

/**
 * Claude Auth Provider
 * 
 * Manages authentication for Claude API access.
 */
export class ClaudeAuthProvider {
  private config: Required<ClaudeAuthConfig>;
  private store: AuthProfileStore;
  private storePath: string;
  
  constructor(config: ClaudeAuthConfig = {}) {
    this.config = {
      storagePath: config.storagePath ?? join(homedir(), '.openbotman'),
      preferSetupToken: config.preferSetupToken ?? true,
      apiKeyEnvVar: config.apiKeyEnvVar ?? 'ANTHROPIC_API_KEY',
      allowFallback: config.allowFallback ?? true,
    };
    
    this.storePath = join(this.config.storagePath, 'auth-profiles.json');
    this.store = this.loadStore();
  }
  
  /**
   * Get the best available credential
   */
  getCredential(): AuthCredential | null {
    // 1. Check for configured setup-token (if preferred)
    if (this.config.preferSetupToken) {
      const setupToken = this.getSetupToken();
      if (setupToken) {
        return setupToken;
      }
    }
    
    // 2. Check environment API key
    const apiKey = this.getApiKeyFromEnv();
    if (apiKey) {
      return apiKey;
    }
    
    // 3. Fallback to setup-token (if not preferred earlier)
    if (!this.config.preferSetupToken) {
      const setupToken = this.getSetupToken();
      if (setupToken) {
        return setupToken;
      }
    }
    
    // 4. Try Claude CLI credentials file
    const cliCreds = this.readClaudeCliCredentials();
    if (cliCreds) {
      return cliCreds;
    }
    
    return null;
  }
  
  /**
   * Get API key for Anthropic client
   */
  getApiKey(): string | null {
    const cred = this.getCredential();
    return cred?.token ?? null;
  }
  
  /**
   * Check if using setup-token (Pro subscription)
   */
  isUsingSetupToken(): boolean {
    const cred = this.getCredential();
    return cred?.type === 'setup_token';
  }
  
  /**
   * Create an Anthropic client with the best available auth
   */
  createClient(): Anthropic {
    const cred = this.getCredential();
    
    if (!cred) {
      throw new AuthError(
        'No authentication method available. ' +
        'Set ANTHROPIC_API_KEY or run: openbotman auth setup-token'
      );
    }
    
    // For setup-token (OAuth token), use authToken parameter
    if (cred.type === 'setup_token') {
      return new Anthropic({
        apiKey: null as unknown as string, // Bypass type check
        authToken: cred.token,
        defaultHeaders: this.getSetupTokenHeaders(),
      });
    }
    
    // For API key, use standard auth
    return new Anthropic({
      apiKey: cred.token,
    });
  }
  
  /**
   * Get authentication status
   */
  getStatus(): AuthStatus {
    const cred = this.getCredential();
    
    if (!cred) {
      return {
        authenticated: false,
        method: null,
        message: 'No authentication configured',
      };
    }
    
    const tokenPreview = this.maskToken(cred.token);
    
    return {
      authenticated: true,
      method: cred.type,
      profile: cred.profileName,
      tokenPreview,
      expiresAt: cred.expiresAt,
      message: `Authenticated via ${cred.type}${cred.profileName ? ` (${cred.profileName})` : ''}`,
    };
  }
  
  /**
   * Import a setup-token
   */
  importSetupToken(token: string, profileName: string = 'default'): void {
    const validation = validateSetupToken(token);
    if (!validation.valid) {
      throw new AuthError(`Invalid setup-token: ${validation.error}`);
    }
    
    const profileId = `anthropic:${normalizeProfileName(profileName)}`;
    
    this.store.profiles[profileId] = {
      type: 'setup_token',
      provider: 'anthropic',
      token: token.trim(),
      profileName,
    };
    
    if (!this.store.defaultProfile) {
      this.store.defaultProfile = profileId;
    }
    
    this.saveStore();
  }
  
  /**
   * Remove a profile
   */
  removeProfile(profileName: string): boolean {
    const profileId = `anthropic:${normalizeProfileName(profileName)}`;
    
    if (this.store.profiles[profileId]) {
      delete this.store.profiles[profileId];
      
      if (this.store.defaultProfile === profileId) {
        const remaining = Object.keys(this.store.profiles);
        this.store.defaultProfile = remaining[0];
      }
      
      this.saveStore();
      return true;
    }
    
    return false;
  }
  
  /**
   * Set default profile
   */
  setDefaultProfile(profileName: string): void {
    const profileId = `anthropic:${normalizeProfileName(profileName)}`;
    
    if (!this.store.profiles[profileId]) {
      throw new AuthError(`Profile not found: ${profileName}`);
    }
    
    this.store.defaultProfile = profileId;
    this.saveStore();
  }
  
  /**
   * List all profiles
   */
  listProfiles(): AuthProfile[] {
    return Object.entries(this.store.profiles).map(([id, cred]) => ({
      id,
      name: cred.profileName ?? id.split(':')[1] ?? 'unknown',
      type: cred.type,
      isDefault: id === this.store.defaultProfile,
      tokenPreview: this.maskToken(cred.token),
      expiresAt: cred.expiresAt,
    }));
  }
  
  // --- Private methods ---
  
  private getSetupToken(): AuthCredential | null {
    // Check default profile first
    if (this.store.defaultProfile) {
      const cred = this.store.profiles[this.store.defaultProfile];
      if (cred?.type === 'setup_token') {
        return cred;
      }
    }
    
    // Check any setup-token profile
    for (const cred of Object.values(this.store.profiles)) {
      if (cred.type === 'setup_token') {
        return cred;
      }
    }
    
    // Check environment variable
    const envToken = process.env['CLAUDE_SETUP_TOKEN']?.trim();
    if (envToken && isSetupToken(envToken)) {
      return {
        type: 'setup_token',
        provider: 'anthropic',
        token: envToken,
        profileName: 'env',
      };
    }
    
    return null;
  }
  
  private getApiKeyFromEnv(): AuthCredential | null {
    const apiKey = process.env[this.config.apiKeyEnvVar]?.trim();
    
    if (!apiKey) {
      return null;
    }
    
    // Check if it's actually a setup-token
    if (isSetupToken(apiKey)) {
      return {
        type: 'setup_token',
        provider: 'anthropic',
        token: apiKey,
        profileName: 'env',
      };
    }
    
    return {
      type: 'api_key',
      provider: 'anthropic',
      token: apiKey,
    };
  }
  
  private readClaudeCliCredentials(): AuthCredential | null {
    // Try to read from Claude CLI credentials file (~/.claude/.credentials.json)
    const credPath = join(homedir(), '.claude', '.credentials.json');
    
    if (!existsSync(credPath)) {
      return null;
    }
    
    try {
      const content = readFileSync(credPath, 'utf-8');
      const data = JSON.parse(content);
      
      const oauth = data?.claudeAiOauth;
      if (!oauth || typeof oauth !== 'object') {
        return null;
      }
      
      const accessToken = oauth.accessToken;
      const expiresAt = oauth.expiresAt;
      
      if (typeof accessToken !== 'string' || !accessToken) {
        return null;
      }
      
      // Check if token is expired
      if (typeof expiresAt === 'number' && expiresAt < Date.now()) {
        // Token expired, might need refresh
        // For now, skip expired tokens
        return null;
      }
      
      return {
        type: isSetupToken(accessToken) ? 'setup_token' : 'oauth',
        provider: 'anthropic',
        token: accessToken,
        profileName: 'claude-cli',
        expiresAt: typeof expiresAt === 'number' ? expiresAt : undefined,
      };
    } catch {
      return null;
    }
  }
  
  private getSetupTokenHeaders(): Record<string, string> {
    // Headers to mimic Claude Code CLI (for setup-token compatibility)
    return {
      'accept': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
      'user-agent': 'openbotman/1.0 (claude-cli-compat)',
      'x-app': 'cli',
    };
  }
  
  private loadStore(): AuthProfileStore {
    if (!existsSync(this.storePath)) {
      return {
        version: 1,
        profiles: {},
      };
    }
    
    try {
      const content = readFileSync(this.storePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        version: 1,
        profiles: {},
      };
    }
  }
  
  private saveStore(): void {
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }
  
  private maskToken(token: string): string {
    if (token.length < 12) {
      return '***';
    }
    return `${token.slice(0, 8)}...${token.slice(-4)}`;
  }
}

/**
 * Validate a setup-token
 */
export function validateSetupToken(token: string): { valid: boolean; error?: string } {
  const trimmed = token.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Token is required' };
  }
  
  if (!trimmed.startsWith(SETUP_TOKEN_PREFIX)) {
    return { 
      valid: false, 
      error: `Token must start with ${SETUP_TOKEN_PREFIX}` 
    };
  }
  
  if (trimmed.length < SETUP_TOKEN_MIN_LENGTH) {
    return { 
      valid: false, 
      error: 'Token appears to be incomplete (too short)' 
    };
  }
  
  return { valid: true };
}

/**
 * Check if a string is a setup-token
 */
export function isSetupToken(value: string): boolean {
  return value.startsWith(SETUP_TOKEN_PREFIX) && value.length >= SETUP_TOKEN_MIN_LENGTH;
}

/**
 * Normalize profile name to a URL-safe slug
 */
export function normalizeProfileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'default';
  }
  
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
}

/**
 * Auth status response
 */
export interface AuthStatus {
  authenticated: boolean;
  method: AuthMethod | null;
  profile?: string;
  tokenPreview?: string;
  expiresAt?: number;
  message: string;
}

/**
 * Auth profile info
 */
export interface AuthProfile {
  id: string;
  name: string;
  type: AuthMethod;
  isDefault: boolean;
  tokenPreview: string;
  expiresAt?: number;
}

/**
 * Auth error
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Create a default auth provider instance
 */
export function createAuthProvider(config?: ClaudeAuthConfig): ClaudeAuthProvider {
  return new ClaudeAuthProvider(config);
}
