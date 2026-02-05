/**
 * OpenBotMan VS Code Extension
 * 
 * Multi-Agent Diskussionen direkt in VS Code.
 */

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

/**
 * Get configured API settings
 */
function getApiConfig(): { apiUrl: string; apiKey: string } {
  const config = vscode.workspace.getConfiguration('openbotman');
  return {
    apiUrl: (config.get<string>('apiUrl') || 'http://localhost:8080').replace(/\/$/, ''),
    apiKey: config.get<string>('apiKey') || '',
  };
}

/**
 * Activate extension
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('OpenBotMan');
  outputChannel.appendLine('OpenBotMan extension starting...');
  
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(robot) OpenBotMan';
  statusBarItem.command = 'openbotman.agents.status';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('openbotman.discuss', startDiscussion),
    vscode.commands.registerCommand('openbotman.analyzeProject', analyzeProject),
    vscode.commands.registerCommand('openbotman.agents.status', showStatus),
  );
  
  outputChannel.appendLine('OpenBotMan extension activated!');
}

/**
 * Helper to poll job status
 */
async function pollJobStatus(
  apiUrl: string,
  apiKey: string,
  jobId: string,
  progress: vscode.Progress<{ message?: string }>,
  token: vscode.CancellationToken
): Promise<{ status: string; result?: string; error?: string; durationMs?: number } | null> {
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max
  
  while (attempts < maxAttempts && !token.isCancellationRequested) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
    
    const response = await fetch(`${apiUrl}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    
    const job = await response.json() as { status: string; result?: string; error?: string; durationMs?: number };
    progress.report({ message: `${job.status} (${attempts * 5}s)` });
    
    if (job.status === 'complete' || job.status === 'error') {
      return job;
    }
  }
  
  return null;
}

/**
 * Start a discussion with OpenBotMan experts
 */
async function startDiscussion() {
  const topic = await vscode.window.showInputBox({
    prompt: 'Was sollen die Experten diskutieren?',
    placeHolder: 'z.B. Wie implementiere ich Rate-Limiting in Node.js?',
  });
  
  if (!topic) return;
  
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePath = workspaceFolders?.[0]?.uri.fsPath;
  
  let includeWorkspace = false;
  if (workspacePath) {
    const choice = await vscode.window.showQuickPick(
      ['Ja, Projektdateien einbeziehen', 'Nein, nur die Frage'],
      { placeHolder: 'Soll das aktuelle Projekt als Kontext verwendet werden?' }
    );
    includeWorkspace = choice?.startsWith('Ja') ?? false;
  }
  
  const requestBody: Record<string, unknown> = {
    topic,
    async: true,
    timeout: 120,
    agents: 3,
  };
  
  if (includeWorkspace && workspacePath) {
    requestBody.workspace = workspacePath;
    requestBody.include = ['**/*.ts', '**/*.js', '**/*.json', '**/*.cs', '**/*.py', '**/*.md'];
    requestBody.maxContext = 200;
  }
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'OpenBotMan Experten diskutieren...',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const { apiUrl, apiKey } = getApiConfig();
        
        if (!apiKey) {
          vscode.window.showErrorMessage('Bitte API Key in den Settings konfigurieren!');
          return;
        }
        
        const startResponse = await fetch(`${apiUrl}/api/v1/discuss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(requestBody),
        });
        
        if (!startResponse.ok) {
          throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
        }
        
        const startData = await startResponse.json() as { id: string };
        const jobId = startData.id;
        progress.report({ message: `Job gestartet: ${jobId.slice(0, 8)}...` });
        
        const job = await pollJobStatus(apiUrl, apiKey, jobId, progress, token);
        
        if (!job) {
          if (token.isCancellationRequested) {
            vscode.window.showWarningMessage('Diskussion abgebrochen');
          } else {
            throw new Error('Timeout nach 10 Minuten');
          }
          return;
        }
        
        if (job.status === 'error') {
          throw new Error(job.error || 'Unbekannter Fehler');
        }
        
        outputChannel.appendLine(`\n${'='.repeat(60)}`);
        outputChannel.appendLine(`OpenBotMan Experten-Diskussion`);
        outputChannel.appendLine(`Frage: ${topic}`);
        outputChannel.appendLine(`${'='.repeat(60)}\n`);
        outputChannel.appendLine(job.result || '(Keine Antwort)');
        outputChannel.appendLine(`\nDauer: ${Math.round((job.durationMs || 0) / 1000)}s`);
        outputChannel.show();
        
        vscode.window.showInformationMessage('Experten-Diskussion abgeschlossen!', 'Ergebnis anzeigen')
          .then(action => { if (action) outputChannel.show(); });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`OpenBotMan Fehler: ${message}`);
        outputChannel.appendLine(`ERROR: ${message}`);
      }
    }
  );
}

/**
 * Analyze current project with OpenBotMan experts
 */
