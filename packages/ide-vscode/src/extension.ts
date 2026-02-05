/**
 * OpenBotMan VS Code Extension
 * 
 * Integrates multi-agent orchestration into VS Code.
 */

import * as vscode from 'vscode';

/**
 * API client for OpenBotMan (using native fetch)
 */
class OpenBotManClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
  }
  
  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
  
  async chat(message: string): Promise<string> {
    const data = await this.request('POST', '/chat', { message }) as { response: string };
    return data.response;
  }
  
  async orchestrate(task: string, options?: { agents?: string[]; workflow?: string }): Promise<string> {
    const data = await this.request('POST', '/orchestrate', { task, ...options }) as { result: string };
    return data.result;
  }
  
  async getAgents(): Promise<Array<{ id: string; role: string; status: string }>> {
    const data = await this.request('GET', '/agents') as { agents: Array<{ id: string; role: string; status: string }> };
    return data.agents || [];
  }
  
  async getStatus(): Promise<Record<string, unknown>> {
    return await this.request('GET', '/health') as Record<string, unknown>;
  }
  
  async queryKnowledge(query: string): Promise<Array<{ title: string; content: string; score: number }>> {
    const data = await this.request('POST', '/knowledge/query', { query }) as { results: Array<{ title: string; content: string; score: number }> };
    return data.results || [];
  }
}

let client: OpenBotManClient;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

/**
 * Activate extension
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('OpenBotMan');
  outputChannel.appendLine('OpenBotMan extension starting...');
  
  // Initialize client
  const config = vscode.workspace.getConfiguration('openbotman');
  const apiUrl = config.get<string>('apiUrl') || 'http://localhost:8080';
  const apiKey = config.get<string>('apiKey');
  client = new OpenBotManClient(apiUrl, apiKey);
  
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(robot) OpenBotMan';
  statusBarItem.command = 'openbotman.agents.status';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('openbotman.chat', chatWithAgents),
    vscode.commands.registerCommand('openbotman.orchestrate', orchestrateTask),
    vscode.commands.registerCommand('openbotman.review', reviewCode),
    vscode.commands.registerCommand('openbotman.discuss', startDiscussion),
    vscode.commands.registerCommand('openbotman.analyzeProject', analyzeProject),
    vscode.commands.registerCommand('openbotman.knowledge.query', queryKnowledge),
    vscode.commands.registerCommand('openbotman.agents.status', showAgentStatus),
  );
  
  // Register tree views
  const agentsProvider = new AgentsTreeProvider();
  vscode.window.registerTreeDataProvider('openbotman.agents', agentsProvider);
  
  outputChannel.appendLine('OpenBotMan extension activated successfully!');
}

/**
 * Chat with agents
 */
