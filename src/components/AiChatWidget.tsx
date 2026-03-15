import React, { useState, useEffect, useRef } from 'react'
import { storage } from '../storage/local'
import { Todo } from '../types/todo'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Sparkles, Send, Loader2, Check, Plus, Edit2, Trash2, X, ChevronDown, AlertCircle } from 'lucide-react'
import { generateOperationsFromChat, AiOperation } from '../lib/ai'

type Message = { role: 'user' | 'assistant' | 'system', content: string }

interface AiChatWidgetProps {
  onNavigateToSettings: () => void
}

export default function AiChatWidget({ onNavigateToSettings }: AiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'AI Assistant ready. Tell me what tasks you need!' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<AiOperation[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const key = storage.getApiKey()
    setApiKey(key)
  }, [isOpen]) // Refresh key state when widget opens

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, pendingOperations, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !apiKey) return

    const userPrompt = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: userPrompt }]
    setMessages(newMessages)
    setIsLoading(true)
    setPendingOperations([])

    try {
      const currentTodos = storage.getTodos()
      const response = await generateOperationsFromChat(apiKey, newMessages, currentTodos)
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

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
        title="AI Assistant"
      >
        {isOpen ? <ChevronDown size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-indigo-600 text-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles size={16} />
              AI Task Assistant
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-700 rounded-full p-1 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* No API Key Warning */}
          {!apiKey && (
            <div className="m-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Gemini API key not set. Please add it in Settings.</span>
              </div>
              <button
                onClick={() => { setIsOpen(false); onNavigateToSettings() }}
                className="text-indigo-600 dark:text-indigo-400 underline text-xs text-left"
              >
                Go to Settings →
              </button>
            </div>
          )}

          {/* Messages */}
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

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={apiKey ? 'Ask me to add, edit, or delete tasks…' : 'Set API key in Settings first'}
              className="flex-1 text-sm"
              disabled={isLoading || !apiKey}
            />
            <Button type="submit" disabled={!input.trim() || isLoading || !apiKey} className="shrink-0 px-3">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
