import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react'
import { fetchJobs as apiFetchJobs } from '../lib/api'

interface Job {
  id: string
  topic: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  durationMs?: number
  agentCount?: number
  currentRound?: number
  maxRounds?: number
  progress?: string
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJobs()
    const interval = setInterval(loadJobs, 5000) // Poll every 5s
    return () => clearInterval(interval)
  }, [])

  async function loadJobs() {
    try {
      const data = await apiFetchJobs()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusLabel = (status: Job['status']) => {
    switch (status) {
      case 'pending': return 'Wartend'
      case 'running': return 'Läuft'
      case 'completed': return 'Abgeschlossen'
      case 'failed': return 'Fehlgeschlagen'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Übersicht aller Diskussionen</p>
        </div>
        <Link
          to="/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Neue Diskussion
        </Link>
      </div>

      {/* Job List */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <p className="text-muted-foreground mb-4">Noch keine Diskussionen vorhanden</p>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Erste Diskussion starten
          </Link>
        </div>
      ) : (
        <div className="bg-background border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Thema</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fortschritt</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Dauer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Erstellt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="text-sm">{getStatusLabel(job.status)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link 
                      to={`/jobs/${job.id}`}
                      className="text-sm font-medium hover:text-primary transition-colors"
                    >
                      {job.topic && job.topic.length > 50 ? job.topic.slice(0, 50) + '...' : job.topic || '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {job.status === 'running' && job.currentRound 
                      ? `Runde ${job.currentRound}/${job.maxRounds || '?'} · ${job.agentCount || 0} Agents`
                      : job.agentCount ? `${job.agentCount} Agents` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {job.durationMs ? `${Math.round(job.durationMs / 1000)}s` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString('de-DE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
