import { useState } from 'react'
import { Key, Save } from 'lucide-react'
import { getApiKey, setApiKey } from '../lib/api'

export default function Settings() {
  const [apiKeyValue, setApiKeyValue] = useState(getApiKey())
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setApiKey(apiKeyValue)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">API-Konfiguration</p>
      </div>

      <div className="space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <label htmlFor="apiKey" className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            placeholder="API Key für den OpenBotMan Server"
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Der API Key wird im localStorage gespeichert.
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saved ? 'Gespeichert!' : 'Speichern'}
        </button>
      </div>

      {/* Future Settings */}
      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-4">Weitere Einstellungen (Coming Soon)</h2>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• Agent-Verwaltung</li>
          <li>• Team-Verwaltung</li>
          <li>• Prompt-Editor</li>
          <li>• Provider-Status</li>
        </ul>
      </div>
    </div>
  )
}
