import { Tag, User, X } from 'lucide-react'

interface FilterStripProps {
  allTags: string[]
  selectedTags: string[]
  onTagSelect: (tag: string) => void
  onTagClear: () => void
  allAssignees?: string[]
  selectedAssignees?: string[]
  onAssigneeSelect?: (assignee: string) => void
  onAssigneeClear?: () => void
}

export function FilterStrip({
  allTags,
  selectedTags,
  onTagSelect,
  onTagClear,
  allAssignees = [],
  selectedAssignees = [],
  onAssigneeSelect,
  onAssigneeClear,
}: FilterStripProps) {
  if (allTags.length === 0 && allAssignees.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 flex items-center gap-1">
            <Tag size={11} />Tag:
          </span>
          {allTags.map(tag => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => onTagSelect(tag)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all shrink-0 ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                #{tag}
                {active && <X size={10} />}
              </button>
            )
          })}
          {selectedTags.length > 0 && (
            <button onClick={onTagClear} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline shrink-0">
              Clear
            </button>
          )}
        </div>
      )}
      {allAssignees.length > 0 && onAssigneeSelect && onAssigneeClear && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 flex items-center gap-1">
            <User size={11} />担当:
          </span>
          {allAssignees.map(a => {
            const active = selectedAssignees.includes(a)
            return (
              <button
                key={a}
                onClick={() => onAssigneeSelect(a)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all shrink-0 ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                {a}
                {active && <X size={10} />}
              </button>
            )
          })}
          {selectedAssignees.length > 0 && (
            <button onClick={onAssigneeClear} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline shrink-0">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
