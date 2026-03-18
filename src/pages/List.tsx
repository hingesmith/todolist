import React from 'react'
import { PageState } from '../App'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { storage } from '../storage/local'
import { Todo } from '../types/todo'
import { Plus, Clock, Tag, X, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react'

interface ListPageProps {
  onNavigate: (page: PageState) => void
  selectedTag: string | null
  onTagSelect: (tag: string | null) => void
}

export default function ListPage({ onNavigate, selectedTag, onTagSelect }: ListPageProps) {
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [sortBy, setSortBy] = React.useState<'created_desc' | 'due_asc' | 'priority_desc'>('created_desc')
  const [doneOpen, setDoneOpen] = React.useState(false)

  React.useEffect(() => {
    setTodos(storage.getTodos())
  }, [])

  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>()
    todos.forEach(t => t.tags?.forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet).sort()
  }, [todos])

  const sorted = React.useMemo(() => {
    const base = selectedTag ? todos.filter(t => t.tags?.includes(selectedTag)) : todos
    const list = [...base]
    switch (sortBy) {
      case 'due_asc':
        return list.sort((a, b) => {
          if (!a.end_date) return 1
          if (!b.end_date) return -1
          return new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
        })
      case 'priority_desc': {
        const pScore = { high: 3, medium: 2, low: 1 }
        return list.sort((a, b) => (pScore[b.priority || 'medium'] || 0) - (pScore[a.priority || 'medium'] || 0))
      }
      default:
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  }, [todos, sortBy, selectedTag])

  const activeTodos = sorted.filter(t => t.status !== 'done')
  const doneTodos   = sorted.filter(t => t.status === 'done')

  const prioritizeText = { low: 'Low', medium: 'Medium', high: 'High' }

  const handleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const todo = todos.find(t => t.id === id)
    if (!todo) return
    const newStatus = todo.status === 'done' ? 'todo' : 'done'
    storage.updateTodo({ ...todo, status: newStatus, updated_at: new Date().toISOString() })
    setTodos(storage.getTodos())
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('このタスクを削除しますか？')) {
      storage.deleteTodo(id)
      setTodos(storage.getTodos())
    }
  }

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation()
    onTagSelect(tag)
  }

  const renderCard = (todo: Todo, isDone: boolean) => (
    <div
      key={todo.id}
      className={`flex gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm transition-shadow cursor-pointer group
        ${isDone
          ? 'border-gray-100 dark:border-gray-700/50 opacity-60 hover:opacity-80'
          : 'border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:bg-gray-700/50'}`}
      onClick={() => onNavigate({ type: 'edit', id: todo.id })}
    >
      {/* Complete button */}
      <button
        className={`shrink-0 mt-0.5 transition-colors ${
          isDone
            ? 'text-green-500 dark:text-green-400'
            : 'text-gray-300 hover:text-green-500 dark:text-gray-600 dark:hover:text-green-400'
        }`}
        onClick={(e) => handleComplete(todo.id, e)}
        aria-label={isDone ? '未完了に戻す' : '完了にする'}
        style={{ cursor: 'pointer' }}
      >
        {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-base font-medium leading-snug ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
            {todo.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isDone && <Badge priority={todo.priority}>{prioritizeText[todo.priority || 'medium']}</Badge>}
            <button
              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"
              onClick={(e) => handleDelete(todo.id, e)}
              aria-label="削除"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {todo.description && !isDone && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{todo.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {todo.end_date && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {new Date(todo.end_date).toLocaleDateString('ja-JP')}
            </span>
          )}
          {todo.tags && todo.tags.length > 0 && (
            <span className="flex items-center gap-1 flex-wrap">
              <Tag size={12} />
              {todo.tags.map(tag => (
                <span
                  key={tag}
                  onClick={(e) => handleTagClick(e, tag)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    selectedTag === tag
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Tasks</h2>
            {selectedTag && (
              <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-sm font-medium px-3 py-1 rounded-full">
                <Tag size={13} />
                {selectedTag}
                <button onClick={() => onTagSelect(null)} className="ml-0.5 hover:text-indigo-900 dark:hover:text-indigo-100">
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
          <select
            className="h-10 rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:focus:ring-indigo-400"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="created_desc">Newest First</option>
            <option value="due_asc">End Date</option>
            <option value="priority_desc">Priority</option>
          </select>
        </div>

        {/* Tag filter strip */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0">
              {selectedTag ? 'Tag:' : 'Filter:'}
            </span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => onTagSelect(tag)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all shrink-0 ${
                  selectedTag === tag
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                #{tag}
                {selectedTag === tag && <X size={10} />}
              </button>
            ))}
            {selectedTag && (
              <button onClick={() => onTagSelect(null)} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline shrink-0">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-dashed">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No tasks found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {selectedTag ? `"${selectedTag}" のタスクはありません。` : '新しいタスクを作成しましょう。'}
          </p>
          {!selectedTag && (
            <Button onClick={() => onNavigate({ type: 'create' })} className="mt-4 gap-2">
              <Plus size={16} /> Create Task
            </Button>
          )}
        </div>
      )}

      {/* Active tasks */}
      {activeTodos.length > 0 && (
        <div className="space-y-2">
          {activeTodos.map(todo => renderCard(todo, false))}
        </div>
      )}

      {/* Add task button */}
      {sorted.length > 0 && (
        <Button
          onClick={() => onNavigate({ type: 'create' })}
          className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800/50"
          variant="outline"
        >
          <Plus size={18} /> タスクを追加
        </Button>
      )}

      {/* Done tasks — collapsible */}
      {doneTodos.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setDoneOpen(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {doneOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            完了済み ({doneTodos.length})
          </button>
          {doneOpen && (
            <div className="space-y-2">
              {doneTodos.map(todo => renderCard(todo, true))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
