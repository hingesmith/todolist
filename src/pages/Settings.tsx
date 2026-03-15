import React, { useState, useEffect } from 'react'
import { storage } from '../storage/local'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KeyRound, Check, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)

  useEffect(() => {
    const storedKey = storage.getApiKey()
    if (storedKey) {
      setApiKey(storedKey)
      setHasExistingKey(true)
    }
  }, [])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiKey.trim()) {
      storage.setApiKey(apiKey.trim())
      setHasExistingKey(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleClear = () => {
    storage.setApiKey('')
    setApiKey('')
    setHasExistingKey(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your application preferences.</p>
      </div>

      {/* AI Assistant Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Assistant (Gemini)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your API key is stored only in your browser's local storage.</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {hasExistingKey && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              <Check size={14} className="shrink-0" />
              <span>An API key is currently saved.</span>
            </div>
          )}
          {!hasExistingKey && (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
              <AlertCircle size={14} className="shrink-0" />
              <span>No API key set. The AI chat will prompt you until you save one here.</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Google Gemini API Key
            </label>
            <Input
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!apiKey.trim()}>
                {saved ? <><Check size={14} /> Saved!</> : 'Save API Key'}
              </Button>
              {hasExistingKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 underline"
                >
                  Clear Key
                </button>
              )}
            </div>
          </form>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Get a free Gemini API key from{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-indigo-500">
              Google AI Studio
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
