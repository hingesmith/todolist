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

function App() {
  const [page, setPage] = useState<PageState>({ type: 'list' })

  const navigateTo = (newPage: PageState) => {
    setPage(newPage)
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <nav className="w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex flex-col h-screen sticky top-0">
        <div className="p-6">
          <h1
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 cursor-pointer"
            onClick={() => navigateTo({ type: 'list' })}
          >
            ToDo List
          </h1>
        </div>
        <div className="flex-1 px-4 flex flex-col gap-2">
          <button
            onClick={() => navigateTo({ type: 'list' })}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${page.type === 'list'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
          >
            <LayoutList size={20} />
            <span>List View</span>
          </button>
          <button
            onClick={() => navigateTo({ type: 'board' })}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${page.type === 'board'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
          >
            <Kanban size={20} />
            <span>Board View</span>
          </button>
          <button
            onClick={() => navigateTo({ type: 'gantt' })}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${page.type === 'gantt'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
          >
            <GanttChartSquare size={20} />
            <span>Gantt View</span>
          </button>
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => navigateTo({ type: 'settings' })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${page.type === 'settings'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-x-hidden p-8 transition-all duration-300">
        <div className="mx-auto w-full min-w-0">
          {page.type === 'list' && <ListPage onNavigate={navigateTo} />}
          {page.type === 'board' && <BoardPage onNavigate={navigateTo} />}
          {page.type === 'gantt' && <GanttPage onNavigate={navigateTo} />}
          {page.type === 'settings' && <SettingsPage />}
          {page.type === 'create' && <CreatePage onNavigate={navigateTo} />}
          {page.type === 'edit' && <EditPage id={page.id} onNavigate={navigateTo} />}
        </div>
      </main>
      <AiChatWidget onNavigateToSettings={() => navigateTo({ type: 'settings' })} />
    </div>
  )
}

export default App
