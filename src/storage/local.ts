import { Todo } from '../types/todo'
import { Memo } from '../types/memo'
import { validateTodoList } from '../validation/schema'

const STORAGE_KEY = 'todolist_data'
const AI_SETTINGS_KEY = 'ai_settings'
const MEMOS_KEY = 'memos_data'
const MEMBERS_KEY = 'members_data'

export type AiProvider = 'gemini' | 'local'

export interface AiSettings {
  provider: AiProvider
  geminiModel: string
  localEndpoint: string
  localModel: string
  localApiKey: string
}

export const defaultAiSettings: AiSettings = {
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  localEndpoint: 'http://localhost:11434/api/chat',
  localModel: 'llama3',
  localApiKey: ''
}

export const storage = {
  getTodos: (): Todo[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []
      
      const parsed = JSON.parse(data)
      const isValid = validateTodoList(parsed)
      
      if (!isValid) {
        console.error('Invalid data in local storage', validateTodoList.errors)
        return []
      }
      return parsed
    } catch (e) {
      console.error('Failed to parse local storage data', e)
      return []
    }
  },

  saveTodos: (todos: Todo[]): boolean => {
    const isValid = validateTodoList(todos)
    if (!isValid) {
      console.error('Attempted to save invalid data', validateTodoList.errors)
      return false
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
      return true
    } catch (e) {
      console.error('Failed to save to local storage', e)
      return false
    }
  },

  addTodo: (todo: Todo): boolean => {
    const currentTodos = storage.getTodos()
    return storage.saveTodos([...currentTodos, todo])
  },

  updateTodo: (updatedTodo: Todo): boolean => {
    const currentTodos = storage.getTodos()
    const newTodos = currentTodos.map(t => t.id === updatedTodo.id ? updatedTodo : t)
    return storage.saveTodos(newTodos)
  },

  deleteTodo: (id: string): boolean => {
    const todos = storage.getTodos()
    const filtered = todos.filter(t => t.id !== id)
    if (filtered.length === todos.length) return false
    return storage.saveTodos(filtered)
  },

  addTodos: (newTodos: Todo[]): boolean => {
    const todos = storage.getTodos()
    return storage.saveTodos([...todos, ...newTodos])
  },

  getApiKey: (): string | null => {
    try {
      return localStorage.getItem('gemini_api_key')
    } catch {
      return null
    }
  },

  setApiKey: (key: string): void => {
    try {
      localStorage.setItem('gemini_api_key', key)
    } catch (e) {
      console.error('Failed to save API key', e)
    }
  },
  
  getTodo: (id: string): Todo | undefined => {
    const currentTodos = storage.getTodos()
    return currentTodos.find(t => t.id === id)
  },

  getAiSettings: (): AiSettings => {
    try {
      const data = localStorage.getItem(AI_SETTINGS_KEY)
      if (!data) return defaultAiSettings
      return { ...defaultAiSettings, ...JSON.parse(data) }
    } catch {
      return defaultAiSettings
    }
  },

  setAiSettings: (settings: AiSettings): void => {
    try {
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings))
    } catch (e) {
      console.error('Failed to save AI settings', e)
    }
  },

  getMemos: (): Memo[] => {
    try {
      const data = localStorage.getItem(MEMOS_KEY)
      if (!data) return []
      return JSON.parse(data) as Memo[]
    } catch {
      return []
    }
  },

  saveMemos: (memos: Memo[]): void => {
    try {
      localStorage.setItem(MEMOS_KEY, JSON.stringify(memos))
    } catch (e) {
      console.error('Failed to save memos', e)
    }
  },

  getMemo: (id: string): Memo | undefined => {
    return storage.getMemos().find(m => m.id === id)
  },

  addMemo: (memo: Memo): void => {
    storage.saveMemos([...storage.getMemos(), memo])
  },

  updateMemo: (updated: Memo): void => {
    storage.saveMemos(storage.getMemos().map(m => m.id === updated.id ? updated : m))
  },

  deleteMemo: (id: string): void => {
    storage.saveMemos(storage.getMemos().filter(m => m.id !== id))
  },

  getMembers: (): string[] => {
    try {
      const data = localStorage.getItem(MEMBERS_KEY)
      return data ? JSON.parse(data) : []
    } catch { return [] }
  },

  saveMembers: (members: string[]): void => {
    try {
      localStorage.setItem(MEMBERS_KEY, JSON.stringify([...new Set(members)].sort()))
    } catch (e) { console.error('Failed to save members', e) }
  },

  addMember: (name: string): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const members = storage.getMembers()
    if (!members.includes(trimmed)) storage.saveMembers([...members, trimmed])
  }
}
