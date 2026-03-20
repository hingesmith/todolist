import ListPage from './pages/List'
import CreatePage from './pages/Create'
import EditPage from './pages/Edit'
import BoardPage from './pages/Board'
import GanttPage from './pages/Gantt'
import SettingsPage from './pages/Settings'
import MemoListPage from './pages/MemoList'
import MemoEditPage from './pages/MemoEdit'
import AiChatWidget from './components/AiChatWidget'
import { X } from 'lucide-react'

import { TASK_VIEWS } from './types/navigation'
import { useAppState } from './hooks/useAppState'
import { ViewSwitcher } from './components/layout/ViewSwitcher'
import { SidebarContent } from './components/layout/Sidebar'
import { MobileHeader } from './components/layout/MobileHeader'

function App() {
  const {
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
  } = useAppState()

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
        <MobileHeader
          page={page}
          selectedTags={selectedTags}
          selectedAssignees={selectedAssignees}
          onMenuClick={() => setMobileNavOpen(true)}
          onNavigate={navigateTo}
          onTagClear={handleTagClear}
          onAssigneeClear={handleAssigneeClear}
        />

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
            {page.type === 'gantt'     && <GanttPage onNavigate={navigateTo} selectedTags={selectedTags} onTagSelect={handleTagSelect} onTagClear={handleTagClear} />}
            {page.type === 'settings'  && <SettingsPage />}
            {page.type === 'create'    && <CreatePage onNavigate={navigateTo} onBack={() => navigateTo(prevPage)} />}
            {page.type === 'edit'      && <EditPage id={page.id} onNavigate={navigateTo} onBack={() => navigateTo(prevPage)} />}
            {page.type === 'memo'      && <MemoListPage folder={page.folder} onNavigate={navigateTo} />}
            {page.type === 'memo-edit' && <MemoEditPage id={page.id} folder={page.folder} draft={page.draft} onNavigate={navigateTo} />}
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
