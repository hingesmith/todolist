import React, { useState, useEffect, useRef } from 'react'
import { storage } from '../storage/local'
import { Todo } from '../types/todo'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Sparkles, Send, Loader2, Check, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react'
import { generateOperationsFromChat, AiOperation } from '../lib/ai'

type Message = { role: 'user' | 'assistant' | 'system', content: string }

interface AiChatWidgetProps {
  onNavigateToSettings: () => void
}

export default function AiChatWidget({ onNavigateToSettings }: AiChatWidgetProps) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [aiSettings, setAiSettings] = useState(storage.getAiSettings())
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'AI Assistant ready. Tell me what tasks you need!' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<AiOperation[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setApiKey(storage.getApiKey())
    setAiSettings(storage.getAiSettings())
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingOperations])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    
    // Validate config before proceeding
    if (aiSettings.provider === 'gemini' && !apiKey) return
    if (aiSettings.provider === 'local' && !aiSettings.localEndpoint) return

    const userPrompt = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: userPrompt }]
    setMessages(newMessages)
    setIsLoading(true)
    setPendingOperations([])

    try {
      const currentTodos = storage.getTodos()
      const response = await generateOperationsFromChat(apiKey, aiSettings, newMessages, currentTodos)
      setPendingOperations(response.operations)
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }])
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errMsg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyOperations = () => {
    if (pendingOperations.length === 0) return

    let added = 0, updated = 0, deleted = 0
    pendingOperations.forEach(op => {
      if (op.type === 'add') {
        storage.addTodos([{ ...op.todo, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Todo])
        added++
      } else if (op.type === 'update') {
        const existing = storage.getTodo(op.id)
        if (existing) { storage.updateTodo({ ...existing, ...op.todo }); updated++ }
      } else if (op.type === 'delete') {
        storage.deleteTodo(op.id); deleted++
      }
    })

    setMessages(prev => [
      ...prev,
      { role: 'system', content: `✅ Applied: Added ${added}, Updated ${updated}, Deleted ${deleted}.` }
    ])
    setPendingOperations([])
  }

  // Determine if history should be expanded: user has sent a message or typed anything
  const isExpanded = messages.length > 1 || input.trim().length > 0 || isLoading || pendingOperations.length > 0

  return (
    <div className={`${isExpanded ? 'h-64 sm:h-80' : 'h-auto'} border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col shrink-0 relative z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shrink-0">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Sparkles size={14} />
          AI Task Assistant
        </div>
      </div>

      {/* Configuration Warnings */}
      {aiSettings.provider === 'gemini' && !apiKey && (
        <div className="mx-4 mt-3 mb-0 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 flex flex-col gap-2 shrink-0">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Gemini API key not set. Please add it in Settings.</span>
          </div>
          <button
            onClick={() => onNavigateToSettings()}
            className="text-indigo-600 dark:text-indigo-400 underline text-xs text-left w-fit hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
          >
            Go to Settings →
          </button>
        </div>
      )}
      {aiSettings.provider === 'local' && !aiSettings.localEndpoint && (
        <div className="mx-4 mt-3 mb-0 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 flex flex-col gap-2 shrink-0">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Local LLM endpoint is not configured. Please set it in Settings.</span>
          </div>
          <button
            onClick={() => onNavigateToSettings()}
            className="text-indigo-600 dark:text-indigo-400 underline text-xs text-left w-fit hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
          >
            Go to Settings →
          </button>
        </div>
      )}

      {/* Messages */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : msg.role === 'system'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs text-center mx-auto'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none'
                }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-none px-3 py-2 flex items-center gap-2 text-sm">
                <Loader2 className="animate-spin text-indigo-500" size={14} />
                Thinking...
              </div>
            </div>
          )}

          {/* Pending Operations Preview */}
          {pendingOperations.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                  Proposed ({pendingOperations.length})
                </span>
                <Button size="sm" onClick={handleApplyOperations} className="gap-1 h-6 text-xs">
                  <Check size={11} /> Apply
                </Button>
              </div>
              <div className="space-y-1.5">
                {pendingOperations.map((op, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800 text-xs flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      {op.type === 'add' && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Plus size={9} /> ADD</span>}
                      {op.type === 'update' && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Edit2 size={9} /> UPDATE</span>}
                      {op.type === 'delete' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Trash2 size={9} /> DELETE</span>}
                      <span className={`font-medium text-gray-800 dark:text-gray-200 truncate ${op.type === 'delete' ? 'line-through text-gray-400' : ''}`}>
                        {op.type === 'delete' ? op.id : (op.todo.title ?? `Task ${idx + 1}`)}
                      </span>
                    </div>
                    {op.reasoning && (
                      <p className="text-gray-400 dark:text-gray-500 italic pl-1">{op.reasoning}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={
            aiSettings.provider === 'local'
              ? aiSettings.localEndpoint ? 'Ask me to add, edit, or delete tasks…' : 'Set Local LLM Endpoint in Settings first'
              : apiKey ? 'Ask me to add, edit, or delete tasks…' : 'Set Gemini API key in Settings first'
          }
          className="flex-1 text-sm"
          disabled={isLoading || (aiSettings.provider === 'gemini' && !apiKey) || (aiSettings.provider === 'local' && !aiSettings.localEndpoint)}
        />
        <Button type="submit" disabled={!input.trim() || isLoading || (aiSettings.provider === 'gemini' && !apiKey) || (aiSettings.provider === 'local' && !aiSettings.localEndpoint)} className="shrink-0 px-3">
          <Send size={16} />
        </Button>
      </form>
    </div>
  )
}
