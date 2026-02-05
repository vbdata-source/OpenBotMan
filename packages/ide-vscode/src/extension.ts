/**
 * OpenBotMan VS Code Extension
 * 
 * Integrates multi-agent orchestration into VS Code.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

/**
 * API client for OpenBotMan
 */
class OpenBotManClient {
  private client: AxiosInstance;
  
  constructor(baseUrl: string, apiKey?: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
  }
  
  async chat(message: string): Promise<string> {
    const response = await this.client.post('/chat', { message });
    return response.data.response;
  }
  
  async orchestrate(task: string, options?: { agents?: string[]; workflow?: string }): Promise<string> {
    const response = await this.client.post('/orchestrate', { task, ...options });
    return response.data.result;
  }
  
  async getAgents(): Promise<Array<{ id: string; role: string; status: string }>> {
    const response = await this.client.get('/agents');
    return response.data.agents;
  }
  
  async getStatus(): Promise<Record<string, unknown>> {
    const response = await this.client.get('/status');
    return response.data;
  }
  
  async queryKnowledge(query: string): Promise<Array<{ title: string; content: string; score: number }>> {
    const response = await this.client.post('/knowledge/query', { query });
    return response.data.results;
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
  
  outputChannel.appendLine('OpenBotMan extension activated');
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
        
        // Show in output channel
        outputChannel.appendLine(`\n--- Chat ---`);
        outputChannel.appendLine(`You: ${message}`);
        outputChannel.appendLine(`OpenBotMan: ${response}`);
        outputChannel.show();
        
        // Also show as information message
        vscode.window.showInformationMessage(
          response.length > 200 ? response.slice(0, 200) + '...' : response,
          'Show Full Response'
        ).then(action => {
          if (action) {
            outputChannel.show();
          }
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
 * Start a discussion with OpenBotMan experts
 */
async function startDiscussion() {
  const topic = await vscode.window.showInputBox({
    prompt: 'Was sollen die Experten diskutieren?',
    placeHolder: 'z.B. Analysiere dieses Projekt auf Verbesserungsmöglichkeiten',
  });
  
  if (!topic) return;
  
  // Get workspace path
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePath = workspaceFolders?.[0]?.uri.fsPath;
  
  // Ask if workspace should be included
  let includeWorkspace = false;
  if (workspacePath) {
    const choice = await vscode.window.showQuickPick(
      ['Ja, Projektdateien einbeziehen', 'Nein, nur die Frage'],
      { placeHolder: 'Soll das aktuelle Projekt analysiert werden?' }
    );
    includeWorkspace = choice?.startsWith('Ja') ?? false;
  }
  
  // Build request
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
        // Start async job
        const config = vscode.workspace.getConfiguration('openbotman');
        const apiUrl = config.get<string>('apiUrl') || 'http://localhost:8080';
        const apiKey = config.get<string>('apiKey') || 'local-dev-key';
        
        const startResponse = await axios.post(
          `${apiUrl}/api/v1/discuss`,
          requestBody,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        
        const jobId = startResponse.data.id;
        progress.report({ message: `Job gestartet: ${jobId.slice(0, 8)}...` });
        
        // Poll for results
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max
        
        while (attempts < maxAttempts && !token.isCancellationRequested) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5s poll interval
          attempts++;
          
          const statusResponse = await axios.get(
            `${apiUrl}/api/v1/jobs/${jobId}`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
          );
          
          const job = statusResponse.data;
          progress.report({ message: `Status: ${job.status} (${attempts * 5}s)` });
          
          if (job.status === 'complete') {
            outputChannel.appendLine(`\n${'='.repeat(60)}`);
            outputChannel.appendLine(`OpenBotMan Experten-Diskussion`);
            outputChannel.appendLine(`Topic: ${topic}`);
            outputChannel.appendLine(`${'='.repeat(60)}\n`);
            outputChannel.appendLine(job.result);
            
            if (job.actionItems && job.actionItems.length > 0) {
              outputChannel.appendLine(`\n--- Action Items ---`);
              job.actionItems.forEach((item: string) => outputChannel.appendLine(`- ${item}`));
            }
            
            outputChannel.appendLine(`\nDauer: ${Math.round(job.durationMs / 1000)}s`);
            outputChannel.show();
            
            vscode.window.showInformationMessage(
              'Experten-Diskussion abgeschlossen!',
              'Ergebnis anzeigen'
            ).then(action => { if (action) outputChannel.show(); });
            return;
          }
          
          if (job.status === 'error') {
            throw new Error(job.error || 'Unbekannter Fehler');
          }
        }
        
        if (token.isCancellationRequested) {
          vscode.window.showWarningMessage('Diskussion abgebrochen');
        } else {
          throw new Error('Timeout nach 10 Minuten');
        }
        
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
  
  // Quick pick for analysis type
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
        const apiUrl = config.get<string>('apiUrl') || 'http://localhost:8080';
        const apiKey = config.get<string>('apiKey') || 'local-dev-key';
        
        // Start async job
        const startResponse = await axios.post(
          `${apiUrl}/api/v1/discuss`,
          {
            topic,
            workspace: workspacePath,
            include: ['**/*.ts', '**/*.js', '**/*.cs', '**/*.py', '**/*.java', '**/*.json', '**/*.yaml', '**/*.yml'],
            maxContext: 200,
            async: true,
            timeout: 180,
            agents: 3,
          },
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        
        const jobId = startResponse.data.id;
        progress.report({ message: 'Experten analysieren...' });
        
        // Poll for results
        let attempts = 0;
        const maxAttempts = 120;
        
        while (attempts < maxAttempts && !token.isCancellationRequested) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          
          const statusResponse = await axios.get(
            `${apiUrl}/api/v1/jobs/${jobId}`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
          );
          
          const job = statusResponse.data;
          progress.report({ message: `${job.status} (${attempts * 5}s)` });
          
          if (job.status === 'complete') {
            outputChannel.appendLine(`\n${'='.repeat(60)}`);
            outputChannel.appendLine(`🔍 ${analysisType.label} - ${workspaceName}`);
            outputChannel.appendLine(`${'='.repeat(60)}\n`);
            outputChannel.appendLine(job.result);
            outputChannel.appendLine(`\nDauer: ${Math.round(job.durationMs / 1000)}s`);
            outputChannel.show();
            
            vscode.window.showInformationMessage(
              `${analysisType.label} abgeschlossen!`,
              'Ergebnis anzeigen'
            ).then(action => { if (action) outputChannel.show(); });
            return;
          }
          
          if (job.status === 'error') {
            throw new Error(job.error || 'Analyse fehlgeschlagen');
          }
        }
        
        if (token.isCancellationRequested) {
          vscode.window.showWarningMessage('Analyse abgebrochen');
        }
        
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
    
    outputChannel.appendLine(`\n--- Agent Status ---`);
    outputChannel.appendLine(JSON.stringify(status, null, 2));
    outputChannel.show();
    
    const agents = await client.getAgents();
    const statusText = agents.map(a => `${a.id}: ${a.status}`).join(' | ');
    statusBarItem.tooltip = statusText;
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
        a.status === 'idle' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
      ));
    } catch {
      return [new AgentItem('Unable to connect', 'error', vscode.TreeItemCollapsibleState.None)];
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
  outputChannel.appendLine('OpenBotMan extension deactivated');
}
