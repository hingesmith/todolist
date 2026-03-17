import React, { useState, useEffect, useRef } from 'react'
import { PageState } from '../App'
import { storage } from '../storage/local'
import { Todo } from '../types/todo'
import { Button } from '../components/ui/Button'
import { KeyRound, Sparkles, Send, Loader2, Check, Plus, Edit2, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateOperationsFromChat, AiOperation } from '../lib/ai'

interface AiAssistantPageProps {
  onNavigate: (page: PageState) => void
}

type Message = { role: 'user' | 'assistant' | 'system', content: string | React.ReactNode }

export default function AiAssistantPage({ onNavigate }: AiAssistantPageProps) {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [aiSettings, setAiSettings] = useState(storage.getAiSettings())
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Gemini AI Assistant is ready. What kind of tasks do you need help planning?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<AiOperation[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedKey = storage.getApiKey()
    if (savedKey) {
      setApiKey(savedKey)
      setHasKey(true)
    }
    setAiSettings(storage.getAiSettings())
  }, [])

  const isConfigured = aiSettings.provider === 'local' 
    ? !!aiSettings.localEndpoint 
    : hasKey

  const autoResizeTextarea = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`
    }
  }

  useEffect(() => {
    autoResizeTextarea()
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingOperations])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }



  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || !isConfigured) return

    const userPrompt = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: userPrompt }]
    setMessages(newMessages)
    setIsLoading(true)
    setPendingOperations([])

    try {
      const currentTodos = storage.getTodos()
      // Send chat context, excluding system messages and purely UI elements.
      const chatContext = newMessages.map(m => ({ 
        role: m.role, 
        content: typeof m.content === 'string' ? m.content : 'User interaction' 
      }))
      
      const response = await generateOperationsFromChat(apiKey, aiSettings, chatContext, currentTodos)
      setPendingOperations(response.operations)
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }])
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessages(prev => [...prev, { role: 'assistant', content: `Failed to generate tasks: ${errMsg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyOperations = () => {
    if (pendingOperations.length === 0) return
    
    let added = 0
    let updated = 0
    let deleted = 0

    pendingOperations.forEach(op => {
      if (op.type === 'add') {
        const newTodo: Todo = { ...op.todo, id: crypto.randomUUID(), created_at: new Date().toISOString() }
        storage.addTodos([newTodo])
        added++
      } else if (op.type === 'update') {
        const existing = storage.getTodo(op.id)
        if (existing) {
          storage.updateTodo({ ...existing, ...op.todo })
          updated++
        }
      } else if (op.type === 'delete') {
        storage.deleteTodo(op.id)
        deleted++
      }
    })

    setMessages(prev => [
      ...prev,
      { role: 'system', content: `Applied changes: Added ${added}, Updated ${updated}, Deleted ${deleted}.` }
    ])
    setPendingOperations([])
    
    // Automatically navigate to the List View to see changes after a short delay
    setTimeout(() => {
      onNavigate({ type: 'list' })
    }, 1500)
  }

  if (!isConfigured) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-4 rounded-full text-indigo-600 dark:text-indigo-400">
            <KeyRound size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Not Configured</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Please go to the Settings page to configure your AI Provider (Gemini API Key or Local LLM Endpoint).
            </p>
          </div>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => onNavigate({ type: 'settings' })}>Go to Settings</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Sparkles className="text-indigo-500" /> AI Task Assistant
        </h2>
        <button
          onClick={() => {
            storage.setApiKey('')
            setHasKey(false)
            setApiKey('')
          }}
          className="text-xs text-gray-500 hover:text-red-500 underline"
        >
          Clear API Key
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-none whitespace-pre-wrap flex items-center'
                : msg.role === 'system'
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm mx-auto'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
            }`}>
              {msg.role === 'user' || typeof msg.content !== 'string' ? (
                msg.content
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:text-gray-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
              <Loader2 className="animate-spin text-indigo-500" size={16} />
              <span className="text-sm font-medium">Generating tasks...</span>
            </div>
          </div>
        )}

        {/* Task Operations Preview */}
        {pendingOperations.length > 0 && (
          <div className="ml-4 space-y-4 w-[80%]">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-200/50 dark:border-indigo-800/50 pb-2">
                <span className="font-semibold text-indigo-900 dark:text-indigo-200">Proposed Operations ({pendingOperations.length})</span>
                <Button size="sm" onClick={handleApplyOperations} className="gap-1">
                  <Check size={14} /> Apply Changes
                </Button>
              </div>
              
              <div className="space-y-2">
                {pendingOperations.map((op, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm text-sm flex flex-col gap-1">
                    <div className="flex items-start gap-2">
                      {op.type === 'add' && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><Plus size={10} /> ADD</span>}
                      {op.type === 'update' && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><Edit2 size={10} /> UPDATE</span>}
                      {op.type === 'delete' && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><Trash2 size={10} /> DELETE</span>}
                      
                      <div className="flex-1 min-w-0">
                         {op.type === 'delete' ? (
                           <span className="text-gray-500 line-through">Task ID: {op.id}</span>
                         ) : op.type === 'update' ? (
                           <span className="font-medium text-gray-900 dark:text-gray-100">{op.todo.title || `Update Task ID: ${op.id}`}</span>
                         ) : (
                           <span className="font-medium text-gray-900 dark:text-gray-100">{op.todo.title}</span>
                         )}
                      </div>
                    </div>
                    
                    {op.type !== 'delete' && op.todo.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{op.todo.description}</p>}
                    
                    {op.type !== 'delete' && (op.todo.start_date || op.todo.end_date) && (
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                        Timeline: {op.todo.start_date || '?'} → {op.todo.end_date || '?'}
                      </div>
                    )}
                    
                    {op.reasoning && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md border border-gray-100 dark:border-gray-700 italic">
                        <span className="font-semibold not-italic text-gray-500 mr-1">Reasoning:</span>{op.reasoning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 -mx-8 sm:px-8 mt-auto sticky bottom-0">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Break down the process of planning a team offsite next Friday (Ctrl+Enter to send)"
            className="flex-1 bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-800 rounded-lg p-2.5 text-sm resize-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-gray-100 outline-none max-h-[150px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            rows={1}
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-[42px] mb-[1px]"
          >
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  )
}
