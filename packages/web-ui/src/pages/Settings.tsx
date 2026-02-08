import { useState, useEffect } from 'react'
import { Key, Save, Users, Settings as SettingsIcon, Bot, Plus, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react'
import { getApiKey, setApiKey } from '../lib/api'

// Types
interface Agent {
  id: string
  name: string
  emoji?: string
  role: string
  provider: string
  model: string
  systemPrompt: string
  promptId?: string  // Reference to prompts
  apiKey?: string
  apiKeyMasked?: string
  baseUrl?: string
  maxTokens?: number
}

interface Prompt {
  id: string
  name: string
  description?: string
  category?: string
}

interface Team {
  id: string
  name: string
  description?: string
  agents: string[]
  default?: boolean
}

interface GlobalSettings {
  maxRounds: number
  timeout: number
  maxContext: number
  model: string
}

interface Provider {
  id: string
  name: string
  requiresKey: boolean
  keyEnv?: string
  supportsBaseUrl?: boolean
}

// API helpers
const API_BASE = '/api/v1'

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || res.statusText)
  }
  return res.json()
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'agents' | 'teams' | 'general' | 'api'>('agents')
  
  // API Key (local storage)
  const [apiKeyValue, setApiKeyValue] = useState(getApiKey())
  const [apiKeySaved, setApiKeySaved] = useState(false)
  
  // Data from server
  const [agents, setAgents] = useState<Agent[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [agentsRes, teamsRes, settingsRes, providersRes, promptsRes] = await Promise.all([
        fetchApi<{ agents: Agent[] }>('/config/agents'),
        fetchApi<{ teams: Team[] }>('/config/teams'),
        fetchApi<GlobalSettings>('/config/settings'),
        fetchApi<{ providers: Provider[] }>('/config/providers'),
        fetchApi<{ prompts: Prompt[] }>('/config/prompts'),
      ])
      setAgents(agentsRes.agents)
      setTeams(teamsRes.teams)
      setSettings(settingsRes)
      setProviders(providersRes.providers)
      setPrompts(promptsRes.prompts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  // Save API Key (local)
  function handleSaveApiKey() {
    setApiKey(apiKeyValue)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2000)
  }

  // Delete Agent
  async function handleDeleteAgent(agentId: string) {
    if (!confirm(`Agent "${agentId}" wirklich löschen?`)) return
    
    setSaving(true)
    try {
      await fetchApi(`/config/agents/${agentId}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setSaving(false)
    }
  }

  // Delete Team
  async function handleDeleteTeam(teamId: string) {
    if (!confirm(`Team "${teamId}" wirklich löschen?`)) return
    
    setSaving(true)
    try {
      await fetchApi(`/config/teams/${teamId}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setSaving(false)
    }
  }

  // Save Settings
  async function handleSaveSettings() {
    if (!settings) return
    
    setSaving(true)
    try {
      await fetchApi('/config/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      setHasChanges(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  // Add new agent
  function addNewAgent() {
    const newId = `agent-${Date.now()}`
    setEditingAgent({
      id: newId,
      name: 'Neuer Agent',
      emoji: '🤖',
      role: 'Expert',
      provider: 'claude-cli',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'Du bist ein hilfreicher Experte.',
    })
  }

  // Save edited agent
  async function saveEditingAgent() {
    if (!editingAgent) return
    
    setSaving(true)
    try {
      const exists = agents.find(a => a.id === editingAgent.id)
      if (exists) {
        await fetchApi(`/config/agents/${editingAgent.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingAgent),
        })
      } else {
        await fetchApi('/config/agents', {
          method: 'POST',
          body: JSON.stringify(editingAgent),
        })
      }
      setEditingAgent(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  // Add new team
  function addNewTeam() {
    const newId = `team-${Date.now()}`
    setEditingTeam({
      id: newId,
      name: 'Neues Team',
      description: '',
      agents: [],
      default: false,
    })
  }

  // Save edited team
  async function saveEditingTeam() {
    if (!editingTeam) return
    
    setSaving(true)
    try {
      const exists = teams.find(t => t.id === editingTeam.id)
      if (exists) {
        await fetchApi(`/config/teams/${editingTeam.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingTeam),
        })
      } else {
        await fetchApi('/config/teams', {
          method: 'POST',
          body: JSON.stringify(editingTeam),
        })
      }
      setEditingTeam(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">Konfiguration verwalten</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-500">
          <AlertCircle className="h-5 w-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: 'agents', label: 'Agents', icon: Bot },
          { id: 'teams', label: 'Teams', icon: Users },
          { id: 'general', label: 'Allgemein', icon: SettingsIcon },
          { id: 'api', label: 'API Key', icon: Key },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        
        {/* ============ AGENTS TAB ============ */}
        {activeTab === 'agents' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Agents ({agents.length})</h2>
              <button
                onClick={addNewAgent}
                className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
              >
                <Plus className="h-4 w-4" />
                Agent hinzufügen
              </button>
            </div>

            <div className="grid gap-4">
              {agents.map(agent => (
                <div key={agent.id} className="p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{agent.emoji || '🤖'}</span>
                      <div>
                        <h3 className="font-medium">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.provider} / {agent.model}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingAgent({ ...agent })}
                        className="p-2 hover:bg-muted rounded"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-2 hover:bg-red-500/10 text-red-500 rounded"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground flex flex-wrap gap-2">
                    <span className="inline-block px-2 py-0.5 bg-muted rounded">{agent.role}</span>
                    {agent.promptId && (
                      <span className="inline-block px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded">
                        📝 {agent.promptId}
                      </span>
                    )}
                    {agent.apiKeyMasked && (
                      <span className="inline-block px-2 py-0.5 bg-green-500/10 text-green-600 rounded">
                        🔑 {agent.apiKeyMasked}
                      </span>
                    )}
                    {agent.baseUrl && (
                      <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded">
                        🔗 {agent.baseUrl}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ TEAMS TAB ============ */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Teams ({teams.length})</h2>
              <button
                onClick={addNewTeam}
                className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
              >
                <Plus className="h-4 w-4" />
                Team hinzufügen
              </button>
            </div>

            <div className="grid gap-4">
              {teams.map(team => (
                <div key={team.id} className={`p-4 border rounded-lg ${team.default ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        {team.name}
                        {team.default && (
                          <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded">
                            Standard
                          </span>
                        )}
                      </h3>
                      {team.description && (
                        <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingTeam({ ...team })}
                        className="p-2 hover:bg-muted rounded"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-2 hover:bg-red-500/10 text-red-500 rounded"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {team.agents.map(agentId => {
                      const agent = agents.find(a => a.id === agentId)
                      return (
                        <span key={agentId} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                          {agent?.emoji || '🤖'} {agent?.name || agentId}
                        </span>
                      )
                    })}
                    {team.agents.length === 0 && (
                      <span className="text-sm text-muted-foreground">Keine Agents</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ GENERAL TAB ============ */}
        {activeTab === 'general' && settings && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Allgemeine Einstellungen</h2>
            
            <div className="grid gap-4 max-w-md">
              <div>
                <label className="text-sm font-medium">Max. Runden</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.maxRounds}
                  onChange={(e) => {
                    setSettings({ ...settings, maxRounds: parseInt(e.target.value) || 10 })
                    setHasChanges(true)
                  }}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">Maximale Konsens-Runden pro Diskussion</p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Timeout (Sekunden)</label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={settings.timeout}
                  onChange={(e) => {
                    setSettings({ ...settings, timeout: parseInt(e.target.value) || 60 })
                    setHasChanges(true)
                  }}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">Timeout pro Agent-Antwort</p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Max. Kontext (Bytes)</label>
                <input
                  type="number"
                  min="1000"
                  max="500000"
                  value={settings.maxContext}
                  onChange={(e) => {
                    setSettings({ ...settings, maxContext: parseInt(e.target.value) || 50000 })
                    setHasChanges(true)
                  }}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">Maximale Workspace-Kontext Größe</p>
              </div>
            </div>

            {hasChanges && (
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            )}
          </div>
        )}

        {/* ============ API KEY TAB ============ */}
        {activeTab === 'api' && (
          <div className="max-w-md">
            <h2 className="text-lg font-semibold mb-4">API Key</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">API Key für OpenBotMan Server</label>
                <input
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder="API Key"
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Wird im Browser localStorage gespeichert.
                </p>
              </div>

              <button
                onClick={handleSaveApiKey}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                <Save className="h-4 w-4" />
                {apiKeySaved ? 'Gespeichert!' : 'Speichern'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============ AGENT EDIT MODAL ============ */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {agents.find(a => a.id === editingAgent.id) ? 'Agent bearbeiten' : 'Neuer Agent'}
              </h3>
              <button onClick={() => setEditingAgent(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">ID</label>
                  <input
                    type="text"
                    value={editingAgent.id}
                    onChange={(e) => setEditingAgent({ ...editingAgent, id: e.target.value })}
                    disabled={!!agents.find(a => a.id === editingAgent.id)}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Emoji</label>
                  <input
                    type="text"
                    value={editingAgent.emoji || ''}
                    onChange={(e) => setEditingAgent({ ...editingAgent, emoji: e.target.value })}
                    placeholder="🤖"
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Rolle</label>
                <input
                  type="text"
                  value={editingAgent.role}
                  onChange={(e) => setEditingAgent({ ...editingAgent, role: e.target.value })}
                  placeholder="z.B. architect, coder, reviewer"
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={editingAgent.provider}
                    onChange={(e) => setEditingAgent({ ...editingAgent, provider: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Model</label>
                  <input
                    type="text"
                    value={editingAgent.model}
                    onChange={(e) => setEditingAgent({ ...editingAgent, model: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                  />
                </div>
              </div>
              
              {/* Base URL for OpenAI-compatible */}
              {editingAgent.provider === 'openai' && (
                <div>
                  <label className="text-sm font-medium">Base URL (optional)</label>
                  <input
                    type="text"
                    value={editingAgent.baseUrl || ''}
                    onChange={(e) => setEditingAgent({ ...editingAgent, baseUrl: e.target.value })}
                    placeholder="z.B. http://localhost:1234/v1"
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Für LM Studio, vLLM, etc.</p>
                </div>
              )}
              
              {/* Prompt Selection */}
              <div>
                <label className="text-sm font-medium">Prompt Template</label>
                <select
                  value={editingAgent.promptId || ''}
                  onChange={(e) => setEditingAgent({ 
                    ...editingAgent, 
                    promptId: e.target.value || undefined,
                    // Clear systemPrompt if using promptId
                    systemPrompt: e.target.value ? '' : editingAgent.systemPrompt
                  })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                >
                  <option value="">-- Eigener Prompt --</option>
                  {prompts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.category && `(${p.category})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Wähle einen vordefinierten Prompt oder schreibe einen eigenen.
                </p>
              </div>

              {/* System Prompt - only if no promptId */}
              {!editingAgent.promptId && (
                <div>
                  <label className="text-sm font-medium">System Prompt (eigener)</label>
                  <textarea
                    value={editingAgent.systemPrompt}
                    onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                    rows={4}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md resize-y"
                  />
                </div>
              )}
              
              {/* Show resolved prompt if using promptId */}
              {editingAgent.promptId && (
                <div>
                  <label className="text-sm font-medium">Aufgelöster Prompt (read-only)</label>
                  <textarea
                    value={editingAgent.systemPrompt}
                    readOnly
                    rows={4}
                    className="w-full mt-1 px-3 py-2 bg-muted border border-input rounded-md resize-y text-muted-foreground"
                  />
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium">API Key (optional)</label>
                <input
                  type="password"
                  value={editingAgent.apiKey || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, apiKey: e.target.value })}
                  placeholder="Leer lassen für Environment Variable"
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Oder ${'{'}VARIABLE{'}'} für Environment Variable
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setEditingAgent(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
              <button
                onClick={saveEditingAgent}
                disabled={saving || !editingAgent.id || !editingAgent.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ TEAM EDIT MODAL ============ */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {teams.find(t => t.id === editingTeam.id) ? 'Team bearbeiten' : 'Neues Team'}
              </h3>
              <button onClick={() => setEditingTeam(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">ID</label>
                <input
                  type="text"
                  value={editingTeam.id}
                  onChange={(e) => setEditingTeam({ ...editingTeam, id: e.target.value })}
                  disabled={!!teams.find(t => t.id === editingTeam.id)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md disabled:opacity-50"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Beschreibung (optional)</label>
                <input
                  type="text"
                  value={editingTeam.description || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Agents</label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border border-input rounded-md p-2">
                  {agents.map(agent => (
                    <label key={agent.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTeam.agents.includes(agent.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingTeam({ ...editingTeam, agents: [...editingTeam.agents, agent.id] })
                          } else {
                            setEditingTeam({ ...editingTeam, agents: editingTeam.agents.filter(id => id !== agent.id) })
                          }
                        }}
                        className="rounded"
                      />
                      <span>{agent.emoji || '🤖'}</span>
                      <span>{agent.name}</span>
                      <span className="text-xs text-muted-foreground">({agent.provider})</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingTeam.default || false}
                  onChange={(e) => setEditingTeam({ ...editingTeam, default: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Als Standard-Team setzen</span>
              </label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
              <button
                onClick={saveEditingTeam}
                disabled={saving || !editingTeam.id || !editingTeam.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
