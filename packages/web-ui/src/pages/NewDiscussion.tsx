import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Play, Users } from 'lucide-react'
import { fetchTeams as apiFetchTeams, startDiscussion } from '@/lib/api'

interface Team {
  id: string
  name: string
  description?: string
  agentCount: number
  default?: boolean
}

export default function NewDiscussion() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    try {
      const data = await apiFetchTeams()
      setTeams(data.teams || [])
      // Select default team
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    try {
      const data = await startDiscussion(topic.trim(), selectedTeam || undefined)
      navigate(`/jobs/${data.id}`)
    } catch (error) {
      console.error('Failed to start discussion:', error)
      alert(error instanceof Error ? error.message : 'Fehler beim Starten der Diskussion')
    } finally {
      setLoading(false)
    }
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
          disabled={loading || !topic.trim()}
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
