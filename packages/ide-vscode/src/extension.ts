/**
 * OpenBotMan VS Code Extension
 * 
 * Multi-Agent Diskussionen direkt in VS Code.
 */

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let jobsProvider: JobsTreeProvider;

// Active jobs being tracked
const activeJobs: Map<string, JobInfo> = new Map();

interface AgentInfo {
  name: string;
  role: string;
  status: 'waiting' | 'thinking' | 'complete' | 'error';
  durationMs?: number;
}

interface JobInfo {
  id: string;
  topic: string;
  status: string;
  currentRound?: number;
  maxRounds?: number;
  currentAgent?: string;
  agents?: AgentInfo[];
  startTime: number;
}

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
 * Check if server is running
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const { apiUrl } = getApiConfig();
    const response = await fetch(`${apiUrl}/health`, { 
      signal: AbortSignal.timeout(3000) 
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the OpenBotMan server in a terminal
 */
async function startServer(): Promise<boolean> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  // Try to find OpenBotMan in workspace or common locations
  let serverPath = '';
  
  if (workspaceFolders) {
    // Check if current workspace is OpenBotMan
    for (const folder of workspaceFolders) {
      const packageJsonPath = vscode.Uri.joinPath(folder.uri, 'package.json');
      try {
        const content = await vscode.workspace.fs.readFile(packageJsonPath);
        const pkg = JSON.parse(content.toString());
        if (pkg.name === 'openbotman' || pkg.name === '@openbotman/monorepo') {
          serverPath = folder.uri.fsPath;
          break;
        }
      } catch {
        // Not found, continue
      }
    }
  }
  
  // If not found in workspace, ask user or use default
  if (!serverPath) {
    const defaultPath = process.platform === 'win32' 
      ? 'C:\\Sources\\OpenBotMan'
      : '~/OpenBotMan';
    
    const result = await vscode.window.showInputBox({
      prompt: 'OpenBotMan Pfad (wo ist das Projekt?)',
      value: defaultPath,
      placeHolder: defaultPath,
    });
    
    if (!result) return false;
    serverPath = result;
  }
  
  // Create terminal and start server
  const terminal = vscode.window.createTerminal({
    name: 'OpenBotMan Server',
    cwd: serverPath,
  });
  
  terminal.show();
  
  // Windows vs Unix command
  if (process.platform === 'win32') {
    terminal.sendText('start-api.bat');
  } else {
    terminal.sendText('pnpm start');
  }
  
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check if server is now running
  const running = await isServerRunning();
  if (running) {
    vscode.window.showInformationMessage('OpenBotMan Server gestartet! ✅');
    statusBarItem.tooltip = 'Connected';
  }
  
  return running;
}

/**
 * Ensure server is running, offer to start if not
 */
async function ensureServerRunning(): Promise<boolean> {
  if (await isServerRunning()) {
    return true;
  }
  
  const action = await vscode.window.showWarningMessage(
    'OpenBotMan Server läuft nicht!',
    'Server starten',
    'Abbrechen'
  );
  
  if (action === 'Server starten') {
    return await startServer();
  }
  
  return false;
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
  
  // Jobs tree view
  jobsProvider = new JobsTreeProvider();
  vscode.window.registerTreeDataProvider('openbotman.jobs', jobsProvider);
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('openbotman.discuss', startDiscussion),
    vscode.commands.registerCommand('openbotman.reviewCode', reviewCode),
    vscode.commands.registerCommand('openbotman.analyzeProject', analyzeProject),
    vscode.commands.registerCommand('openbotman.agents.status', showStatus),
    vscode.commands.registerCommand('openbotman.startServer', startServer),
    vscode.commands.registerCommand('openbotman.refreshJobs', () => jobsProvider.refresh()),
  );
  
  outputChannel.appendLine('OpenBotMan extension activated!');
}

/**
 * Track a job and update TreeView
 */
function trackJob(jobId: string, topic: string): void {
  activeJobs.set(jobId, {
    id: jobId,
    topic: topic.slice(0, 50) + (topic.length > 50 ? '...' : ''),
    status: 'pending',
    startTime: Date.now(),
  });
  jobsProvider.refresh();
}

