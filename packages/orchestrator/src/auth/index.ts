/**
 * Auth Module
 * 
 * Provides authentication providers for various LLM services.
 */

export {
  ClaudeAuthProvider,
  createAuthProvider,
  validateSetupToken,
  isSetupToken,
  normalizeProfileName,
  AuthError,
  SETUP_TOKEN_PREFIX,
  SETUP_TOKEN_MIN_LENGTH,
} from './claude-auth.js';

export type {
  AuthMethod,
  AuthCredential,
  AuthProfileStore,
  ClaudeAuthConfig,
  AuthStatus,
  AuthProfile,
} from './claude-auth.js';
