import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, Download, Loader2, XCircle } from 'lucide-react'

interface AgentInfo {
  name: string
  emoji?: string
  provider?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  response?: string
  error?: string
  durationMs?: number
}

interface Job {
  id: string
  topic: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: string
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

  useEffect(() => {
    if (!jobId) return

    fetchJob()
    const interval = setInterval(fetchJob, 2000) // Poll every 2s while running
    return () => clearInterval(interval)
  }, [jobId])

  async function fetchJob() {
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}`)
      if (res.ok) {
        const data = await res.json()
        setJob(data)
      }
    } catch (error) {
      console.error('Failed to fetch job:', error)
    } finally {
      setLoading(false)
    }
  }

  function downloadMarkdown() {
    if (!job?.result) return
    const blob = new Blob([job.result], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discussion-${job.id}.md`
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
          <h1 className="text-2xl font-bold">
            {job.topic.length > 80 ? job.topic.slice(0, 80) + '...' : job.topic}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
          </div>
        </div>

        {job.status === 'completed' && job.result && (
          <button
            onClick={downloadMarkdown}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Markdown
          </button>
        )}
      </div>

      {/* Progress */}
      {isRunning && job.progress && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm">{job.progress}</p>
        </div>
      )}

      {/* Agents */}
      {job.agents && job.agents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Agenten</h2>
          <div className="grid gap-4">
            {job.agents.map((agent, index) => (
              <div 
                key={index}
                className={`border rounded-lg overflow-hidden ${
                  agent.status === 'error' ? 'border-red-500/50' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span>{agent.emoji || '🤖'}</span>
                    <span className="font-medium">{agent.name}</span>
                    {agent.provider && (
                      <span className="text-xs text-muted-foreground">({agent.provider})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {agent.durationMs && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(agent.durationMs / 1000)}s
                      </span>
                    )}
                    {agent.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                    {agent.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {agent.status === 'complete' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {agent.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                </div>
                
                {agent.response && (
                  <div className="px-4 py-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {agent.response.length > 500 
                      ? agent.response.slice(0, 500) + '...' 
                      : agent.response}
                  </div>
                )}
                
                {agent.error && (
                  <div className="px-4 py-3 text-sm text-red-500">
                    {agent.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {job.status === 'completed' && job.result && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ergebnis</h2>
          <div className="bg-muted/30 rounded-lg p-6 prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{job.result}</pre>
          </div>
        </div>
      )}

      {/* Action Items */}
      {job.actionItems && job.actionItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Action Items</h2>
          <ul className="space-y-2">
            {job.actionItems.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error */}
      {job.status === 'failed' && job.error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-500 text-sm">{job.error}</p>
        </div>
      )}
    </div>
  )
}
