import React from 'react'
import { PageState } from '../App'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { storage } from '../storage/local'
import { Todo } from '../types/todo'
import { Plus, Clock, Tag } from 'lucide-react'

interface ListPageProps {
  onNavigate: (page: PageState) => void
}

export default function ListPage({ onNavigate }: ListPageProps) {
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [sortBy, setSortBy] = React.useState<'created_desc' | 'due_asc' | 'priority_desc'>('created_desc')

  React.useEffect(() => {
    setTodos(storage.getTodos())
  }, [])

  const sortedTodos = React.useMemo(() => {
    const list = [...todos]
    switch (sortBy) {
      case 'due_asc':
        return list.sort((a, b) => {
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        })
      case 'priority_desc':
        const pScore = { 'high': 3, 'medium': 2, 'low': 1 }
        return list.sort((a, b) => (pScore[b.priority || 'medium'] || 0) - (pScore[a.priority || 'medium'] || 0))
      case 'created_desc':
      default:
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  }, [todos, sortBy])

  const prioritizeText = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High'
  }

  const statusText = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'done': 'Done'
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this task?')) {
      storage.deleteTodo(id)
      setTodos(storage.getTodos())
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Tasks</h2>

        <div className="flex items-center gap-4 w-full sm:w-auto text-gray-900 dark:text-gray-100">
          <select
            className="h-10 rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:focus:ring-indigo-400"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="created_desc">Newest First</option>
            <option value="due_asc">Due Date</option>
            <option value="priority_desc">Priority</option>
          </select>
          <Button onClick={() => onNavigate({ type: 'create' })} className="gap-2">
            <Plus size={16} /> New Task
          </Button>
        </div>
      </div>

      {sortedTodos.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-dashed">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No tasks found</h3>
          <p className="mt-1 flex text-sm text-gray-500 dark:text-gray-400 justify-center text-center">Get started by creating a new task.</p>
          <Button onClick={() => onNavigate({ type: 'create' })} className="mt-4 gap-2">
            <Plus size={16} /> Create Task
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedTodos.map((todo) => (
            <div
              key={todo.id}
              onClick={() => onNavigate({ type: 'edit', id: todo.id })}
              className="flex flex-col sm:flex-row gap-4 p-5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer dark:hover:bg-gray-700/50 group"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-lg font-medium ${todo.status === 'done' ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {todo.title}
                  </h3>
                  <div className="flex gap-2 shrink-0">
                    <Badge status={todo.status}>{statusText[todo.status]}</Badge>
                    <Badge priority={todo.priority}>{prioritizeText[todo.priority || 'medium']}</Badge>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 px-2"
                      onClick={(e) => handleDelete(todo.id, e)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {todo.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {todo.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
                  {todo.due_date && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>Due: {new Date(todo.due_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {todo.tags && todo.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag size={14} />
                      {todo.tags.map(tag => (
                        <span key={tag} className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
