import { CheckSquare, FileText, Settings, Tag, User, X } from 'lucide-react'
import { PageState, TASK_VIEWS } from '../../types/navigation'

const NAV_ITEMS = [
  { type: 'list' as const, icon: CheckSquare, desktopLabel: 'Tasks' },
  { type: 'memo' as const, icon: FileText,    desktopLabel: 'Memo'  },
]

export interface SidebarContentProps {
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

export function SidebarContent({ page, allTags, selectedTags, allAssignees, selectedAssignees, onNavigate, onTagSelect, onTagClear, onAssigneeSelect, onAssigneeClear }: SidebarContentProps) {
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
