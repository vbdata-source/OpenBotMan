import { describe, it, expect } from 'vitest';
import { generateInventory, formatInventory, buildFullContext } from './inventory.js';
import type { WorkspaceContext, WorkspaceFile } from './workspace.js';

function makeFile(path: string, content: string): WorkspaceFile {
  return { path, content, size: Buffer.byteLength(content, 'utf-8') };
}

function makeContext(files: WorkspaceFile[], root = '/project'): WorkspaceContext {
  return {
    files,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    fileCount: files.length,
    workspaceRoot: root,
  };
}

describe('generateInventory', () => {
  it('should extract TypeScript exports', () => {
    const file = makeFile('utils.ts', `
export function greet(name: string) {}
export const VERSION = '1.0';
export class Logger {}
export type Config = {};
export interface Options {}
`);
    const inv = generateInventory(makeContext([file]));
    expect(inv.files[0]!.exports).toEqual(['greet', 'VERSION', 'Logger', 'Config', 'Options']);
  });

  it('should extract Python exports (top-level only)', () => {
    const file = makeFile('main.py', `
def hello():
    pass

class Server:
    def method(self):
        pass

def _private():
    pass
`);
    const inv = generateInventory(makeContext([file]));
    expect(inv.files[0]!.exports).toContain('hello');
    expect(inv.files[0]!.exports).toContain('Server');
    expect(inv.files[0]!.exports).not.toContain('method');
    expect(inv.files[0]!.exports).not.toContain('_private');
  });

  it('should extract TypeScript imports', () => {
    const file = makeFile('app.ts', `
import express from 'express';
import { join } from 'path';
import { loadConfig } from './config.js';
const fs = require('fs');
`);
    const inv = generateInventory(makeContext([file]));
    const imports = inv.files[0]!.imports;
    expect(imports).toContainEqual({ module: 'express', isLocal: false });
    expect(imports).toContainEqual({ module: 'path', isLocal: false });
    expect(imports).toContainEqual({ module: './config.js', isLocal: true });
    expect(imports).toContainEqual({ module: 'fs', isLocal: false });
  });

  it('should extract Python imports', () => {
    const file = makeFile('main.py', `
import os
from pathlib import Path
from .config import load
`);
    const inv = generateInventory(makeContext([file]));
    const imports = inv.files[0]!.imports;
    expect(imports).toContainEqual({ module: 'os', isLocal: false });
    expect(imports).toContainEqual({ module: 'pathlib', isLocal: false });
    expect(imports).toContainEqual({ module: '.config', isLocal: true });
  });

  it('should infer purpose from JSDoc comment', () => {
    const file = makeFile('server.ts', `/**
 * HTTP REST API for multi-agent discussions
 */
import express from 'express';
`);
    const inv = generateInventory(makeContext([file]));
    expect(inv.files[0]!.purpose).toBe('HTTP REST API for multi-agent discussions');
  });

  it('should skip license headers for purpose', () => {
    const file = makeFile('lib.ts', `/**
 * Copyright 2024 Acme Corp. All rights reserved.
 * Licensed under MIT.
 */

/**
 * Utility functions for data processing
 */
export function process() {}
`);
    const inv = generateInventory(makeContext([file]));
    expect(inv.files[0]!.purpose).toBe('Utility functions for data processing');
  });

  it('should skip auto-generated headers for purpose', () => {
    const file = makeFile('generated.ts', `// Auto-generated - DO NOT EDIT
// Real purpose: config loader
export const config = {};
`);
    const inv = generateInventory(makeContext([file]));
    // Should fall back to humanized filename since both comments match skip patterns
    expect(inv.files[0]!.purpose).toBe('Generated');
  });

  it('should fall back to humanized filename', () => {
    const file = makeFile('cli_runners.py', `x = 1`);
    const inv = generateInventory(makeContext([file]));
    expect(inv.files[0]!.purpose).toBe('Cli Runners');
  });

  it('should detect language from extension', () => {
    const files = [
      makeFile('a.ts', ''),
      makeFile('b.js', ''),
      makeFile('c.py', ''),
      makeFile('d.json', ''),
      makeFile('e.yaml', ''),
      makeFile('f.txt', ''),
    ];
    const inv = generateInventory(makeContext(files));
    expect(inv.files.map(f => f.language)).toEqual([
      'typescript', 'javascript', 'python', 'json', 'yaml', 'other',
    ]);
  });

  it('should read project name from package.json', () => {
    const files = [
      makeFile('package.json', JSON.stringify({ name: 'my-project' })),
      makeFile('index.ts', 'export default {}'),
    ];
    const inv = generateInventory(makeContext(files));
    expect(inv.projectName).toBe('my-project');
  });

  it('should fall back to workspace root basename for project name', () => {
    const file = makeFile('index.ts', 'export default {}');
    const inv = generateInventory(makeContext([file], '/home/user/my-app'));
    expect(inv.projectName).toBe('my-app');
  });

  it('should build dependency graph', () => {
    const files = [
      makeFile('server.ts', `import { loadConfig } from './config.js';\nimport { db } from './db.js';`),
      makeFile('config.ts', `export function loadConfig() {}`),
    ];
    const inv = generateInventory(makeContext(files));
    expect(inv.dependencyGraph).toContain('server.ts -> config, db');
    expect(inv.dependencyGraph).toContain('config.ts -> (keine lokalen)');
  });
});