async function analyzeProject() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('Kein Workspace geöffnet');
    return;
  }
  
  const workspacePath = workspaceFolders[0].uri.fsPath;
  const workspaceName = workspaceFolders[0].name;
  
  const analysisType = await vscode.window.showQuickPick([
    { label: '🔍 Vollständige Analyse', value: 'full', description: 'Architektur, Code-Qualität, Security, Performance' },
    { label: '🛡️ Security Review', value: 'security', description: 'Sicherheitslücken und Best Practices' },
    { label: '⚡ Performance', value: 'performance', description: 'Performance-Probleme und Optimierungen' },
    { label: '🧹 Code-Qualität', value: 'quality', description: 'Clean Code, DRY, SOLID' },
    { label: '🏗️ Architektur', value: 'architecture', description: 'Struktur und Design Patterns' },
  ], { placeHolder: 'Welche Analyse soll durchgeführt werden?' });
  
  if (!analysisType) return;
  
  const topics: Record<string, string> = {
    full: `Analysiere das Projekt "${workspaceName}" umfassend: Architektur, Code-Qualität, Security, Performance, Testbarkeit. Gib konkrete Verbesserungsvorschläge.`,
    security: `Führe einen Security-Review für "${workspaceName}" durch. Finde Sicherheitslücken, SQL Injection, XSS, Authentication-Probleme.`,
    performance: `Analysiere "${workspaceName}" auf Performance-Probleme: N+1 Queries, Memory Leaks, Caching-Möglichkeiten.`,
    quality: `Prüfe "${workspaceName}" auf Code-Qualität: DRY-Verletzungen, SOLID-Prinzipien, Code Smells, Refactoring-Möglichkeiten.`,
    architecture: `Bewerte die Architektur von "${workspaceName}": Schichttrennung, Design Patterns, Modularität, Erweiterbarkeit.`,
  };
  
  const topic = topics[analysisType.value];
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `OpenBotMan analysiert ${workspaceName}...`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const { apiUrl, apiKey } = getApiConfig();
        
        if (!apiKey) {
          vscode.window.showErrorMessage('Bitte API Key in den Settings konfigurieren!');
          return;
        }
        
        const startResponse = await fetch(`${apiUrl}/api/v1/discuss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            topic,
            workspace: workspacePath,
            include: ['**/*.ts', '**/*.js', '**/*.cs', '**/*.py', '**/*.java', '**/*.json', '**/*.yaml', '**/*.yml', '**/*.md'],
            maxContext: 200,
            async: true,
            timeout: 180,
            agents: 3,
          }),
        });
        
        if (!startResponse.ok) {
          throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
        }
        
        const startData = await startResponse.json() as { id: string };
        const jobId = startData.id;
        progress.report({ message: 'Experten analysieren...' });
        
        const job = await pollJobStatus(apiUrl, apiKey, jobId, progress, token);
        
        if (!job) {
          if (token.isCancellationRequested) {
            vscode.window.showWarningMessage('Analyse abgebrochen');
          }
          return;
        }
        
        if (job.status === 'error') {
          throw new Error(job.error || 'Analyse fehlgeschlagen');
        }
        
        outputChannel.appendLine(`\n${'='.repeat(60)}`);
        outputChannel.appendLine(`${analysisType.label} - ${workspaceName}`);
        outputChannel.appendLine(`${'='.repeat(60)}\n`);
        outputChannel.appendLine(job.result || '(Keine Antwort)');
        outputChannel.appendLine(`\nDauer: ${Math.round((job.durationMs || 0) / 1000)}s`);
        outputChannel.show();
        
        vscode.window.showInformationMessage(`${analysisType.label} abgeschlossen!`, 'Ergebnis anzeigen')
          .then(action => { if (action) outputChannel.show(); });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Analyse-Fehler: ${message}`);
      }
    }
  );
}

/**
 * Show OpenBotMan status
 */
async function showStatus() {
  const { apiUrl, apiKey } = getApiConfig();
  
  try {
    const response = await fetch(`${apiUrl}/health`);
    const status = await response.json() as { status: string; version: string; uptime: number; providers: Array<{ name: string; available: boolean }> };
    
    outputChannel.appendLine(`\n--- OpenBotMan Status ---`);
    outputChannel.appendLine(`URL: ${apiUrl}`);
    outputChannel.appendLine(`Status: ${status.status}`);
    outputChannel.appendLine(`Version: ${status.version}`);
    outputChannel.appendLine(`Uptime: ${status.uptime}s`);
    outputChannel.appendLine(`Providers: ${status.providers?.map(p => `${p.name} (${p.available ? '✓' : '✗'})`).join(', ') || 'none'}`);
    outputChannel.appendLine(`API Key: ${apiKey ? '✓ konfiguriert' : '✗ fehlt!'}`);
    outputChannel.show();
    
    statusBarItem.tooltip = `${status.status} | ${status.version}`;
    
    if (!apiKey) {
      vscode.window.showWarningMessage('OpenBotMan: API Key nicht konfiguriert!', 'Settings öffnen')
        .then(action => { if (action) vscode.commands.executeCommand('workbench.action.openSettings', 'openbotman'); });
    } else {
      vscode.window.showInformationMessage(`OpenBotMan: ${status.status} (${status.version})`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Verbindung fehlgeschlagen: ${message}`);
    statusBarItem.tooltip = 'Nicht verbunden';
  }
}

/**
 * Deactivate extension
 */
export function deactivate() {
  outputChannel?.appendLine('OpenBotMan extension deactivated');
}
