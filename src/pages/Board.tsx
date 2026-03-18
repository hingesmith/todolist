import React from 'react'
import { PageState } from '../App'
import { Badge } from '../components/ui/Badge'
import { storage } from '../storage/local'
import { Todo, TodoStatus } from '../types/todo'
import { Plus, Clock, User } from 'lucide-react'

interface BoardPageProps {
  onNavigate: (page: PageState) => void
  selectedTags: string[]
  onTagSelect: (tag: string) => void
  onTagClear: () => void
}

export default function BoardPage({ onNavigate, selectedTags, onTagSelect }: BoardPageProps) {
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = React.useState<TodoStatus | null>(null)

  React.useEffect(() => {
    setTodos(storage.getTodos())
  }, [])

  const columns: { id: TodoStatus; label: string }[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'done', label: 'Done' }
  ]

  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>()
    todos.forEach(t => t.tags?.forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet).sort()
  }, [todos])

  const filteredTodos = React.useMemo(() => {
    if (selectedTags.length === 0) return todos
    return todos.filter(t => selectedTags.some(tag => t.tags?.includes(tag)))
  }, [todos, selectedTags])

  const getTodosByStatus = (status: TodoStatus) => {
    return filteredTodos
      .filter(t => t.status === status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const prioritizeText = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High'
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this task?')) {
      storage.deleteTodo(id)
      setTodos(storage.getTodos())
    }
  }

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation()
    onTagSelect(tag)
  }

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('todoId', id)
    e.dataTransfer.effectAllowed = 'move'
    // Delay setting state so the drag ghost image doesn't show the transparent state
    setTimeout(() => setDraggingId(id), 0)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, status: TodoStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== status) {
      setDragOverColumn(status)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // We only clear if we are leaving the actual column container, not its children
    if ((e.currentTarget as HTMLElement) === e.target) {
      setDragOverColumn(null)
    }
  }

  const handleDrop = (e: React.DragEvent, status: TodoStatus) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDraggingId(null)
    const id = e.dataTransfer.getData('todoId')
    if (!id) return

    const todoToMove = todos.find(t => t.id === id)
    // If the task exists and we are actually changing the status
    if (todoToMove && todoToMove.status !== status) {
      todoToMove.status = status
      storage.updateTodo(todoToMove)
      setTodos(storage.getTodos())
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Board</h2>

        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filter:</span>
            {allTags.map(tag => {
              const active = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => onTagSelect(tag)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start overflow-x-auto pb-4">
        {columns.map(column => {
          const columnTodos = getTodosByStatus(column.id)
          const isDragOver = dragOverColumn === column.id
          
          return (
            <div
              key={column.id}
              className={`flex-1 min-w-[300px] w-full rounded-xl p-4 flex flex-col gap-4 transition-colors ${
                isDragOver
                  ? 'bg-indigo-50/80 dark:bg-indigo-900/20 border-2 border-indigo-400 border-dashed'
                  : 'bg-gray-100/50 dark:bg-gray-800/50 border-2 border-transparent'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  {column.label}
                  <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs py-0.5 px-2 rounded-full">
                    {columnTodos.length}
                  </span>
                </h3>
              </div>

              <div className="flex flex-col gap-3 flex-1">
                {columnTodos.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                    {selectedTags.length > 0 ? 'No matching tasks' : 'No tasks'}
                  </div>
                ) : (
                  columnTodos.map(todo => {
                    const isDragging = draggingId === todo.id
                    
                    return (
                      <div
                        key={todo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, todo.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                        className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all cursor-grab active:cursor-grabbing group flex flex-col gap-2 ${
                          isDragging ? 'opacity-40 scale-95 shadow-none' : 'hover:border-indigo-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-sm leading-tight ${todo.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                          {todo.title}
                        </h4>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 shrink-0"
                          onClick={(e) => handleDelete(todo.id, e)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      </div>

                      {todo.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {todo.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-y-2 pt-2 mt-auto">
                        <Badge priority={todo.priority}>{prioritizeText[todo.priority || 'medium']}</Badge>
                        
                        {todo.end_date && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Clock size={12} />
                            <span>{new Date(todo.end_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      
                      {todo.assignees && todo.assignees.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                          <User size={10} />
                          <span className="truncate">{todo.assignees.join(', ')}</span>
                        </div>
                      )}
                      {todo.tags && todo.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {todo.tags.map(tag => (
                            <span
                              key={tag}
                              onClick={(e) => handleTagClick(e, tag)}
                              className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                selectedTags.includes(tag)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }))}
                
                <button
                  onClick={() => onNavigate({ type: 'create' })}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/50 transition-colors font-medium text-sm"
                >
                  <Plus size={16} /> Add Task
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


