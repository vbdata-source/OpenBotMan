import { useState, useEffect } from 'react'
import { Wrench, Server, RefreshCw, AlertCircle, CheckCircle, XCircle, Plus, Trash2, Save, X, Pencil, Search, Globe } from 'lucide-react'
import { fetchTools, saveMcpServers, saveBuiltinTools } from '../lib/api'

interface MCPServerInfo {
  id: string
  name: string
  command: string
  args?: string[]
  enabled: boolean
  allowedAgents?: string[]
  env?: Record<string, string>
  status: string
}

interface ToolsData {
  builtinTools: {
    webSearch: boolean
    webFetch: boolean
  }
  mcpServers: MCPServerInfo[]
}

const PRESET_SERVERS = [
  {
    label: 'GitHub',
    id: 'github',
    name: 'GitHub MCP',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envHint: 'GITHUB_PERSONAL_ACCESS_TOKEN',
  },
  {
    label: 'Filesystem',
    id: 'filesystem',
    name: 'Filesystem MCP',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    envHint: '',
  },
  {
    label: 'PostgreSQL',
    id: 'postgres',
    name: 'PostgreSQL MCP',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envHint: 'POSTGRES_CONNECTION_STRING',
  },
  {
    label: 'Benutzerdefiniert',
    id: '',
    name: '',
    command: '',
    args: [],
    envHint: '',
  },
]

