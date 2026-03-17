import { useState } from 'react'
import ListPage from './pages/List'
import CreatePage from './pages/Create'
import EditPage from './pages/Edit'
import BoardPage from './pages/Board'
import GanttPage from './pages/Gantt'
import SettingsPage from './pages/Settings'
import AiChatWidget from './components/AiChatWidget'
import { LayoutList, Kanban, GanttChartSquare, Settings } from 'lucide-react'

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

  const navigateTo = (newPage: PageState) => {
    setPage(newPage)
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

      {/* Sidebar — desktop only */}
      <nav className="hidden sm:flex w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex-col h-screen sticky top-0">
        <div className="p-6">
          <h1
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 cursor-pointer"
            onClick={() => navigateTo({ type: 'list' })}
          >
            ToDo List
          </h1>
        </div>
        <div className="flex-1 px-4 flex flex-col gap-2">
          {NAV_ITEMS.filter(item => item.type !== 'settings').map(({ type, icon: Icon, desktopLabel }) => (
            <button
              key={type}
              onClick={() => navigateTo({ type })}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                page.type === type
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span>{desktopLabel}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
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
            {page.type === 'list'     && <ListPage onNavigate={navigateTo} />}
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
