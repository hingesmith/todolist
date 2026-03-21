import { Menu, Tag, User, X } from 'lucide-react'
import { PageState } from '../../types/navigation'

interface MobileHeaderProps {
  selectedTags: string[]
  selectedAssignees: string[]
  onMenuClick: () => void
  onNavigate: (page: PageState) => void
  onTagClear: () => void
  onAssigneeClear: () => void
}

export function MobileHeader({ selectedTags, selectedAssignees, onMenuClick, onNavigate, onTagClear, onAssigneeClear }: MobileHeaderProps) {
  return (
    <header className="sm:hidden flex items-center gap-2 h-14 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <button
        onClick={onMenuClick}
        className="text-gray-600 dark:text-gray-300 p-1 shrink-0"
      >
        <Menu size={24} />
      </button>
      <h1
        className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 flex-1 cursor-pointer min-w-0 truncate"
        onClick={() => onNavigate({ type: 'list' })}
      >
        ToDo List
      </h1>
      {selectedTags.length > 0 && (
        <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
          <Tag size={11} />
          <span className="max-w-[80px] truncate">
            {selectedTags.length === 1 ? selectedTags[0] : `${selectedTags.length} tags`}
          </span>
          <button onClick={onTagClear} className="ml-0.5"><X size={11} /></button>
        </span>
      )}
      {selectedAssignees.length > 0 && (
        <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
          <User size={11} />
          <span className="max-w-[80px] truncate">
            {selectedAssignees.length === 1 ? selectedAssignees[0] : `${selectedAssignees.length} people`}
          </span>
          <button onClick={onAssigneeClear} className="ml-0.5"><X size={11} /></button>
        </span>
      )}
    </header>
  )
}
