import { useState, useEffect } from 'react'
import ListPage from './pages/List'
import CreatePage from './pages/Create'
import EditPage from './pages/Edit'
import BoardPage from './pages/Board'
import GanttPage from './pages/Gantt'
import SettingsPage from './pages/Settings'
import MemoListPage from './pages/MemoList'
import MemoEditPage from './pages/MemoEdit'
import AiChatWidget from './components/AiChatWidget'
import { storage } from './storage/local'
import { MemoType } from './types/memo'
import { LayoutList, Kanban, GanttChartSquare, FileText, CheckSquare, Settings, Tag, X, Menu, User } from 'lucide-react'

export type PageState =
  | { type: 'list' }
  | { type: 'board' }
  | { type: 'gantt' }
  | { type: 'settings' }
  | { type: 'create' }
  | { type: 'edit'; id: string }
  | { type: 'memo' }
  | { type: 'memo-edit'; id?: string; draft?: { title: string; content: string; type: MemoType } }

const TASK_VIEWS = ['list', 'board', 'gantt'] as const
type TaskViewType = typeof TASK_VIEWS[number]

const VIEW_ITEMS: { type: TaskViewType; icon: React.ElementType; label: string }[] = [
  { type: 'list',  icon: LayoutList,       label: 'List'  },
  { type: 'board', icon: Kanban,            label: 'Board' },
  { type: 'gantt', icon: GanttChartSquare, label: 'Gantt' },
]

function ViewSwitcher({ page, onNavigate }: { page: PageState; onNavigate: (p: PageState) => void }) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg gap-0.5">
      {VIEW_ITEMS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onNavigate({ type })}
          title={label}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
            page.type === type
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Icon size={15} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

const NAV_ITEMS = [
  { type: 'list' as const, icon: CheckSquare, desktopLabel: 'Tasks' },
  { type: 'memo' as const, icon: FileText,    desktopLabel: 'Memo'  },
]

interface SidebarContentProps {
  page: PageState
  allTags: string[]
  selectedTags: string[]
  allAssignees: string[]
  selectedAssignees: string[]
  onNavigate: (page: PageState) => void
  onTagSelect: (tag: string) => void
  onTagClear: () => void
  onAssigneeSelect: (assignee: string) => void
  onAssigneeClear: () => void
}

