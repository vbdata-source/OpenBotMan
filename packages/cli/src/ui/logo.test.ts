/**
 * Logo / UI Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LOGO,
  LOGO_COMPACT,
  printBanner,
  printHeader,
  printSuccess,
  printError,
  printWarning,
  printInfo,
} from './logo.js';

// Capture console output
let consoleSpy: ReturnType<typeof vi.spyOn>;
let output: string[] = [];

beforeEach(() => {
  output = [];
  consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    output.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('UI Components', () => {
  describe('Logo Constants', () => {
    it('should have full logo with version', () => {
      // Logo contains ASCII art, not the literal text "OpenBotMan"
      expect(LOGO).toContain('2.0.0-alpha.1');
      expect(LOGO).toContain('Multi-Agent Orchestration');
      expect(LOGO).toContain('██'); // ASCII art blocks
    });

    it('should have compact logo', () => {
      // Compact logo does contain the literal "OpenBotMan" text
      expect(LOGO_COMPACT).toContain('OpenBotMan');
      expect(LOGO_COMPACT).toContain('2.0.0-alpha.1');
    });

    it('should have ASCII art in full logo', () => {
      expect(LOGO).toContain('██');
      expect(LOGO).toContain('╔');
      expect(LOGO).toContain('╚');
    });
  });

  describe('printBanner', () => {
    it('should print full banner by default', () => {
      printBanner();
      
      expect(output.length).toBeGreaterThan(0);
      // Check for distinctive elements of the banner
      expect(output.join('\n')).toContain('Multi-Agent Orchestration');
    });

    it('should print compact banner when requested', () => {
      printBanner(true);
      
      expect(output.length).toBeGreaterThan(0);
      const text = output.join('\n');
      expect(text).toContain('OpenBotMan');
      // Compact should be shorter
      expect(text.length).toBeLessThan(LOGO.length);
    });
  });

  describe('printHeader', () => {
    it('should print header with title', () => {
      printHeader('Test Header');
      
      const text = output.join('\n');
      expect(text).toContain('Test Header');
      expect(text).toContain('═');
      expect(text).toContain('╔');
      expect(text).toContain('╚');
    });

    it('should handle empty title', () => {
      printHeader('');
      
      expect(output.length).toBe(3); // Top, middle, bottom lines
    });

    it('should handle long title', () => {
      const longTitle = 'This is a very long header title for testing purposes';
      printHeader(longTitle);
      
      const text = output.join('\n');
      expect(text).toContain(longTitle);
    });
  });

  describe('printSuccess', () => {
    it('should print success message with checkmark', () => {
      printSuccess('Operation completed');
      
      const text = output.join('');
      expect(text).toContain('✓');
      expect(text).toContain('Operation completed');
    });
  });

  describe('printError', () => {
    it('should print error message with X', () => {
      printError('Something failed');
      
      const text = output.join('');
      expect(text).toContain('✗');
      expect(text).toContain('Something failed');
    });
  });

  describe('printWarning', () => {
    it('should print warning message with symbol', () => {
      printWarning('Be careful');
      
      const text = output.join('');
      expect(text).toContain('⚠');
      expect(text).toContain('Be careful');
    });
  });

  describe('printInfo', () => {
    it('should print info message with symbol', () => {
      printInfo('Here is some info');
      
      const text = output.join('');
      expect(text).toContain('ℹ');
      expect(text).toContain('Here is some info');
    });
  });
});
