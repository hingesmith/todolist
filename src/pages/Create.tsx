import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { PageState } from '../App'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'
import { storage } from '../storage/local'
import { Todo, TodoStatus, TodoPriority } from '../types/todo'
import { validateTodo, getValidationErrors } from '../validation/schema'

interface CreatePageProps {
  onNavigate: (page: PageState) => void
}

export default function CreatePage({ onNavigate }: CreatePageProps) {
  const [formData, setFormData] = useState<Partial<Todo>>({
    status: 'todo',
    priority: 'medium',
    tags: []
  })
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev: Partial<Todo>) => ({ ...prev, [name]: value }))
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!tagInput.trim()) return;

    if (!formData.tags?.includes(tagInput.trim())) {
      setFormData((prev: Partial<Todo>) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }))
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev: Partial<Todo>) => ({
      ...prev,
      tags: prev.tags?.filter((tag: string) => tag !== tagToRemove)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const now = new Date().toISOString()
    const todo: Todo = {
      ...formData,
      id: uuidv4(),
      title: formData.title || '',
      status: formData.status as TodoStatus,
      priority: formData.priority as TodoPriority,
      created_at: now,
      updated_at: now,
    }

    if (formData.due_date) {
      todo.due_date = new Date(formData.due_date).toISOString()
    } else {
      delete todo.due_date
    }

    if (!todo.description) {
      delete todo.description
    }

    if (todo.tags?.length === 0) {
      delete todo.tags
    }

    const isValid = validateTodo(todo)

    if (!isValid && validateTodo.errors) {
      const errs = getValidationErrors(validateTodo.errors)
      const formErrors: Record<string, string> = {}
      errs.forEach((err: any) => {
        const field = err.path.replace('/', '') || 'title'
        formErrors[field] = err.message || 'Invalid field'
      })

      if (!formData.title) {
        formErrors['title'] = 'Title is required'
      }
      setErrors(formErrors)
      return
    }

    storage.addTodo(todo)
    onNavigate({ type: 'list' })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Create Task</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Add a new task to your list.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">

        <div className="space-y-2">
          <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
          <Input
            id="title"
            name="title"
            value={formData.title || ''}
            onChange={handleChange}
            placeholder="What needs to be done?"
            error={!!errors.title}
          />
          {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            placeholder="Add some details..."
            rows={3}
            className="flex w-full rounded-md border border-gray-300 bg-transparent py-2 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-gray-700 dark:text-gray-50 dark:focus:ring-indigo-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={formData.status || 'todo'}
              onChange={handleChange}
              options={[
                { label: 'To Do', value: 'todo' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Done', value: 'done' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              id="priority"
              name="priority"
              value={formData.priority || 'medium'}
              onChange={handleChange}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
              ]}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Due Date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="datetime-local"
            value={formData.due_date || ''}
            onChange={handleChange}
            error={!!errors.due_date}
          />
          {errors.due_date && <p className="text-sm text-red-500">{errors.due_date}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <div className="flex gap-2">
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add a tag and press Enter"
            />
            <Button type="button" variant="secondary" onClick={handleAddTag}>Add</Button>
          </div>
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.tags.map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2.5 py-1 rounded-full text-sm">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-indigo-900 dark:hover:text-indigo-100">
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="ghost" onClick={() => onNavigate({ type: 'list' })}>
            Cancel
          </Button>
          <Button type="submit">
            Create Task
          </Button>
        </div>
      </form>
    </div>
  )
}