export default function Tools() {
  const [data, setData] = useState<ToolsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state for new server
  const [formId, setFormId] = useState('')
  const [formName, setFormName] = useState('')
  const [formCommand, setFormCommand] = useState('')
  const [formArgs, setFormArgs] = useState('')
  const [formEnvKey, setFormEnvKey] = useState('')
  const [formEnvValue, setFormEnvValue] = useState('')
  const [formAgents, setFormAgents] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchTools()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const applyPreset = (preset: typeof PRESET_SERVERS[0]) => {
    setFormId(preset.id)
    setFormName(preset.name)
    setFormCommand(preset.command)
    setFormArgs(preset.args?.join(' ') || '')
    setFormEnvKey(preset.envHint)
    setFormEnvValue('')
    setFormAgents('')
    setFormEnabled(true)
  }

  const resetForm = () => {
    setFormId('')
    setFormName('')
    setFormCommand('')
    setFormArgs('')
    setFormEnvKey('')
    setFormEnvValue('')
    setFormAgents('')
    setFormEnabled(true)
    setShowAdd(false)
    setEditingId(null)
  }

  const handleEditServer = (server: MCPServerInfo) => {
    setFormId(server.id)
    setFormName(server.name)
    setFormCommand(server.command)
    setFormArgs(server.args?.join(' ') || '')
    setFormEnvKey('')
    setFormEnvValue('')
    setFormAgents(server.allowedAgents?.join(', ') || '')
    setFormEnabled(server.enabled)
    setEditingId(server.id)
    setShowAdd(true)
  }

  const handleSaveEdit = async () => {
    if (!formId || !formName || !formCommand) {
      setError('ID, Name und Command sind Pflichtfelder')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated: MCPServerInfo = {
        id: formId,
        name: formName,
        command: formCommand,
        args: formArgs ? formArgs.split(' ').filter(Boolean) : undefined,
        env: formEnvKey && formEnvValue ? { [formEnvKey]: formEnvValue } : undefined,
        allowedAgents: formAgents ? formAgents.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        enabled: formEnabled,
        status: 'configured',
      }

      const existing = data?.mcpServers || []
      const allServers = existing.map(s => s.id === editingId ? updated : s)
      await saveMcpServers(allServers)

      resetForm()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleAddServer = async () => {
    if (!formId || !formName || !formCommand) {
      setError('ID, Name und Command sind Pflichtfelder')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const newServer: MCPServerInfo = {
        id: formId,
        name: formName,
        command: formCommand,
        args: formArgs ? formArgs.split(' ').filter(Boolean) : undefined,
        env: formEnvKey && formEnvValue ? { [formEnvKey]: formEnvValue } : undefined,
        allowedAgents: formAgents ? formAgents.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        enabled: formEnabled,
        status: 'configured',
      }

      const existing = data?.mcpServers || []
      if (existing.some(s => s.id === newServer.id)) {
        setError(`Server mit ID "${newServer.id}" existiert bereits`)
        return
      }

      const allServers = [...existing, newServer]
      await saveMcpServers(allServers)

      resetForm()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteServer = async (serverId: string) => {
    setSaving(true)
    setError(null)
    try {
      const remaining = (data?.mcpServers || []).filter(s => s.id !== serverId)
      await saveMcpServers(remaining)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Loeschen')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleServer = async (serverId: string) => {
    setSaving(true)
    setError(null)
    try {
      const servers = (data?.mcpServers || []).map(s =>
        s.id === serverId ? { ...s, enabled: !s.enabled } : s
      )
      await saveMcpServers(servers)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Tools & MCP-Server
          </h1>
          <p className="text-muted-foreground mt-1">
            Plugin-Tools und externe MCP-Server verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            disabled={showAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            MCP-Server hinzufuegen
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Server Form */}
      {showAdd && (
        <div className="rounded-lg border-2 border-primary/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId ? 'MCP-Server bearbeiten' : 'Neuen MCP-Server hinzufuegen'}</h2>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Presets */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Vorlage</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRESET_SERVERS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-1 text-sm rounded-md border border-border hover:bg-accent transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">ID *</label>
              <input
                type="text"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                disabled={!!editingId}
                placeholder="z.B. github"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. GitHub MCP"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Command *</label>
              <input
                type="text"
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
                placeholder="z.B. npx"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Argumente</label>
              <input
                type="text"
                value={formArgs}
                onChange={(e) => setFormArgs(e.target.value)}
                placeholder="z.B. -y @modelcontextprotocol/server-github"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Umgebungsvariable (Key)</label>
              <input
                type="text"
                value={formEnvKey}
                onChange={(e) => setFormEnvKey(e.target.value)}
                placeholder="z.B. GITHUB_PERSONAL_ACCESS_TOKEN"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Umgebungsvariable (Wert)</label>
              <input
                type="password"
                value={formEnvValue}
                onChange={(e) => setFormEnvValue(e.target.value)}
                placeholder="Token/Key eingeben"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Erlaubte Agents (kommagetrennt)</label>
              <input
                type="text"
                value={formAgents}
                onChange={(e) => setFormAgents(e.target.value)}
                placeholder="z.B. planner, coder (leer = alle)"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="rounded"
                />
                Aktiviert
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={editingId ? handleSaveEdit : handleAddServer}
              disabled={saving || !formId || !formName || !formCommand}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Built-in Tools */}
      {data && (
        <div className="rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5" />
            Built-in Tools
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Diese Tools laufen direkt im Server - kein MCP-Server noetig.
            Agents mit Tool-faehigen Providern (Claude API, OpenAI, Google) nutzen sie automatisch.
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">Websuche</div>
                  <div className="text-sm text-muted-foreground">Agents koennen im Web recherchieren (DuckDuckGo)</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={data.builtinTools.webSearch}
                onChange={async (e) => {
                  const updated = { ...data.builtinTools, webSearch: e.target.checked }
                  try {
                    await saveBuiltinTools(updated)
                    setData({ ...data, builtinTools: updated })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Fehler')
                  }
                }}
                className="h-5 w-5 rounded"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">Web Fetch</div>
                  <div className="text-sm text-muted-foreground">Agents koennen URLs abrufen und Inhalte analysieren</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={data.builtinTools.webFetch}
                onChange={async (e) => {
                  const updated = { ...data.builtinTools, webFetch: e.target.checked }
                  try {
                    await saveBuiltinTools(updated)
                    setData({ ...data, builtinTools: updated })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Fehler')
                  }
                }}
                className="h-5 w-5 rounded"
              />
            </label>
          </div>
        </div>
      )}

      {/* MCP Servers */}
      {data && (
        <div className="rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Server className="h-5 w-5" />
            MCP-Server ({data.mcpServers.length})
          </h2>

          {data.mcpServers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Keine MCP-Server konfiguriert</p>
              <p className="text-sm mt-2">
                Klicke oben auf "MCP-Server hinzufuegen" oder waehle eine Vorlage.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleServer(server.id)}
                      disabled={saving}
                      title={server.enabled ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {server.enabled ? (
                        <CheckCircle className="h-5 w-5 text-green-500 hover:text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                    <div>
                      <div className="font-medium">{server.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {server.command} {server.args?.join(' ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {server.allowedAgents && server.allowedAgents.length > 0 && (
                      <span className="text-muted-foreground">
                        {server.allowedAgents.join(', ')}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      server.status === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      server.status === 'configured' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {server.status}
                    </span>
                    <button
                      onClick={() => handleEditServer(server)}
                      disabled={saving}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteServer(server.id)}
                      disabled={saving}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
