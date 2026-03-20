import { useState, useEffect } from 'react'
import { storage } from '../storage/local'
import { Plus, Check } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface QuickAddBarProps {
  onTaskAdded: () => void
  selectedTags: string[]
  allTags: string[]
}

export default function QuickAddBar({ onTaskAdded, selectedTags, allTags }: QuickAddBarProps) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>(selectedTags)
  const [added, setAdded] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')

  useEffect(() => {
    setTags(selectedTags)
  }, [selectedTags])

  const handleAdd = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    storage.addTodo({
      id: uuidv4(),
      title: trimmed,
      status: 'todo',
      priority: undefined,
      tags: tags.length > 0 ? tags : undefined,
      created_at: new Date().toISOString(),
    })
    setTitle('')
    setTags(selectedTags)
    onTaskAdded()
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const availableTags = [...new Set([...allTags, ...tags])]

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
      {/* タグ選択エリア */}
      <div className="px-4 pt-2.5 pb-1.5 flex flex-wrap items-center gap-1.5 border-b border-gray-100 dark:border-gray-700">
        {availableTags.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              tags.includes(tag)
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tag}
          </button>
        ))}
        <input
          value={newTagInput}
          onChange={e => setNewTagInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const t = newTagInput.trim()
              if (t && !tags.includes(t)) setTags(prev => [...prev, t])
              setNewTagInput('')
            }
          }}
          placeholder="新しいタグ..."
          className="bg-transparent text-xs outline-none text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-600 w-24"
        />
      </div>

      {/* タイトル入力エリア */}
      <div className="px-4 py-2.5 flex items-center gap-3">
        <Plus size={16} className="text-gray-400 shrink-0" />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="タスクのタイトルを入力して Enter で追加..."
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        {added && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 shrink-0">
            <Check size={12} /> 追加しました
          </span>
        )}
      </div>
    </div>
  )
}
