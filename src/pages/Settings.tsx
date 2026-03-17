import React, { useState, useEffect } from 'react'
import { storage } from '../storage/local'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KeyRound, Check, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [aiSettings, setAiSettings] = useState(storage.getAiSettings())
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
    storage.setAiSettings(aiSettings)
    if (apiKey.trim()) {
      storage.setApiKey(apiKey.trim())
      setHasExistingKey(true)
    } else if (aiSettings.provider === 'gemini') {
      // If they switch to gemini without a key, clear existing key state just in case
      storage.setApiKey('')
      setHasExistingKey(false)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Assistant Configuration</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Settings and keys are stored only in your browser's local storage.</p>
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

          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Provider Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                AI Provider
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    checked={aiSettings.provider === 'gemini'}
                    onChange={() => setAiSettings({ ...aiSettings, provider: 'gemini' })}
                    className="text-indigo-600"
                  />
                  Google Gemini (Cloud)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    checked={aiSettings.provider === 'local'}
                    onChange={() => setAiSettings({ ...aiSettings, provider: 'local' })}
                    className="text-indigo-600"
                  />
                  Local LLM
                </label>
              </div>
            </div>

            {/* Gemini Settings */}
            {aiSettings.provider === 'gemini' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Gemini Model
                  </label>
                  <select
                    value={aiSettings.geminiModel}
                    onChange={e => setAiSettings({ ...aiSettings, geminiModel: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Default)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Google Gemini API Key
                  </label>
                  <Input
                    type="password"
                    placeholder={hasExistingKey ? '••••••••••••••••' : 'AIza...'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Get a free Gemini API key from{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-indigo-500">
                      Google AI Studio
                    </a>.
                  </p>
                </div>
              </div>
            )}

            {/* Local LLM Settings */}
            {aiSettings.provider === 'local' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    API Endpoint URL
                  </label>
                  <Input
                    type="text"
                    placeholder="http://localhost:11434/v1/chat/completions"
                    value={aiSettings.localEndpoint}
                    onChange={e => setAiSettings({ ...aiSettings, localEndpoint: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    OpenAI compatible endpoint. e.g. for Ollama use <code>http://localhost:11434/v1/chat/completions</code> or <code>/api/chat</code> depending on client logic.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Model Name
                  </label>
                  <Input
                    type="text"
                    placeholder="llama3, gemma:2b, etc."
                    value={aiSettings.localModel}
                    onChange={e => setAiSettings({ ...aiSettings, localModel: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="submit">
                {saved ? <><Check size={14} /> Saved!</> : 'Save Settings'}
              </Button>
              {hasExistingKey && aiSettings.provider === 'gemini' && (
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
        </div>
      </div>
    </div>
  )
}
