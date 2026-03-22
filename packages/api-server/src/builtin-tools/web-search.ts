/**
 * Built-in Web Search Tool
 *
 * Uses DuckDuckGo HTML search (no API key required).
 * Parses search results from HTML response.
 */

import type { OpenBotManTool, ToolResult } from '@openbotman/protocol';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Parse DuckDuckGo HTML search results
 */
function parseDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML results are in <a class="result__a"> and <a class="result__snippet">
  const resultBlocks = html.split(/class="result\s/);

  for (const block of resultBlocks.slice(1)) { // Skip first (before first result)
    // Extract URL from result__a href
    const urlMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/);
    // Extract title from result__a text
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
    // Extract snippet from result__snippet
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (urlMatch && titleMatch) {
      let url = urlMatch[1]!;
      // DuckDuckGo wraps URLs in redirect - extract actual URL
      const actualUrl = url.match(/uddg=([^&]+)/);
      if (actualUrl) {
        url = decodeURIComponent(actualUrl[1]!);
      }

      const snippet = snippetMatch
        ? snippetMatch[1]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
        : '';

      results.push({
        title: titleMatch[1]!.trim(),
        url,
        snippet,
      });
    }

    if (results.length >= 8) break; // Limit to 8 results
  }

  return results;
}

/**
 * Perform a web search via DuckDuckGo HTML
 */
async function searchWeb(query: string): Promise<{ results: SearchResult[]; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          results: [],
          error: `Suche fehlgeschlagen (403 Forbidden - Rate Limit). Bitte versuche eine andere Domain via web_fetch aufzurufen oder formuliere die Suche um.`,
        };
      }
      return {
        results: [],
        error: `Suche fehlgeschlagen (HTTP ${response.status}). Bitte versuche es spaeter erneut oder nutze web_fetch mit einer bekannten URL.`,
      };
    }

    const html = await response.text();

    // Check for captcha/block
    if (html.includes('captcha') || html.includes('blocked')) {
      return {
        results: [],
        error: 'Suche fehlgeschlagen (Captcha/Block). Bitte versuche eine andere Domain via web_fetch aufzurufen.',
      };
    }

    const results = parseDuckDuckGoResults(html);

    if (results.length === 0) {
      return {
        results: [],
        error: 'Keine Suchergebnisse gefunden. Versuche andere Suchbegriffe oder nutze web_fetch mit einer bekannten URL.',
      };
    }

    return { results };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return { results: [], error: 'Suche abgebrochen (Timeout nach 15s). Bitte versuche es erneut.' };
    }
    return { results: [], error: `Suche fehlgeschlagen: ${(error as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Web Search Tool - OpenBotManTool implementation
 */
export const webSearchTool: OpenBotManTool = {
  name: 'web_search',
  description: 'Search the web for current information. Use this to find up-to-date facts, documentation, news, or technical information. Returns a list of relevant results with titles, URLs, and snippets. You can then use web_fetch on the most relevant URLs for detailed content.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query (use specific, descriptive terms for best results)',
      },
    },
    required: ['query'],
  },

  execute: async (args): Promise<ToolResult> => {
    const query = args.query as string;
    if (!query) {
      return { success: false, output: '', error: 'query parameter is required' };
    }

    const { results, error } = await searchWeb(query);

    if (error && results.length === 0) {
      return { success: false, output: error, error };
    }

    // Format results for LLM
    const formatted = results.map((r, i) =>
      `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
    ).join('\n\n');

    const output = `Suchergebnisse fuer "${query}":\n\n${formatted}`;

    return {
      success: true,
      output,
      metadata: { resultCount: results.length, query },
    };
  },
};
