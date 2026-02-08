/**
 * Workspace Context Loading
 * 
 * Loads files from a workspace directory for context in discussions.
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
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
 * Default ignore patterns (build artifacts, dependencies)
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
 * SENSITIVE FILE PATTERNS - Always ignored, cannot be overridden!
 * These files may contain secrets and should NEVER be sent to LLMs.
 */
const SENSITIVE_FILE_PATTERNS = [
  '**/.env',
  '**/.env.*',
  '**/.env.local',
  '**/.env.production',
  '**/.env.development',
  '**/secrets.*',
  '**/secrets/**',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/*.crt',
  '**/*.cer',
  '**/id_rsa*',
  '**/id_ed25519*',
  '**/*.secret',
  '**/credentials.*',
  '**/auth.json',
  '**/config.local.*',
  '**/.npmrc',
  '**/.pypirc',
];

/**
 * BLOCKED SYSTEM PATHS - Prevent reading system directories
 */
const BLOCKED_PATH_PREFIXES_UNIX = [
  '/etc',
  '/var',
  '/usr',
  '/bin',
  '/sbin',
  '/root',
  '/sys',
  '/proc',
];

const BLOCKED_PATH_PREFIXES_WINDOWS = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
];

/**
 * Validate workspace path is safe to read
 */
export function validateWorkspacePath(workspacePath: string): { valid: boolean; error?: string } {
  // Check if path exists
  if (!existsSync(workspacePath)) {
    return { valid: false, error: `Pfad existiert nicht: ${workspacePath}` };
  }

  // Normalize path for comparison
  const normalizedPath = workspacePath.replace(/\\/g, '/').toLowerCase();

  // Check against blocked Unix paths
  for (const blocked of BLOCKED_PATH_PREFIXES_UNIX) {
    if (normalizedPath.startsWith(blocked.toLowerCase())) {
      return { valid: false, error: `Systempfad nicht erlaubt: ${blocked}` };
    }
  }

  // Check against blocked Windows paths
  for (const blocked of BLOCKED_PATH_PREFIXES_WINDOWS) {
    const normalizedBlocked = blocked.replace(/\\/g, '/').toLowerCase();
    if (normalizedPath.startsWith(normalizedBlocked)) {
      return { valid: false, error: `Systempfad nicht erlaubt: ${blocked}` };
    }
  }

  return { valid: true };
}

/**
 * File info for preview (without content)
 */
export interface FilePreview {
  path: string;
  size: number;
  lines?: number;
}

/**
 * Get file list preview (without loading content)
 */
export async function getWorkspacePreview(
  workspaceRoot: string,
  patterns: string[],
  customIgnore: string[] = []
): Promise<{ files: FilePreview[]; error?: string }> {
  // Validate path first
  const validation = validateWorkspacePath(workspaceRoot);
  if (!validation.valid) {
    return { files: [], error: validation.error };
  }

  // Combine all ignore patterns
  const allIgnore = [...DEFAULT_IGNORE, ...SENSITIVE_FILE_PATTERNS, ...customIgnore];

  try {
    const matchedFiles = await fg(patterns, {
      cwd: workspaceRoot,
      absolute: false,
      onlyFiles: true,
      ignore: allIgnore,
      dot: false,
    });

    // Limit to first 100 files for preview
    const limitedFiles = matchedFiles.slice(0, 100).sort();

    const previews: FilePreview[] = [];
    for (const relPath of limitedFiles) {
      const fullPath = join(workspaceRoot, relPath);
      try {
        const stat = statSync(fullPath);
        previews.push({
          path: relPath,
          size: stat.size,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return { files: previews };
  } catch (error) {
    return { files: [], error: error instanceof Error ? error.message : 'Fehler beim Laden' };
  }
}

/**
 * Load files matching glob patterns from a workspace
 */
export async function loadWorkspaceContext(
  workspaceRoot: string,
  patterns: string[],
  maxBytes: number = 100 * 1024, // 100KB default
  customIgnore: string[] = []
): Promise<WorkspaceContext> {
  const files: WorkspaceFile[] = [];
  let totalSize = 0;

  // Validate workspace path
  const validation = validateWorkspacePath(workspaceRoot);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Combine all ignore patterns - SENSITIVE_FILE_PATTERNS are ALWAYS included!
  const allIgnore = [...DEFAULT_IGNORE, ...SENSITIVE_FILE_PATTERNS, ...customIgnore];

  // Find matching files
  const matchedFiles = await fg(patterns, {
    cwd: workspaceRoot,
    absolute: false,
    onlyFiles: true,
    ignore: allIgnore,
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
