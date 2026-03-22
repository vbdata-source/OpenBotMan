/**
 * Built-in Web Search Tool
 *
 * Multi-provider search with automatic fallback:
 * 1. Local Browser (Chrome/Edge headless + Bing) - zero config, no API key needed
 * 2. Brave Search API (if BRAVE_SEARCH_API_KEY is set) - best quality
 * 3. DuckDuckGo HTML (last resort, often blocked by bot detection)
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { OpenBotManTool, ToolResult } from '@openbotman/protocol';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

type SearchResponse = { results: SearchResult[]; error?: string; provider: string };

// ── Browser detection ───────────────────────────────────────────────

const BROWSER_PATHS_WIN = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const BROWSER_PATHS_UNIX = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

let _cachedBrowserPath: string | null | undefined;

function findBrowser(): string | null {
  if (_cachedBrowserPath !== undefined) return _cachedBrowserPath;

  const paths = process.platform === 'win32' ? BROWSER_PATHS_WIN : BROWSER_PATHS_UNIX;
  for (const p of paths) {
    if (existsSync(p)) {
      _cachedBrowserPath = p;
      return p;
    }
  }
  _cachedBrowserPath = null;
  return null;
}

// ── Chrome/Edge headless + Bing ─────────────────────────────────────

function parseBingResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const blocks = html.split(/<li class="b_algo"/);

  for (const block of blocks.slice(1)) {
    // Title + URL: <h2><a href="...">title</a></h2>
    const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    // Snippet: <p class="b_lineclamp..."> or <div class="b_caption"><p>
    const snippetMatch = block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/)
      || block.match(/<div class="b_caption"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);

    if (titleMatch) {
      let url = titleMatch[1]!.replace(/&amp;/g, '&');

      // Decode Bing redirect: /ck/a?...&u=a1<base64url>...
      const realUrlMatch = url.match(/u=a1([A-Za-z0-9_-]+)/);
      if (realUrlMatch) {
        try {
          // Base64url → standard base64
          const b64 = realUrlMatch[1]!.replace(/-/g, '+').replace(/_/g, '/');
          const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
          url = Buffer.from(b64 + pad, 'base64').toString('utf8');
        } catch {
          // Keep bing redirect URL as fallback
        }
      }

      const title = titleMatch[2]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      const snippet = snippetMatch
        ? snippetMatch[1]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim()
        : '';

      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet });
      }
    }

    if (results.length >= 8) break;
  }

  return results;
}

function runBrowser(browserPath: string, url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--dump-dom',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      url,
    ];

    const proc = execFile(browserPath, args, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024, // 2MB
      windowsHide: true,
    }, (error, stdout, _stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });

    // Extra safety: kill on timeout
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Browser timeout'));
    }, timeoutMs + 2000);

    proc.on('exit', () => clearTimeout(timer));
  });
}

async function searchWithBrowser(query: string): Promise<SearchResponse> {
  const browserPath = findBrowser();
  if (!browserPath) {
    return { results: [], error: 'Kein Chrome/Edge Browser gefunden', provider: 'browser' };
  }

  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en&cc=us`;
    const html = await runBrowser(browserPath, searchUrl, 15000);

    // Check for captcha/block
    if (html.includes('captcha') || html.includes('unusual traffic')) {
      return { results: [], error: 'Bing Bot-Erkennung (Captcha)', provider: 'browser' };
    }

    const results = parseBingResults(html);

    if (results.length === 0) {
      return { results: [], error: 'Browser-Suche: keine Ergebnisse geparst', provider: 'browser' };
    }

    return { results, provider: 'browser' };
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
      return { results: [], error: 'Browser-Suche Timeout (15s)', provider: 'browser' };
    }
    return { results: [], error: `Browser-Suche: ${msg}`, provider: 'browser' };
  }
}

// ── Brave Search API ────────────────────────────────────────────────

async function searchBrave(query: string, apiKey: string): Promise<SearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { results: [], error: `Brave Search HTTP ${response.status}`, provider: 'brave' };
    }

    const data = await response.json() as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };

    const results: SearchResult[] = (data.web?.results ?? [])
      .filter((r): r is { title: string; url: string; description?: string } => !!r.title && !!r.url)
      .slice(0, 8)
      .map(r => ({ title: r.title, url: r.url, snippet: r.description ?? '' }));

    return { results, provider: 'brave' };
  } catch (error) {
    return { results: [], error: `Brave Search: ${(error as Error).message}`, provider: 'brave' };
  } finally {
    clearTimeout(timeout);
  }
}

// ── DuckDuckGo HTML Scraping (last resort) ──────────────────────────

function parseDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const resultBlocks = html.split(/class="result\s/);

  for (const block of resultBlocks.slice(1)) {
    const urlMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/);
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (urlMatch && titleMatch) {
      let url = urlMatch[1]!;
      const actualUrl = url.match(/uddg=([^&]+)/);
      if (actualUrl) {
        url = decodeURIComponent(actualUrl[1]!);
      }
      const snippet = snippetMatch
        ? snippetMatch[1]!.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
        : '';
      results.push({ title: titleMatch[1]!.trim(), url, snippet });
    }
    if (results.length >= 8) break;
  }
  return results;
}

async function searchDuckDuckGo(query: string): Promise<SearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok || response.status === 202) {
      return { results: [], error: `DuckDuckGo HTTP ${response.status}`, provider: 'duckduckgo' };
    }

    const html = await response.text();
    if (html.includes('captcha') || html.includes('anomaly') || html.includes('blocked')) {
      return { results: [], error: 'DuckDuckGo Bot-Erkennung', provider: 'duckduckgo' };
    }

    return { results: parseDuckDuckGoResults(html), provider: 'duckduckgo' };
  } catch (error) {
    return { results: [], error: `DuckDuckGo: ${(error as Error).message}`, provider: 'duckduckgo' };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Multi-provider search with fallback ─────────────────────────────

async function searchWeb(query: string): Promise<SearchResponse> {
  const errors: string[] = [];

  // 1. Local browser (Chrome/Edge headless + Bing) - zero config
  const browserResult = await searchWithBrowser(query);
  if (browserResult.results.length > 0) return browserResult;
  if (browserResult.error) errors.push(browserResult.error);

  // 2. Brave Search API (if key is set)
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    const result = await searchBrave(query, braveKey);
    if (result.results.length > 0) return result;
    if (result.error) errors.push(result.error);
  }

  // 3. DuckDuckGo (last resort, often blocked)
  const ddgResult = await searchDuckDuckGo(query);
  if (ddgResult.results.length > 0) return ddgResult;
  if (ddgResult.error) errors.push(ddgResult.error);

  return {
    results: [],
    error: `Websuche fehlgeschlagen bei allen Providern. ${errors.join(' | ')}`,
    provider: 'none',
  };
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

    const { results, error, provider } = await searchWeb(query);

    if (error && results.length === 0) {
      return { success: false, output: error, error };
    }

    const formatted = results.map((r, i) =>
      `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
    ).join('\n\n');

    const output = `Suchergebnisse fuer "${query}" (via ${provider}):\n\n${formatted}`;

    return {
      success: true,
      output,
      metadata: { resultCount: results.length, query, provider },
    };
  },
};
