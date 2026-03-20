import React from 'react'
import { LayoutList, Kanban, GanttChartSquare } from 'lucide-react'
import { PageState, TaskViewType } from '../../types/navigation'

const VIEW_ITEMS: { type: TaskViewType; icon: React.ElementType; label: string }[] = [
  { type: 'list',  icon: LayoutList,       label: 'List'  },
  { type: 'board', icon: Kanban,            label: 'Board' },
  { type: 'gantt', icon: GanttChartSquare, label: 'Gantt' },
]

export function ViewSwitcher({ page, onNavigate }: { page: PageState; onNavigate: (p: PageState) => void }) {
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
