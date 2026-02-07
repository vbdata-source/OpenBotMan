import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, Copy, Download, Loader2, XCircle, Check } from 'lucide-react'
import { fetchJob as apiFetchJob } from '../lib/api'

interface AgentInfo {
  name: string
  emoji?: string
  provider?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  response?: string
  fullResponse?: string
  error?: string
  durationMs?: number
}

interface Job {
  id: string
  topic: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: string
  currentRound?: number
  maxRounds?: number
  agents?: AgentInfo[]
  result?: string
  actionItems?: string[]
  error?: string
  durationMs?: number
}

export default function JobView() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())

  const loadJob = useCallback(async () => {
    if (!jobId) return
    try {
      const data = await apiFetchJob(jobId)
      setJob(data)
      
      // Stop polling when job is done
      if (data.status === 'completed' || data.status === 'failed') {
        return true // Signal to stop polling
      }
    } catch (error) {
      console.error('Failed to fetch job:', error)
    } finally {
      setLoading(false)
    }
    return false
  }, [jobId])

  useEffect(() => {
    if (!jobId) return

    loadJob()
    const interval = setInterval(async () => {
      const shouldStop = await loadJob()
      if (shouldStop) {
        clearInterval(interval)
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [jobId, loadJob])

  function toggleAgent(agentName: string) {
    setExpandedAgents(prev => {
      const next = new Set(prev)
      if (next.has(agentName)) {
        next.delete(agentName)
      } else {
        next.add(agentName)
      }
      return next
    })
  }

  function expandAllAgents() {
    if (job?.agents) {
      setExpandedAgents(new Set(job.agents.map(a => a.name)))
    }
  }

  function collapseAllAgents() {
    setExpandedAgents(new Set())
  }

  async function copyToClipboard() {
    if (!job?.result) return
    try {
      await navigator.clipboard.writeText(job.result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  function downloadMarkdown() {
    if (!job?.result) return
    const blob = new Blob([job.result], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discussion-${job.id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Job nicht gefunden</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">
          Zurück zum Dashboard
        </Link>
      </div>
    )
  }

  const isRunning = job.status === 'running' || job.status === 'pending'
  const completedAgents = job.agents?.filter(a => a.status === 'complete').length ?? 0
  const totalAgents = job.agents?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Dashboard
          </Link>
          <h1 className="text-xl font-bold break-words">
            {job.topic || 'Ohne Titel'}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              {job.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {job.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
              {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {job.status === 'completed' ? 'Abgeschlossen' : 
               job.status === 'failed' ? 'Fehlgeschlagen' : 
               'Läuft...'}
            </span>
            {job.durationMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.round(job.durationMs / 1000)}s
              </span>
            )}
            {job.currentRound && job.maxRounds && (
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded text-xs font-medium">
                Runde {job.currentRound}/{job.maxRounds}
              </span>
            )}
            {isRunning && (
              <span className="text-xs">
                {completedAgents}/{totalAgents} Agents fertig
              </span>
            )}
          </div>
        </div>

        {/* Export Buttons */}
        {job.status === 'completed' && job.result && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-sm"
              title="In Zwischenablage kopieren"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
            <button
              onClick={downloadMarkdown}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
              title="Als Markdown-Datei herunterladen"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {isRunning && job.currentRound && job.maxRounds && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{job.progress || `Runde ${job.currentRound} von ${job.maxRounds}`}</span>
            <span>{Math.round((job.currentRound / job.maxRounds) * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(job.currentRound / job.maxRounds) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Agents */}
      {job.agents && job.agents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Agenten ({completedAgents}/{totalAgents})</h2>
            <div className="flex gap-2">
              <button 
                onClick={expandAllAgents}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Alle öffnen
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={collapseAllAgents}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Alle schließen
              </button>
            </div>
          </div>
          
          <div className="grid gap-3">
            {job.agents.map((agent, index) => {
              const isExpanded = expandedAgents.has(agent.name)
              const hasResponse = agent.response || agent.fullResponse
              
              return (
                <div 
                  key={index}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    agent.status === 'error' ? 'border-red-500/50' : 
                    agent.status === 'complete' ? 'border-green-500/30' :
                    agent.status === 'running' ? 'border-blue-500/50' :
                    'border-border'
                  }`}
                >
                  {/* Agent Header - Clickable */}
                  <button
                    onClick={() => hasResponse && toggleAgent(agent.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 bg-muted/30 text-left ${
                      hasResponse ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{agent.emoji || '🤖'}</span>
                      <span className="font-medium">{agent.name}</span>
                      {agent.provider && (
                        <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                          {agent.provider}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {agent.durationMs && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(agent.durationMs / 1000)}s
                        </span>
                      )}
                      {agent.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                      {agent.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {agent.status === 'complete' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {agent.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                      {hasResponse && (
                        <span className="text-xs text-muted-foreground">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                    </div>
                  </button>
                  
                  {/* Agent Response - Expandable */}
                  {isExpanded && (agent.response || agent.fullResponse) && (
                    <div className="px-4 py-3 border-t border-border bg-background">
                      <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground overflow-x-auto">
                        {agent.fullResponse || agent.response}
                      </pre>
                    </div>
                  )}
                  
                  {/* Agent Error */}
                  {agent.error && (
                    <div className="px-4 py-3 border-t border-red-500/30 bg-red-500/5">
                      <p className="text-sm text-red-500">{agent.error}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Final Result */}
      {job.status === 'completed' && job.result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">📋 Ergebnis</h2>
            <button
              onClick={copyToClipboard}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>
          <div className="bg-muted/30 rounded-lg p-6 border border-border">
            <pre className="whitespace-pre-wrap text-sm font-mono overflow-x-auto">
              {job.result}
            </pre>
          </div>
        </div>
      )}

      {/* Action Items */}
      {job.actionItems && job.actionItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">✅ Action Items</h2>
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <ul className="space-y-2">
              {job.actionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    className="mt-1 h-4 w-4 rounded border-border" 
                  />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Error */}
      {job.status === 'failed' && job.error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <h3 className="font-semibold text-red-500 mb-2">Fehler</h3>
          <p className="text-red-500 text-sm">{job.error}</p>
        </div>
      )}
    </div>
  )
}