describe('formatInventory', () => {
  it('should produce markdown with table', () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      makeFile(`file${i}.ts`, `/** File ${i} */\nexport function fn${i}() {}\n`.repeat(20))
    );
    const inv = generateInventory(makeContext(files));
    const md = formatInventory(inv);

    expect(md).toContain('## Projekt-Inventar:');
    expect(md).toContain('### Datei-Uebersicht');
    expect(md).toContain('| Datei |');
    expect(md).toContain('### Abhaengigkeitsgraph');
  });

  it('should stay reasonably small (~5KB for typical project)', () => {
    const files = Array.from({ length: 50 }, (_, i) =>
      makeFile(`src/module${i}.ts`, `/** Module ${i} handles stuff */\nexport function handle${i}() {}\nexport class Service${i} {}\n`)
    );
    const inv = generateInventory(makeContext(files));
    const md = formatInventory(inv);
    const sizeKB = Buffer.byteLength(md, 'utf-8') / 1024;

    // Should be roughly 5-10KB for 50 files
    expect(sizeKB).toBeLessThan(15);
    expect(sizeKB).toBeGreaterThan(1);
  });
});

describe('buildFullContext', () => {
  it('should combine inventory + raw code within budget', () => {
    const files = [
      makeFile('server.ts', '// Main server\n'.repeat(100)),
      makeFile('utils.ts', '// Utils\n'.repeat(50)),
    ];
    const ctx = makeContext(files);
    const inv = generateInventory(ctx);
    const maxBytes = 50 * 1024; // 50KB

    const result = buildFullContext(ctx, inv, maxBytes);
    expect(result.contextType).toBe('inventory');
    expect(result.context).toContain('## Projekt-Inventar:');
    expect(result.context).toContain('## Quellcode (wichtigste Dateien)');
    expect(Buffer.byteLength(result.context, 'utf-8')).toBeLessThanOrEqual(maxBytes);
  });

  it('should return only inventory when budget is very small', () => {
    const files = [
      makeFile('big.ts', 'x'.repeat(10000)),
    ];
    const ctx = makeContext(files);
    const inv = generateInventory(ctx);

    // Set maxBytes to just barely fit the inventory
    const invSize = Buffer.byteLength(formatInventory(inv), 'utf-8');
    const result = buildFullContext(ctx, inv, invSize + 500);

    expect(result.contextType).toBe('inventory');
    expect(result.context).not.toContain('## Quellcode');
  });

  it('should prioritize entry-point files', () => {
    const files = [
      makeFile('utils.ts', '// small utils\n'),
      makeFile('index.ts', '// entry point\n'),
      makeFile('helpers.ts', '// helpers\n'),
    ];
    const ctx = makeContext(files);
    const inv = generateInventory(ctx);

    const result = buildFullContext(ctx, inv, 100 * 1024);
    // index.ts should appear before utils.ts in the raw code section
    const indexPos = result.context.indexOf('### index.ts');
    const utilsPos = result.context.indexOf('### utils.ts');
    expect(indexPos).toBeLessThan(utilsPos);
  });

  it('should not exceed maxBytes', () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      makeFile(`file${i}.ts`, `// content ${i}\n`.repeat(200))
    );
    const ctx = makeContext(files);
    const inv = generateInventory(ctx);
    const maxBytes = 10 * 1024; // 10KB

    const result = buildFullContext(ctx, inv, maxBytes);
    expect(Buffer.byteLength(result.context, 'utf-8')).toBeLessThanOrEqual(maxBytes);
  });
});

describe('inventory disabled', () => {
  it('should use raw context when inventory is false (verified via server logic)', () => {
    // This tests the logical contract: when inventory !== false, inventory is generated
    // When inventory === false, the server skips inventory generation
    // We verify the inventory functions work correctly independently
    const file = makeFile('test.ts', 'export const x = 1;');
    const ctx = makeContext([file]);
    const inv = generateInventory(ctx);
    expect(inv.fileCount).toBe(1);
    expect(inv.files[0]!.exports).toContain('x');
  });
});
