import { useState, useEffect } from 'react'
import ListPage from './pages/List'
import CreatePage from './pages/Create'
import EditPage from './pages/Edit'
import BoardPage from './pages/Board'
import GanttPage from './pages/Gantt'
import SettingsPage from './pages/Settings'
import AiChatWidget from './components/AiChatWidget'
import { storage } from './storage/local'
import { LayoutList, Kanban, GanttChartSquare, Settings, Tag, X } from 'lucide-react'

export type PageState =
  | { type: 'list' }
  | { type: 'board' }
  | { type: 'gantt' }
  | { type: 'settings' }
  | { type: 'create' }
  | { type: 'edit'; id: string }

const NAV_ITEMS = [
  { type: 'list' as const,     icon: LayoutList,       label: 'List',     desktopLabel: 'List View' },
  { type: 'board' as const,    icon: Kanban,            label: 'Board',    desktopLabel: 'Board View' },
  { type: 'gantt' as const,    icon: GanttChartSquare, label: 'Gantt',    desktopLabel: 'Gantt View' },
  { type: 'settings' as const, icon: Settings,          label: 'Settings', desktopLabel: 'Settings' },
]

function App() {
  const [page, setPage] = useState<PageState>({ type: 'list' })
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])

  // Reload tags whenever we navigate (picks up newly created tags)
  useEffect(() => {
    const todos = storage.getTodos()
    const tagSet = new Set<string>()
    todos.forEach(t => t.tags?.forEach(tag => tagSet.add(tag)))
    setAllTags(Array.from(tagSet).sort())
  }, [page])

  const navigateTo = (newPage: PageState) => {
    setPage(newPage)
  }

  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(prev => prev === tag ? null : tag)
    // Always jump to list view when a tag is picked from the sidebar
    if (tag !== null) navigateTo({ type: 'list' })
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

      {/* Sidebar — desktop only */}
      <nav className="hidden sm:flex w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex-col h-screen sticky top-0 overflow-hidden">
        <div className="p-6 shrink-0">
          <h1
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 cursor-pointer"
            onClick={() => navigateTo({ type: 'list' })}
          >
            ToDo List
          </h1>
        </div>

        {/* Main nav */}
        <div className="px-4 flex flex-col gap-2 shrink-0">
          {NAV_ITEMS.filter(item => item.type !== 'settings').map(({ type, icon: Icon, desktopLabel }) => (
            <button
              key={type}
              onClick={() => navigateTo({ type })}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                page.type === type && selectedTag === null
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span>{desktopLabel}</span>
            </button>
          ))}
        </div>

        {/* Tag filter section */}
        {allTags.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 mt-4 px-4">
            <div className="flex items-center justify-between mb-2 px-1 shrink-0">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Tags
              </span>
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-0.5"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex flex-col gap-1 pb-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagSelect(tag)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left w-full ${
                    selectedTag === tag
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`}
                >
                  <Tag size={14} className="shrink-0" />
                  <span className="truncate">{tag}</span>
                  {selectedTag === tag && <X size={12} className="ml-auto shrink-0 opacity-60" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {!allTags.length && <div className="flex-1" />}

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button
            onClick={() => navigateTo({ type: 'settings' })}
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
      </nav>

      {/* Content area — pb-16 reserves space for the mobile bottom nav */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden pb-16 sm:pb-0">
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 transition-all duration-300">
          <div className="mx-auto w-full min-w-0">
            {page.type === 'list'     && <ListPage onNavigate={navigateTo} selectedTag={selectedTag} onTagSelect={handleTagSelect} />}
            {page.type === 'board'    && <BoardPage onNavigate={navigateTo} />}
            {page.type === 'gantt'    && <GanttPage onNavigate={navigateTo} />}
            {page.type === 'settings' && <SettingsPage />}
            {page.type === 'create'   && <CreatePage onNavigate={navigateTo} />}
            {page.type === 'edit'     && <EditPage id={page.id} onNavigate={navigateTo} />}
          </div>
        </main>
        {page.type !== 'settings' && (
          <AiChatWidget onNavigateToSettings={() => navigateTo({ type: 'settings' })} />
        )}
      </div>

      {/* Bottom navigation — mobile only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        {NAV_ITEMS.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => navigateTo({ type })}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              page.type === type
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>

    </div>
  )
}

export default App
