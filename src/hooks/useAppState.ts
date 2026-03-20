import { useState, useEffect } from 'react'
import { PageState, TASK_VIEWS } from '../types/navigation'
import { storage } from '../storage/local'

export function useAppState() {
  const [page, setPage] = useState<PageState>(() => {
    try {
      const saved = localStorage.getItem('todolist_page')
      return saved ? JSON.parse(saved) : { type: 'list' }
    } catch { return { type: 'list' } }
  })
  const [prevPage, setPrevPage] = useState<PageState>(() => {
    try {
      const saved = localStorage.getItem('todolist_prev_page')
      return saved ? JSON.parse(saved) : { type: 'list' }
    } catch { return { type: 'list' } }
  })
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('todolist_selected_tags')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('todolist_selected_assignees')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [allAssignees, setAllAssignees] = useState<string[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('todolist_page', JSON.stringify(page))
  }, [page])

  useEffect(() => {
    localStorage.setItem('todolist_prev_page', JSON.stringify(prevPage))
  }, [prevPage])

  useEffect(() => {
    localStorage.setItem('todolist_selected_tags', JSON.stringify(selectedTags))
  }, [selectedTags])

  useEffect(() => {
    localStorage.setItem('todolist_selected_assignees', JSON.stringify(selectedAssignees))
  }, [selectedAssignees])

  useEffect(() => {
    const todos = storage.getTodos()
    const tagSet = new Set<string>()
    const assigneeSet = new Set<string>()
    todos.forEach(t => {
      t.tags?.forEach(tag => tagSet.add(tag))
      t.assignees?.forEach(a => assigneeSet.add(a))
    })
    setAllTags(Array.from(tagSet).sort())
    setAllAssignees(Array.from(assigneeSet).sort())
  }, [page])

  const navigateTo = (newPage: PageState) => {
    if (newPage.type === 'edit' || newPage.type === 'create') setPrevPage(page)
    setPage(newPage)
    setMobileNavOpen(false)
  }

  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
    if (!(TASK_VIEWS as readonly string[]).includes(page.type)) navigateTo({ type: 'list' })
    else setMobileNavOpen(false)
  }

  const handleTagClear = () => {
    setSelectedTags([])
    setMobileNavOpen(false)
  }

  const handleAssigneeSelect = (assignee: string) => {
    setSelectedAssignees(prev => prev.includes(assignee) ? prev.filter(a => a !== assignee) : [...prev, assignee])
    if (!(TASK_VIEWS as readonly string[]).includes(page.type)) navigateTo({ type: 'list' })
    else setMobileNavOpen(false)
  }

  const handleAssigneeClear = () => {
    setSelectedAssignees([])
    setMobileNavOpen(false)
  }

  return {
    page,
    prevPage,
    selectedTags,
    allTags,
    selectedAssignees,
    allAssignees,
    mobileNavOpen,
    setMobileNavOpen,
    navigateTo,
    handleTagSelect,
    handleTagClear,
    handleAssigneeSelect,
    handleAssigneeClear,
  }
}
