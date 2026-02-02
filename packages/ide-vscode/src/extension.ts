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
 * Start a discussion
 */
async function startDiscussion() {
  const topic = await vscode.window.showInputBox({
    prompt: 'What topic should the agents discuss?',
    placeHolder: 'e.g., Should we use MongoDB or PostgreSQL?',
  });
  
  if (!topic) return;
  
  vscode.window.showInformationMessage(`Starting discussion: "${topic}"`);
  // TODO: Implement discussion UI
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