function SidebarContent({ page, allTags, selectedTags, allAssignees, selectedAssignees, onNavigate, onTagSelect, onTagClear, onAssigneeSelect, onAssigneeClear }: SidebarContentProps) {
  return (
    <>
      {/* Main nav */}
      <div className="px-4 flex flex-col gap-2 shrink-0">
        {NAV_ITEMS.map(({ type, icon: Icon, desktopLabel }) => (
          <button
            key={type}
            onClick={() => onNavigate({ type })}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              (
                (type === 'list' && (TASK_VIEWS as readonly string[]).includes(page.type) && selectedTags.length === 0) ||
                (type === 'memo' && (page.type === 'memo' || page.type === 'memo-edit')) ||
                (type !== 'list' && type !== 'memo' && page.type === type && selectedTags.length === 0)
              )
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
            }`}
          >
            <Icon size={20} />
            <span>{desktopLabel}</span>
          </button>
        ))}
      </div>

      {/* Filter sections */}
      {(allTags.length > 0 || allAssignees.length > 0) ? (
        <div className="flex-1 flex flex-col min-h-0 mt-4 px-4 overflow-y-auto gap-4">
          {allTags.length > 0 && (
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Tags
                </span>
                {selectedTags.length > 0 && (
                  <button
                    onClick={onTagClear}
                    className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-0.5"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 pb-2">
                {allTags.map(tag => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => onTagSelect(tag)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left w-full ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                      }`}
                    >
                      <Tag size={14} className="shrink-0" />
                      <span className="truncate">{tag}</span>
                      {active && <X size={12} className="ml-auto shrink-0 opacity-60" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {allAssignees.length > 0 && (
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Assignees
                </span>
                {selectedAssignees.length > 0 && (
                  <button
                    onClick={onAssigneeClear}
                    className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-0.5"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 pb-2">
                {allAssignees.map(assignee => {
                  const active = selectedAssignees.includes(assignee)
                  return (
                    <button
                      key={assignee}
                      onClick={() => onAssigneeSelect(assignee)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left w-full ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                      }`}
                    >
                      <User size={14} className="shrink-0" />
                      <span className="truncate">{assignee}</span>
                      {active && <X size={12} className="ml-auto shrink-0 opacity-60" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Settings */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
        <button
          onClick={() => onNavigate({ type: 'settings' })}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            page.type === 'settings'
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
          }`}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </>
  )
}

function App() {
  const [page, setPage] = useState<PageState>({ type: 'list' })
  const [prevPage, setPrevPage] = useState<PageState>({ type: 'list' })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [allAssignees, setAllAssignees] = useState<string[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

      {/* Desktop sidebar */}
      <nav className="hidden sm:flex w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex-col overflow-hidden">
        <div className="p-6 shrink-0">
          <h1
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 cursor-pointer"
            onClick={() => navigateTo({ type: 'list' })}
          >
            ToDo List
          </h1>
        </div>
        <SidebarContent
          page={page}
          allTags={allTags}
          selectedTags={selectedTags}
          allAssignees={allAssignees}
          selectedAssignees={selectedAssignees}
          onNavigate={navigateTo}
          onTagSelect={handleTagSelect}
          onTagClear={handleTagClear}
          onAssigneeSelect={handleAssigneeSelect}
          onAssigneeClear={handleAssigneeClear}
        />
      </nav>

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          {/* Sidebar panel */}
          <div className="w-72 bg-white dark:bg-gray-800 shadow-xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 shrink-0">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                ToDo List
              </h1>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 p-1"
              >
                <X size={22} />
              </button>
            </div>
            <SidebarContent
              page={page}
              allTags={allTags}
              selectedTags={selectedTags}
              allAssignees={allAssignees}
              selectedAssignees={selectedAssignees}
              onNavigate={navigateTo}
              onTagSelect={handleTagSelect}
              onTagClear={handleTagClear}
              onAssigneeSelect={handleAssigneeSelect}
              onAssigneeClear={handleAssigneeClear}
            />
          </div>
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Mobile header */}
        <header className="sm:hidden flex items-center gap-2 h-14 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="text-gray-600 dark:text-gray-300 p-1 shrink-0"
          >
            <Menu size={24} />
          </button>
          <h1
            className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 flex-1 cursor-pointer min-w-0 truncate"
            onClick={() => navigateTo({ type: 'list' })}
          >
            ToDo List
          </h1>
          {(TASK_VIEWS as readonly string[]).includes(page.type) && (
            <ViewSwitcher page={page} onNavigate={navigateTo} />
          )}
          {!(TASK_VIEWS as readonly string[]).includes(page.type) && selectedTags.length > 0 && (
            <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
              <Tag size={11} />
              <span className="max-w-[80px] truncate">
                {selectedTags.length === 1 ? selectedTags[0] : `${selectedTags.length} tags`}
              </span>
              <button onClick={handleTagClear} className="ml-0.5"><X size={11} /></button>
            </span>
          )}
          {!(TASK_VIEWS as readonly string[]).includes(page.type) && selectedAssignees.length > 0 && (
            <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
              <User size={11} />
              <span className="max-w-[80px] truncate">
                {selectedAssignees.length === 1 ? selectedAssignees[0] : `${selectedAssignees.length} people`}
              </span>
              <button onClick={handleAssigneeClear} className="ml-0.5"><X size={11} /></button>
            </span>
          )}
        </header>

        {/* View switcher bar – only on task pages, desktop */}
        {(TASK_VIEWS as readonly string[]).includes(page.type) && (
          <div className="hidden sm:flex justify-end px-8 pt-5 pb-0 shrink-0">
            <ViewSwitcher page={page} onNavigate={navigateTo} />
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 transition-all duration-300">
          <div className="mx-auto w-full min-w-0">
            {page.type === 'list'      && <ListPage onNavigate={navigateTo} selectedTags={selectedTags} onTagSelect={handleTagSelect} onTagClear={handleTagClear} selectedAssignees={selectedAssignees} onAssigneeSelect={handleAssigneeSelect} onAssigneeClear={handleAssigneeClear} />}
            {page.type === 'board'     && <BoardPage onNavigate={navigateTo} selectedTags={selectedTags} onTagSelect={handleTagSelect} onTagClear={handleTagClear} selectedAssignees={selectedAssignees} onAssigneeSelect={handleAssigneeSelect} onAssigneeClear={handleAssigneeClear} />}
            {page.type === 'gantt'     && <GanttPage onNavigate={navigateTo} />}
            {page.type === 'settings'  && <SettingsPage />}
            {page.type === 'create'    && <CreatePage onNavigate={navigateTo} onBack={() => navigateTo(prevPage)} />}
            {page.type === 'edit'      && <EditPage id={page.id} onNavigate={navigateTo} onBack={() => navigateTo(prevPage)} />}
            {page.type === 'memo'      && <MemoListPage onNavigate={navigateTo} />}
            {page.type === 'memo-edit' && <MemoEditPage id={page.id} draft={page.draft} onNavigate={navigateTo} />}
          </div>
        </main>

        {page.type !== 'settings' && (
          <AiChatWidget onNavigateToSettings={() => navigateTo({ type: 'settings' })} />
        )}
      </div>

    </div>
  )
}

export default App
