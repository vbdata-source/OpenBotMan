/**
 * Provider exports
 * 
 * Multi-provider support for LLM integrations.
 */

// Base provider interface and types
export {
  BaseProvider,
  MockProvider,
  type LLMProvider,
  type ProviderConfig,
  type ProviderOptions,
  type ProviderResponse,
} from './base-provider.js';

// Claude CLI (original implementation)
export {
  ClaudeCliProvider,
  createClaudeCliProvider,
  claudeCliRequest,
  type ClaudeCliProviderOptions,
  type ClaudeCliResponse,
  type ClaudeCliMessage,
  type ClaudeCliContent,
  type ClaudeCliContentBlock,
  type ClaudeCliResult,
  type ClaudeCliProviderEvents,
} from './claude-cli.js';

// Claude CLI Adapter (LLMProvider interface)
export {
  ClaudeCliAdapter,
  createClaudeCliAdapter,
  type ClaudeCliAdapterConfig,
} from './claude-cli-adapter.js';

// OpenAI Provider
export {
  OpenAIProvider,
  createOpenAIProvider,
  type OpenAIProviderConfig,
} from './openai.js';

// Google Gemini Provider
export {
  GoogleProvider,
  createGoogleProvider,
  type GoogleProviderConfig,
} from './google.js';

// Provider factory
export {
  createProvider,
  type CreateProviderOptions,
} from './factory.js';
