/**
 * Built-in Web Fetch Tool
 *
 * Fetches a URL and returns content as cleaned text/markdown.
 * No external dependencies - uses Node.js built-in fetch.
 */

import type { OpenBotManTool, ToolResult } from '@openbotman/protocol';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_CONTENT_CHARS = 15000;

/**
 * Convert HTML to readable markdown-like text
 */
function htmlToText(html: string): string {
  return html
    // Remove script, style, nav, footer, header blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Convert headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    // Convert lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Convert breaks and paragraphs
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    // Convert code blocks
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Convert links and formatting
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+$/gm, '')
    .trim();
}

/**
 * Web Fetch Tool - OpenBotManTool implementation
 */
export const webFetchTool: OpenBotManTool = {
  name: 'web_fetch',
  description: 'Fetch a web page and return its content as readable text. Use this to retrieve documentation, articles, blog posts, or any web content for detailed analysis. Works best with specific URLs found via web_search.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
    },
    required: ['url'],
  },

  execute: async (args): Promise<ToolResult> => {
    const url = args.url as string;
    if (!url) {
      return { success: false, output: '', error: 'url parameter is required' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html, application/json, text/plain',
          'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          success: false,
          output: `Fehler beim Abrufen von ${url}: HTTP ${response.status} ${response.statusText}`,
          error: `HTTP ${response.status}`,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      let content: string;

      if (contentType.includes('application/json')) {
        content = rawText;
      } else if (contentType.includes('text/html')) {
        content = htmlToText(rawText);
      } else {
        content = rawText;
      }

      // Truncation
      if (content.length > MAX_CONTENT_CHARS) {
        content = content.substring(0, MAX_CONTENT_CHARS) + '\n\n... [truncated]';
      }

      return {
        success: true,
        output: content || '(Leere Seite)',
        metadata: { url, contentLength: content.length },
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return {
          success: false,
          output: `Timeout beim Abrufen von ${url} (30s)`,
          error: 'Timeout',
        };
      }
      return {
        success: false,
        output: `Fehler beim Abrufen von ${url}: ${(error as Error).message}`,
        error: (error as Error).message,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