/**
 * Update job from API response
 */
function updateJobFromApi(jobId: string, data: any): void {
  const job = activeJobs.get(jobId);
  if (!job) return;
  
  job.status = data.status;
  job.currentRound = data.currentRound;
  job.maxRounds = data.maxRounds;
  job.currentAgent = data.currentAgent;
  job.agents = data.agents;
  
  jobsProvider.refresh();
}

/**
 * Remove completed job after delay
 */
function removeJobDelayed(jobId: string, delayMs: number = 30000): void {
  setTimeout(() => {
    activeJobs.delete(jobId);
    jobsProvider.refresh();
  }, delayMs);
}

/**
 * Poll job status with progress tracking
 */
async function pollJobWithProgress(
  apiUrl: string,
  apiKey: string,
  jobId: string,
  progress: vscode.Progress<{ message?: string }>,
  token: vscode.CancellationToken
): Promise<any> {
  let attempts = 0;
  const maxAttempts = 120;
  
  while (attempts < maxAttempts && !token.isCancellationRequested) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3s poll
    attempts++;
    
    const response = await fetch(`${apiUrl}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    
    const job = await response.json() as {
      status: string;
      progress?: string;
      currentAgent?: string;
      agents?: AgentInfo[];
      result?: string;
      error?: string;
      durationMs?: number;
      currentRound?: number;
      maxRounds?: number;
    };
    
    // Update our tracked job
    updateJobFromApi(jobId, job);
    
    // Build progress message
    let msg = job.progress || job.status;
    if (job.currentAgent) {
      msg = `${job.currentAgent} denkt nach...`;
    }
    if (job.agents) {
      const done = job.agents.filter(a => a.status === 'complete').length;
      const total = job.agents.length;
      msg = `${msg} (${done}/${total} Agents)`;
    }
    
    progress.report({ message: msg });
    
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
  
  await runAsyncJob(topic, requestBody, 'Experten-Diskussion');
}

/**
 * Review current file or selection
 */
async function reviewCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Keine Datei geöffnet');
    return;
  }
  
  const selection = editor.selection;
  const code = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);
  
  if (!code || code.trim().length === 0) {
    vscode.window.showWarningMessage('Kein Code zum Reviewen');
    return;
  }
  
  const fileName = editor.document.fileName.split(/[/\\]/).pop() || 'unknown';
  const language = editor.document.languageId;
  
  const topic = `Code Review für ${fileName} (${language}):

Analysiere diesen Code auf:
- Bugs und potenzielle Fehler
- Security-Probleme
- Performance-Optimierungen  
- Clean Code / Best Practices
- Verbesserungsvorschläge

\`\`\`${language}
${code}
\`\`\``;

  const requestBody = {
    topic,
    async: true,
    timeout: 120,
    agents: 3,
  };

  await runAsyncJob(topic, requestBody, `Code Review: ${fileName}`);
}

/**
 * Analyze current project
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
  
  const requestBody = {
    topic,
    workspace: workspacePath,
    include: ['**/*.ts', '**/*.js', '**/*.cs', '**/*.py', '**/*.java', '**/*.json', '**/*.yaml', '**/*.yml', '**/*.md'],
    maxContext: 200,
    async: true,
    timeout: 180,
    agents: 3,
  };

  await runAsyncJob(topic, requestBody, `${analysisType.label} - ${workspaceName}`);
}

/**
 * Run an async job with progress tracking
 */
