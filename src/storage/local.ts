import { Todo } from '../types/todo'
import { validateTodoList } from '../validation/schema'

const STORAGE_KEY = 'todolist_data'

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
  }
}
