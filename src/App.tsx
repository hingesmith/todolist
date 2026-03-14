import { useState } from 'react'
import ListPage from './pages/List'
import CreatePage from './pages/Create'
import EditPage from './pages/Edit'

export type PageState =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'edit'; id: string }

function App() {
  const [page, setPage] = useState<PageState>({ type: 'list' })

  const navigateTo = (newPage: PageState) => {
    setPage(newPage)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 cursor-pointer"
            onClick={() => navigateTo({ type: 'list' })}
          >
            ToDo List
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {page.type === 'list' && <ListPage onNavigate={navigateTo} />}
        {page.type === 'create' && <CreatePage onNavigate={navigateTo} />}
        {page.type === 'edit' && <EditPage id={page.id} onNavigate={navigateTo} />}
      </main>
    </div>
  )
}

export default App
