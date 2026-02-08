import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Play, Users, FolderOpen, FileCode, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchTeams as apiFetchTeams, startDiscussion, getApiKey } from '../lib/api'

interface Team {
  id: string
  name: string
  description?: string
  agentCount: number
  default?: boolean
}

interface FilePreview {
  path: string
  size: number
}

interface WorkspacePreviewResult {
  files: FilePreview[]
  totalFiles: number
  totalSize: number
  totalSizeKB: number
  error?: string
}

export default function NewDiscussion() {
  const navigate = useNavigate()
  
  // Form state
  const [topic, setTopic] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  
  // Workspace state
  const [workspace, setWorkspace] = useState('')
  const [include, setInclude] = useState('**/*.ts, **/*.tsx')
  const [ignore, setIgnore] = useState('')
  const [showWorkspace, setShowWorkspace] = useState(false)
  
  // Preview state
  const [preview, setPreview] = useState<WorkspacePreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  
  // Loading state
  const [loading, setLoading] = useState(false)
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    try {
      const data = await apiFetchTeams()
      setTeams(data.teams || [])
      const defaultTeam = data.teams.find((t: Team) => t.default)
      if (defaultTeam) {
        setSelectedTeam(defaultTeam.id)
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setTeamsLoading(false)
    }
  }

  // Debounced preview loading
  const loadPreview = useCallback(async () => {
    if (!workspace.trim()) {
      setPreview(null)
      setWorkspaceError(null)
      return
    }

    setPreviewLoading(true)
    setWorkspaceError(null)

    try {
      const includePatterns = include.split(',').map(p => p.trim()).filter(Boolean)
      const ignorePatterns = ignore.split(',').map(p => p.trim()).filter(Boolean)

      const res = await fetch('/api/v1/workspace/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          path: workspace.trim(),
          include: includePatterns.length > 0 ? includePatterns : ['**/*.ts', '**/*.tsx'],
          ignore: ignorePatterns,
        }),
      })

      const data = await res.json() as WorkspacePreviewResult

      if (data.error) {
        setWorkspaceError(data.error)
        setPreview(null)
      } else {
        setPreview(data)
        setWorkspaceError(null)
      }
    } catch (error) {
      setWorkspaceError('Fehler beim Laden der Vorschau')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [workspace, include, ignore])

  // Load preview when workspace/patterns change (debounced)
  useEffect(() => {
    const timer = setTimeout(loadPreview, 500)
    return () => clearTimeout(timer)
  }, [loadPreview])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    try {
      // Build request with workspace if specified
      const includePatterns = include.split(',').map(p => p.trim()).filter(Boolean)
      const ignorePatterns = ignore.split(',').map(p => p.trim()).filter(Boolean)

      const data = await startDiscussion(
        topic.trim(), 
        selectedTeam || undefined,
        workspace.trim() || undefined,
        includePatterns.length > 0 ? includePatterns : undefined,
        ignorePatterns.length > 0 ? ignorePatterns : undefined
      )
      navigate(`/jobs/${data.id}`)
    } catch (error) {
      console.error('Failed to start discussion:', error)
      alert(error instanceof Error ? error.message : 'Fehler beim Starten der Diskussion')
    } finally {
      setLoading(false)
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    return `${Math.round(bytes / 1024)} KB`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Neue Diskussion</h1>
        <p className="text-muted-foreground">Starte eine Multi-Agent Diskussion</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Topic */}
        <div className="space-y-2">
          <label htmlFor="topic" className="text-sm font-medium">
            Thema / Fragestellung
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="z.B. Wie implementiere ich Rate-Limiting in einer Node.js API?"
            className="w-full h-32 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            required
          />
        </div>

        {/* Workspace Section (Collapsible) */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowWorkspace(!showWorkspace)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FolderOpen className="h-4 w-4" />
              Workspace-Kontext (optional)
              {workspace && preview && !workspaceError && (
                <span className="text-xs text-muted-foreground">
                  ({preview.totalFiles} Dateien, {preview.totalSizeKB} KB)
                </span>
              )}
            </span>
            {showWorkspace ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showWorkspace && (
            <div className="p-4 space-y-4 border-t border-border">
              {/* Workspace Path */}
              <div className="space-y-2">
                <label htmlFor="workspace" className="text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Workspace-Pfad
                </label>
                <input
                  id="workspace"
                  type="text"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  placeholder="z.B. C:\Sources\MeinProjekt"
                  className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                    workspaceError ? 'border-red-500' : 'border-input'
                  }`}
                />
                {workspaceError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {workspaceError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Lokaler Pfad zum Projekt. Die Agents können den Code dann sehen und analysieren.
                </p>
              </div>

              {/* Include Patterns */}
              <div className="space-y-2">
                <label htmlFor="include" className="text-sm font-medium flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Datei-Pattern (Include)
                </label>
                <input
                  id="include"
                  type="text"
                  value={include}
                  onChange={(e) => setInclude(e.target.value)}
                  placeholder="**/*.ts, **/*.tsx"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Glob-Pattern für zu ladende Dateien (komma-getrennt). Standard: TypeScript-Dateien.
                </p>
              </div>

              {/* Ignore Patterns */}
              <div className="space-y-2">
                <label htmlFor="ignore" className="text-sm font-medium">
                  Zusätzliche Ignore-Pattern (optional)
                </label>
                <input
                  id="ignore"
                  type="text"
                  value={ignore}
                  onChange={(e) => setIgnore(e.target.value)}
                  placeholder="z.B. **/test/**, **/*.spec.ts"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Zusätzlich zu ignorierende Dateien. Sensible Dateien (.env, *.key, secrets.*) werden automatisch ausgeschlossen!
                </p>
              </div>

              {/* File Preview */}
              {(previewLoading || preview) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gefundene Dateien</label>
                  <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-muted/20">
                    {previewLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Lade Vorschau...</span>
                      </div>
                    ) : preview && preview.files.length > 0 ? (
                      <ul className="divide-y divide-border">
                        {preview.files.map((file) => (
                          <li key={file.path} className="px-3 py-2 flex justify-between items-center text-sm">
                            <span className="truncate font-mono text-xs">{file.path}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">
                              {formatSize(file.size)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Keine Dateien gefunden
                      </p>
                    )}
                  </div>
                  {preview && preview.totalFiles > 100 && (
                    <p className="text-xs text-muted-foreground">
                      Zeige erste 100 von {preview.totalFiles} Dateien
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Team Selection */}
        <div className="space-y-2">
          <label htmlFor="team" className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team auswählen
          </label>
          {teamsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Teams...
            </div>
          ) : (
            <div className="grid gap-3">
              {teams.map((team) => (
                <label
                  key={team.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTeam === team.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="team"
                    value={team.id}
                    checked={selectedTeam === team.id}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-muted-foreground">{team.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {team.agentCount} Agents
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !topic.trim() || (workspace.trim() !== '' && !!workspaceError)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starte Diskussion...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Diskussion starten
            </>
          )}
        </button>
      </form>
    </div>
  )
}