async function runAsyncJob(
  topic: string,
  requestBody: Record<string, unknown>,
  title: string
): Promise<void> {
  // Check if server is running
  if (!await ensureServerRunning()) {
    return;
  }
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `OpenBotMan: ${title}`,
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
        
        // Track job in TreeView
        trackJob(jobId, topic);
        
        progress.report({ message: 'Job gestartet...' });
        
        const job = await pollJobWithProgress(apiUrl, apiKey, jobId, progress, token);
        
        if (!job) {
          if (token.isCancellationRequested) {
            vscode.window.showWarningMessage('Abgebrochen');
          } else {
            throw new Error('Timeout nach 10 Minuten');
          }
          activeJobs.delete(jobId);
          jobsProvider.refresh();
          return;
        }
        
        if (job.status === 'error') {
          throw new Error(job.error || 'Unbekannter Fehler');
        }
        
        outputChannel.appendLine(`\n${'='.repeat(60)}`);
        outputChannel.appendLine(title);
        outputChannel.appendLine(`${'='.repeat(60)}\n`);
        outputChannel.appendLine(job.result || '(Keine Antwort)');
        outputChannel.appendLine(`\nDauer: ${Math.round((job.durationMs || 0) / 1000)}s`);
        outputChannel.show();
        
        vscode.window.showInformationMessage(`${title} abgeschlossen!`, 'Ergebnis anzeigen')
          .then(action => { if (action) outputChannel.show(); });
        
        // Remove job from TreeView after 30s
        removeJobDelayed(jobId, 30000);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`OpenBotMan Fehler: ${message}`);
        outputChannel.appendLine(`ERROR: ${message}`);
      }
    }
  );
}

/**
 * Show OpenBotMan status
 */
async function showStatus() {
  const { apiUrl, apiKey } = getApiConfig();
  
  // Quick check without auto-start offer for status command
  const running = await isServerRunning();
  if (!running) {
    const action = await vscode.window.showWarningMessage(
      'OpenBotMan Server läuft nicht!',
      'Server starten',
      'OK'
    );
    if (action === 'Server starten') {
      await startServer();
    }
    return;
  }
  
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
 * Jobs Tree Data Provider
 */
class JobsTreeProvider implements vscode.TreeDataProvider<JobTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<JobTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  
  getTreeItem(element: JobTreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: JobTreeItem): JobTreeItem[] {
    if (!element) {
      // Root level: show jobs
      if (activeJobs.size === 0) {
        const empty = new JobTreeItem('Keine aktiven Jobs', '', 'none', vscode.TreeItemCollapsibleState.None);
        empty.iconPath = new vscode.ThemeIcon('info');
        return [empty];
      }
      
      return Array.from(activeJobs.values()).map(job => {
        const hasAgents = job.agents && job.agents.length > 0;
        const elapsed = Math.round((Date.now() - job.startTime) / 1000);
        
        const item = new JobTreeItem(
          job.topic,
          job.id,
          job.status,
          hasAgents ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
          job
        );
        
        // Job icon based on status
        if (job.status === 'running' || job.status === 'pending') {
          item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
        } else if (job.status === 'complete') {
          item.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
        } else if (job.status === 'error') {
          item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        }
        
        // Description with time and round info
        let desc = `${job.status}, ${elapsed}s`;
        if (job.currentRound && job.maxRounds) {
          desc = `Runde ${job.currentRound}/${job.maxRounds}, ${elapsed}s`;
        }
        item.description = desc;
        
        return item;
      });
    }
    
    // Child level: show agents
    if (element.job?.agents) {
      return element.job.agents.map(agent => {
        const duration = agent.durationMs ? `${Math.round(agent.durationMs / 1000)}s` : '';
        
        // Status text
        let statusText = '';
        if (agent.status === 'thinking') {
          statusText = 'denkt nach...';
        } else if (agent.status === 'complete' && duration) {
          statusText = duration;
        } else if (agent.status === 'waiting') {
          statusText = 'wartet';
        } else if (agent.status === 'error') {
          statusText = 'Fehler';
        }
        
        const item = new JobTreeItem(
          agent.name,
          agent.name,
          agent.status,
          vscode.TreeItemCollapsibleState.None
        );
        
        item.description = statusText;
        
        // Set icon based on agent status
        if (agent.status === 'thinking') {
          item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
        } else if (agent.status === 'complete') {
          item.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
        } else if (agent.status === 'error') {
          item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        } else {
          item.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
        }
        
        return item;
      });
    }
    
    return [];
  }
}

/**
 * Job Tree Item
 */
class JobTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly jobId: string,
    public readonly status: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly job?: JobInfo
  ) {
    super(label, collapsibleState);
  }
}

/**
 * Deactivate extension
 */
export function deactivate() {
  outputChannel?.appendLine('OpenBotMan extension deactivated');
}
