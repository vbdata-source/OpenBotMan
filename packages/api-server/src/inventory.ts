/**
 * Pre-Discussion Inventory Phase
 *
 * Static regex-based code analysis for generating project inventories.
 * No LLM calls, no external tools - deterministic and instant.
 */

import { basename } from 'path';
import type { WorkspaceContext, WorkspaceFile } from './workspace.js';

// ============================================
// Interfaces
// ============================================

export interface ImportRef {
  module: string;
  isLocal: boolean;
}

export interface FileInventoryEntry {
  path: string;
  size: number;
  language: string;
  exports: string[];
  imports: ImportRef[];
  purpose: string;
  lineCount: number;
}

export interface ProjectInventory {
  projectName: string;
  fileCount: number;
  totalSizeKB: number;
  files: FileInventoryEntry[];
  dependencyGraph: string;
}

// ============================================
// Skip patterns for purpose detection
// ============================================

const SKIP_PATTERNS = [
  /auto.?generated/i,
  /@generated/i,
  /eslint-disable/i,
  /copyright/i,
  /license/i,
  /prettier-ignore/i,
  /DO NOT EDIT/i,
];

// ============================================
// Language detection
// ============================================

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'other';
  }
}

// ============================================
// Export extraction
// ============================================

function extractExports(content: string, language: string): string[] {
  const exports: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    const regex = /export\s+(?:default\s+)?(?:function|class|const|let|type|interface|enum)\s+(\w+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }
  } else if (language === 'python') {
    // Top-level defs and classes (no indentation)
    const regex = /^(?:def|class)\s+(\w+)/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1] && !match[1].startsWith('_')) {
        // Check it's at indent level 0
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const indent = match.index - lineStart;
        if (indent === 0) exports.push(match[1]);
      }
    }
  }

  return exports;
}

// ============================================
// Import extraction
// ============================================

function extractImports(content: string, language: string): ImportRef[] {
  const imports: ImportRef[] = [];
  const seen = new Set<string>();

  if (language === 'typescript' || language === 'javascript') {
    // import ... from '...'
    const importRegex = /import\s+(?:(?:\{[^}]+\}|[\w*]+(?:\s*,\s*\{[^}]+\})?)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const mod = match[1]!;
      if (!seen.has(mod)) {
        seen.add(mod);
        imports.push({ module: mod, isLocal: mod.startsWith('.') || mod.startsWith('/') });
      }
    }

    // require('...')
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const mod = match[1]!;
      if (!seen.has(mod)) {
        seen.add(mod);
        imports.push({ module: mod, isLocal: mod.startsWith('.') || mod.startsWith('/') });
      }
    }
  } else if (language === 'python') {
    const regex = /^(?:import|from)\s+([\w.]+)/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const mod = match[1]!;
      if (!seen.has(mod)) {
        seen.add(mod);
        imports.push({ module: mod, isLocal: mod.startsWith('.') });
      }
    }
  }

  return imports;
}

// ============================================
// Purpose inference
// ============================================

function inferPurpose(content: string, path: string, language: string): string {
  // Try to find first relevant comment block
  let commentBlocks: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    // /** ... */ JSDoc blocks
    const jsdocRegex = /\/\*\*\s*([\s\S]*?)\*\//g;
    let match;
    while ((match = jsdocRegex.exec(content)) !== null) {
      if (match[1]) commentBlocks.push(match[1].replace(/^\s*\*\s?/gm, '').trim());
    }
    // // single-line comments at file start
    if (commentBlocks.length === 0) {
      const lines = content.split('\n');
      const firstComments: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          firstComments.push(trimmed.replace(/^\/\/\s*/, ''));
        } else if (trimmed === '') {
          continue;
        } else {
          break;
        }
      }
      if (firstComments.length > 0) commentBlocks.push(firstComments.join(' '));
    }
  } else if (language === 'python') {
    // """...""" or '''...''' docstrings
    const docstringRegex = /^(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/m;
    const match = docstringRegex.exec(content);
    if (match) {
      commentBlocks.push((match[1] || match[2] || '').trim());
    }
    // # comments at file start
    if (commentBlocks.length === 0) {
      const lines = content.split('\n');
      const firstComments: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          firstComments.push(trimmed.replace(/^#\s*/, ''));
        } else if (trimmed === '') {
          continue;
        } else {
          break;
        }
      }
      if (firstComments.length > 0) commentBlocks.push(firstComments.join(' '));
    }
  }

  // Filter out license/generated headers
  for (const block of commentBlocks) {
    const shouldSkip = SKIP_PATTERNS.some(pattern => pattern.test(block));
    if (!shouldSkip && block.length > 3) {
      // Take first line, truncate to 80 chars
      const firstLine = block.split('\n')[0]!.trim();
      return firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;
    }
  }

  // Fallback: humanize filename
  const name = basename(path).replace(/\.[^.]+$/, '');
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// Dependency graph
// ============================================

function buildDependencyGraph(files: FileInventoryEntry[]): string {
  const lines: string[] = [];

  for (const file of files) {
    const localImports = file.imports
      .filter(imp => imp.isLocal)
      .map(imp => {
        // Resolve relative import to match file paths
        const mod = imp.module.replace(/^\.\//, '').replace(/\.[^.]+$/, '');
        return mod;
      })
      .filter(mod => mod.length > 0);

    if (localImports.length > 0) {
      lines.push(`${file.path} -> ${localImports.join(', ')}`);
    } else {
      lines.push(`${file.path} -> (keine lokalen)`);
    }
  }

  return lines.join('\n');
}

// ============================================
// Main inventory generation
// ============================================

export function generateInventory(ctx: WorkspaceContext): ProjectInventory {
  // Try to find project name from package.json
  let projectName = basename(ctx.workspaceRoot);
  const pkgFile = ctx.files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      if (pkg.name) projectName = pkg.name;
    } catch {
      // Ignore parse errors
    }
  }

  const files: FileInventoryEntry[] = [];

  for (const file of ctx.files) {
    const language = detectLanguage(file.path);
    const lineCount = file.content.split('\n').length;
    const exports = extractExports(file.content, language);
    const imports = extractImports(file.content, language);
    const purpose = inferPurpose(file.content, file.path, language);

    files.push({
      path: file.path,
      size: file.size,
      language,
      exports,
      imports,
      purpose,
      lineCount,
    });
  }

  const dependencyGraph = buildDependencyGraph(files);

  return {
    projectName,
    fileCount: files.length,
    totalSizeKB: Math.round(ctx.totalSize / 1024),
    files,
    dependencyGraph,
  };
}