async function chatWithAgents() {
  const message = await vscode.window.showInputBox({
    prompt: 'What would you like to ask the agents?',
    placeHolder: 'e.g., Explain this code / Implement a feature / ...',
  });
  
  if (!message) return;
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'OpenBotMan is thinking...',
      cancellable: false,
    },
    async () => {
      try {
        const response = await client.chat(message);
        
        outputChannel.appendLine(`\n--- Chat ---`);
        outputChannel.appendLine(`You: ${message}`);
        outputChannel.appendLine(`OpenBotMan: ${response}`);
        outputChannel.show();
        
        vscode.window.showInformationMessage(
          response.length > 200 ? response.slice(0, 200) + '...' : response,
          'Show Full Response'
        ).then(action => {
          if (action) outputChannel.show();
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `OpenBotMan error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

/**
 * Orchestrate a task
 */
async function orchestrateTask() {
  const task = await vscode.window.showInputBox({
    prompt: 'What task should the agents orchestrate?',
    placeHolder: 'e.g., Implement user authentication with OAuth2',
  });
  
  if (!task) return;
  
  const workflowPick = await vscode.window.showQuickPick(
    ['Dynamic (let orchestrator decide)', 'Code Review', 'Feature Development'],
    { placeHolder: 'Select workflow' }
  );
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Orchestrating task...',
      cancellable: false,
    },
    async () => {
      try {
        const workflow = workflowPick === 'Code Review' ? 'code_review' :
                        workflowPick === 'Feature Development' ? 'feature_development' :
                        undefined;
        
        const result = await client.orchestrate(task, { workflow });
        
        outputChannel.appendLine(`\n--- Orchestration ---`);
        outputChannel.appendLine(`Task: ${task}`);
        outputChannel.appendLine(`Workflow: ${workflow || 'dynamic'}`);
        outputChannel.appendLine(`Result:\n${result}`);
        outputChannel.show();
        
        vscode.window.showInformationMessage('Task orchestration complete!', 'Show Results')
          .then(action => { if (action) outputChannel.show(); });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Orchestration error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

/**
 * Review current code
 */
async function reviewCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }
  
  const selection = editor.selection;
  const code = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);
  
  if (!code) {
    vscode.window.showWarningMessage('No code to review');
    return;
  }
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Reviewing code...',
      cancellable: false,
    },
    async () => {
      try {
        const task = `Review this ${editor.document.languageId} code:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
        const result = await client.orchestrate(task, { workflow: 'code_review' });
        
        outputChannel.appendLine(`\n--- Code Review ---`);
        outputChannel.appendLine(`File: ${editor.document.fileName}`);
        outputChannel.appendLine(`\n${result}`);
        outputChannel.show();
        
        vscode.window.showInformationMessage('Code review complete!', 'Show Review')
          .then(action => { if (action) outputChannel.show(); });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Review error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
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
): Promise<{ status: string; result?: string; error?: string; durationMs?: number; actionItems?: string[] } | null> {
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max
  
  while (attempts < maxAttempts && !token.isCancellationRequested) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
    
    const response = await fetch(`${apiUrl}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    
    const job = await response.json() as { status: string; result?: string; error?: string; durationMs?: number; actionItems?: string[] };
    progress.report({ message: `Status: ${job.status} (${attempts * 5}s)` });
    
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
    placeHolder: 'z.B. Analysiere dieses Projekt auf Verbesserungsmöglichkeiten',
  });
  
  if (!topic) return;
  
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePath = workspaceFolders?.[0]?.uri.fsPath;
  
  let includeWorkspace = false;
  if (workspacePath) {
    const choice = await vscode.window.showQuickPick(
      ['Ja, Projektdateien einbeziehen', 'Nein, nur die Frage'],
      { placeHolder: 'Soll das aktuelle Projekt analysiert werden?' }
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
    requestBody.include = ['**/*.ts', '**/*.js', '**/*.json', '**/*.cs', '**/*.py'];
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
        const config = vscode.workspace.getConfiguration('openbotman');
        const apiUrl = (config.get<string>('apiUrl') || 'http://localhost:8080').replace(/\/$/, '');
        const apiKey = config.get<string>('apiKey') || 'local-dev-key';
        
        const startResponse = await fetch(`${apiUrl}/api/v1/discuss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(requestBody),
        });
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
        outputChannel.appendLine(`Topic: ${topic}`);
        outputChannel.appendLine(`${'='.repeat(60)}\n`);
        outputChannel.appendLine(job.result || '(No result)');
        
        if (job.actionItems && job.actionItems.length > 0) {
          outputChannel.appendLine(`\n--- Action Items ---`);
          job.actionItems.forEach((item: string) => outputChannel.appendLine(`- ${item}`));
        }
        
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
        const config = vscode.workspace.getConfiguration('openbotman');
        const apiUrl = (config.get<string>('apiUrl') || 'http://localhost:8080').replace(/\/$/, '');
        const apiKey = config.get<string>('apiKey') || 'local-dev-key';
        
        const startResponse = await fetch(`${apiUrl}/api/v1/discuss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            topic,
            workspace: workspacePath,
            include: ['**/*.ts', '**/*.js', '**/*.cs', '**/*.py', '**/*.java', '**/*.json', '**/*.yaml', '**/*.yml'],
            maxContext: 200,
            async: true,
            timeout: 180,
            agents: 3,
          }),
        });
        
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
        outputChannel.appendLine(`🔍 ${analysisType.label} - ${workspaceName}`);
        outputChannel.appendLine(`${'='.repeat(60)}\n`);
        outputChannel.appendLine(job.result || '(No result)');
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
 * Query knowledge base
 */
async function queryKnowledge() {
  const query = await vscode.window.showInputBox({
    prompt: 'Search the knowledge base',
    placeHolder: 'e.g., OAuth2 best practices',
  });
  
  if (!query) return;
  
  try {
    const results = await client.queryKnowledge(query);
    
    if (results.length === 0) {
      vscode.window.showInformationMessage('No results found');
      return;
    }
    
    const items = results.map(r => ({
      label: r.title,
      description: `Score: ${(r.score * 100).toFixed(0)}%`,
      detail: r.content.slice(0, 100) + '...',
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select result to view',
    });
    
    if (selected) {
      const result = results.find(r => r.title === selected.label);
      if (result) {
        outputChannel.appendLine(`\n--- Knowledge: ${result.title} ---`);
        outputChannel.appendLine(result.content);
        outputChannel.show();
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Query error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Show agent status
 */
async function showAgentStatus() {
  try {
    const status = await client.getStatus();
    
    outputChannel.appendLine(`\n--- OpenBotMan Status ---`);
    outputChannel.appendLine(JSON.stringify(status, null, 2));
    outputChannel.show();
    
    statusBarItem.tooltip = 'Connected';
    vscode.window.showInformationMessage('OpenBotMan: Connected!');
  } catch (error) {
    vscode.window.showErrorMessage(
      `Status error: ${error instanceof Error ? error.message : String(error)}`
    );
    statusBarItem.tooltip = 'Not connected';
  }
}

/**
 * Tree data provider for agents view
 */
class AgentsTreeProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  
  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }
  
  async getChildren(): Promise<AgentItem[]> {
    try {
      const agents = await client.getAgents();
      return agents.map(a => new AgentItem(
        a.id,
        a.role,
        vscode.TreeItemCollapsibleState.None
      ));
    } catch {
      return [new AgentItem('Not connected', 'Click status to test', vscode.TreeItemCollapsibleState.None)];
    }
  }
}

/**
 * Agent tree item
 */
class AgentItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly role: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(id, collapsibleState);
    this.description = role;
    this.iconPath = new vscode.ThemeIcon(role === 'error' ? 'error' : 'robot');
  }
}

/**
 * Deactivate extension
 */
export function deactivate() {
  outputChannel?.appendLine('OpenBotMan extension deactivated');
}
