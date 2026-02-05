/**
 * Workspace Context Loading
 * 
 * Loads files from a workspace directory for context in discussions.
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import fg from 'fast-glob';

export interface WorkspaceFile {
  path: string;
  content: string;
  size: number;
}

export interface WorkspaceContext {
  files: WorkspaceFile[];
  totalSize: number;
  fileCount: number;
  workspaceRoot: string;
}

/**
 * Default ignore patterns
 */
const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.map',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock',
  '**/.turbo/**',
  '**/__pycache__/**',
  '**/*.exe',
  '**/*.dll',
  '**/*.bin',
  '**/*.zip',
  '**/*.tar.gz',
];

/**
 * Load files matching glob patterns from a workspace
 */
export async function loadWorkspaceContext(
  workspaceRoot: string,
  patterns: string[],
  maxBytes: number = 100 * 1024 // 100KB default
): Promise<WorkspaceContext> {
  const files: WorkspaceFile[] = [];
  let totalSize = 0;

  // Validate workspace exists
  if (!existsSync(workspaceRoot)) {
    throw new Error(`Workspace not found: ${workspaceRoot}`);
  }

  // Find matching files
  const matchedFiles = await fg(patterns, {
    cwd: workspaceRoot,
    absolute: false,
    onlyFiles: true,
    ignore: DEFAULT_IGNORE,
    dot: false,
  });

  // Sort by path for consistent output
  matchedFiles.sort();

  for (const relPath of matchedFiles) {
    if (totalSize >= maxBytes) break;

    const fullPath = join(workspaceRoot, relPath);
    
    try {
      const stat = statSync(fullPath);
      
      // Skip large files (>100KB individual)
      if (stat.size > 100 * 1024) {
        console.log(`[Workspace] Skipping large file: ${relPath} (${Math.round(stat.size / 1024)}KB)`);
        continue;
      }
      
      // Skip binary files (simple heuristic)
      if (isBinaryPath(relPath)) {
        continue;
      }
      
      const content = readFileSync(fullPath, 'utf-8');
      const size = Buffer.byteLength(content, 'utf-8');
      
      // Check if adding this file would exceed limit
      if (totalSize + size > maxBytes) {
        // Truncate if we have room for at least 500 bytes
        const remaining = maxBytes - totalSize;
        if (remaining > 500) {
          files.push({
            path: relPath,
            content: content.slice(0, remaining) + '\n\n// ... [truncated due to size limit]',
            size: remaining,
          });
          totalSize += remaining;
        }
        break;
      }

      files.push({ path: relPath, content, size });
      totalSize += size;
      
    } catch (error) {
      // Skip unreadable files
      console.log(`[Workspace] Could not read: ${relPath}`);
    }
  }

  return {
    files,
    totalSize,
    fileCount: files.length,
    workspaceRoot,
  };
}

/**
 * Format workspace context for LLM prompt
 */
export function formatWorkspaceContext(context: WorkspaceContext): string {
  if (context.files.length === 0) {
    return '';
  }

  const parts: string[] = [
    `## Workspace Context`,
    `Root: ${context.workspaceRoot}`,
    `Files: ${context.fileCount} (${Math.round(context.totalSize / 1024)}KB)`,
    '',
  ];

  for (const file of context.files) {
    parts.push(`### ${file.path}`);
    parts.push('```');
    parts.push(file.content);
    parts.push('```');
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Check if a file path looks like a binary file
 */
function isBinaryPath(filePath: string): boolean {
  const binaryExtensions = [
    '.exe', '.dll', '.bin', '.so', '.dylib',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.mp3', '.mp4', '.avi', '.mov', '.wav',
    '.woff', '.woff2', '.ttf', '.eot',
    '.pyc', '.pyo', '.class',
  ];
  
  const ext = filePath.toLowerCase().split('.').pop();
  return ext ? binaryExtensions.includes(`.${ext}`) : false;
}