// ============================================
// Format inventory as markdown
// ============================================

export function formatInventory(inventory: ProjectInventory): string {
  const lines: string[] = [];

  // Header
  const languages = [...new Set(inventory.files.map(f => f.language).filter(l => l !== 'other'))];
  const langDisplay = languages.length > 0 ? languages.join(', ') : 'mixed';
  lines.push(`## Projekt-Inventar: ${inventory.projectName}`);
  lines.push(`${langDisplay} | ${inventory.fileCount} Dateien | ${inventory.totalSizeKB}KB`);
  lines.push('');

  // File overview table
  lines.push('### Datei-Uebersicht');
  lines.push('| Datei | Zweck | Exports | Groesse |');
  lines.push('|-------|-------|---------|---------|');

  for (const file of inventory.files) {
    const exportsDisplay = file.exports.length > 0
      ? file.exports.slice(0, 5).join(', ') + (file.exports.length > 5 ? ', ...' : '')
      : '-';
    const sizeDisplay = file.size >= 1024
      ? `${Math.round(file.size / 1024)}KB`
      : `${file.size}B`;
    lines.push(`| ${file.path} | ${file.purpose} | ${exportsDisplay} | ${sizeDisplay} |`);
  }

  lines.push('');

  // Dependency graph
  lines.push('### Abhaengigkeitsgraph');
  lines.push(inventory.dependencyGraph || '(keine lokalen Abhaengigkeiten)');
  lines.push('');

  return lines.join('\n');
}

// ============================================
// Build full context: inventory + prioritized raw code
// ============================================

/**
 * Prioritize files: entry points first, then by size (largest first)
 */
function prioritizeFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  const entryPatterns = /^(index|main|app|server|orchestrator)\./i;
  return [...files].sort((a, b) => {
    const aEntry = entryPatterns.test(basename(a.path)) ? 1 : 0;
    const bEntry = entryPatterns.test(basename(b.path)) ? 1 : 0;
    if (aEntry !== bEntry) return bEntry - aEntry;
    return b.size - a.size;
  });
}

/**
 * Combine inventory markdown with budget-controlled raw code.
 * The inventory serves as a table of contents, followed by the most important source files.
 */
export function buildFullContext(
  wsContext: WorkspaceContext,
  inventory: ProjectInventory,
  maxBytes: number
): { context: string; contextType: 'inventory' | 'raw-code' } {
  const inventoryMd = formatInventory(inventory);
  const inventoryBytes = Buffer.byteLength(inventoryMd, 'utf-8');
  const separator = '\n\n---\n\n## Quellcode (wichtigste Dateien)\n\n';
  const separatorBytes = Buffer.byteLength(separator, 'utf-8');

  // Remaining budget for raw code
  const remainingBytes = maxBytes - inventoryBytes - separatorBytes;

  if (remainingBytes < 1024) {
    // Only inventory, no room for raw code
    return { context: inventoryMd, contextType: 'inventory' };
  }

  // Prioritize files: entry points first, then largest
  const prioritized = prioritizeFiles(wsContext.files);
  let rawCode = '';
  let usedBytes = 0;

  for (const file of prioritized) {
    const fileBlock = `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
    const blockBytes = Buffer.byteLength(fileBlock, 'utf-8');
    if (usedBytes + blockBytes > remainingBytes) break;
    rawCode += fileBlock;
    usedBytes += blockBytes;
  }

  // Guard: if no raw code fits, return inventory only (no empty heading)
  if (rawCode === '') {
    return { context: inventoryMd, contextType: 'inventory' };
  }

  return {
    context: inventoryMd + separator + rawCode,
    contextType: 'inventory',
  };
}
