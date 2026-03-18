import React, { useState, useEffect } from 'react'
import { PageState } from '../App'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'
import { storage } from '../storage/local'
import { Todo, TodoStatus, TodoPriority } from '../types/todo'
import { validateTodo, getValidationErrors } from '../validation/schema'

interface EditPageProps {
  id: string
  onNavigate: (page: PageState) => void
  onBack: () => void
}

export default function EditPage({ id, onNavigate, onBack }: EditPageProps) {
  const [formData, setFormData] = useState<Partial<Todo> | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [depInput, setDepInput] = useState('')
  const [assigneeInput, setAssigneeInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notFound, setNotFound] = useState(false)
  const [availableTodos, setAvailableTodos] = useState<Todo[]>([])
  const [members, setMembers] = useState<string[]>([])

  useEffect(() => {
    setAvailableTodos(storage.getTodos())
    setMembers(storage.getMembers())
    const todo = storage.getTodo(id)
    if (todo) {
      // Format datetime for datetime-local input
      if (todo.end_date) {
        try {
          todo.end_date = todo.end_date.slice(0, 10)
        } catch (e) {
          console.error('Failed to parse end date', e)
        }
      }
      if (todo.start_date) {
        try {
          todo.start_date = todo.start_date.slice(0, 10)
        } catch (e) {
          console.error('Failed to parse start date', e)
        }
      }
      setFormData(todo)
    } else {
      setNotFound(true)
    }
  }, [id])

  if (notFound || !formData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Task not found</h2>
        <Button className="mt-4" onClick={onBack}>
          Back to List
        </Button>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev: Partial<Todo> | null) => ({ ...prev!, [name]: value }))
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!tagInput.trim()) return;

    if (!formData.tags?.includes(tagInput.trim())) {
      setFormData((prev: Partial<Todo> | null) => ({
        ...prev!,
        tags: [...(prev!.tags || []), tagInput.trim()]
      }))
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev: Partial<Todo> | null) => ({
      ...prev!,
      tags: prev!.tags?.filter((tag: string) => tag !== tagToRemove)
    }))
  }

  const handleAddDependency = () => {
    if (!depInput) return
    if (!formData?.dependencies?.includes(depInput)) {
      setFormData((prev: Partial<Todo> | null) => ({
        ...prev!,
        dependencies: [...(prev!.dependencies || []), depInput]
      }))
    }
    setDepInput('')
  }

  const handleRemoveDependency = (idToRemove: string) => {
    setFormData((prev: Partial<Todo> | null) => ({
      ...prev!,
      dependencies: prev!.dependencies?.filter((dId: string) => dId !== idToRemove)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const todo: Todo = {
      ...(formData as Todo),
      status: formData.status as TodoStatus,
      priority: formData.priority as TodoPriority,
      title: formData.title || '',
      updated_at: new Date().toISOString(),
    }

    if (formData.end_date) {
      todo.end_date = formData.end_date
    } else {
      delete todo.end_date
    }

    if (formData.start_date) {
      todo.start_date = formData.start_date
    } else {
      delete todo.start_date
    }

    if (!todo.description) {
      delete todo.description
    }

    if (todo.tags?.length === 0) {
      delete todo.tags
    }

    if (todo.dependencies?.length === 0) {
      delete todo.dependencies
    }

    if (todo.assignees?.length === 0) {
      delete todo.assignees
    } else if (todo.assignees) {
      todo.assignees.forEach(a => storage.addMember(a))
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

    storage.updateTodo(todo)
    onNavigate({ type: 'list' })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Edit Task</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Update the details of your task.</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              value={formData.start_date || ''}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              value={formData.end_date || ''}
              onChange={handleChange}
              error={!!errors.end_date}
            />
            {errors.end_date && <p className="text-sm text-red-500">{errors.end_date}</p>}
          </div>
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

        <div className="space-y-2">
          <Label htmlFor="dependencies">Dependencies (前提タスク)</Label>
          <div className="flex gap-2">
            <Select
              id="dependencies"
              name="dependencies"
              value={depInput}
              onChange={(e) => setDepInput(e.target.value)}
              options={[
                { label: 'Select a task...', value: '' },
                ...availableTodos
                  .filter(t => t.id !== id && !formData.dependencies?.includes(t.id))
                  .map(t => ({ label: t.title, value: t.id }))
              ]}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={handleAddDependency} disabled={!depInput}>Add</Button>
          </div>
          {formData.dependencies && formData.dependencies.length > 0 && (
            <div className="flex flex-col gap-2 mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 max-h-40 overflow-y-auto">
              {formData.dependencies.map((depId: string) => {
                const depTask = availableTodos.find(t => t.id === depId)
                return (
                  <div key={depId} className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 shadow-sm text-sm">
                    <span className="truncate flex-1 font-medium text-gray-700 dark:text-gray-300">
                      {depTask ? depTask.title : 'Unknown Task'}
                    </span>
                    <button type="button" onClick={() => handleRemoveDependency(depId)} className="text-gray-400 hover:text-red-500 shrink-0">
                      &times; Remove
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Assignees */}
        <div className="space-y-2">
          <Label htmlFor="assignees">担当者</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="assignees"
                list="members-list-edit"
                value={assigneeInput}
                onChange={e => setAssigneeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const v = assigneeInput.trim()
                  if (v && !formData.assignees?.includes(v)) {
                    setFormData(prev => ({ ...prev!, assignees: [...(prev!.assignees || []), v] }))
                  }
                  setAssigneeInput('')
                }}
                placeholder="名前を入力して Enter"
              />
              <datalist id="members-list-edit">
                {members.filter(m => !formData.assignees?.includes(m)).map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <Button type="button" variant="secondary" onClick={() => {
              const v = assigneeInput.trim()
              if (v && !formData.assignees?.includes(v)) {
                setFormData(prev => ({ ...prev!, assignees: [...(prev!.assignees || []), v] }))
              }
              setAssigneeInput('')
            }}>Add</Button>
          </div>
          {formData.assignees && formData.assignees.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.assignees.map((a: string) => (
                <span key={a} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2.5 py-1 rounded-full text-sm">
                  {a}
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev!, assignees: prev!.assignees?.filter(x => x !== a) }))} className="hover:text-purple-900 dark:hover:text-purple-100">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="ghost" onClick={onBack}>
            Cancel
          </Button>
          <Button type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
