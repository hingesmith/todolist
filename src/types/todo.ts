export type TodoStatus = 'todo' | 'in_progress' | 'done'
export type TodoPriority = 'low' | 'medium' | 'high'

export interface Todo {
  id: string
  title: string
  description?: string
  status: TodoStatus
  priority?: TodoPriority
  created_at: string
  updated_at?: string
  due_date?: string
  tags?: string[]
}
