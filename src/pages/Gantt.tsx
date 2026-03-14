import React from 'react'
import { PageState } from '../App'
import { Badge } from '../components/ui/Badge'
import { storage } from '../storage/local'
import { Todo, TodoStatus } from '../types/todo'
import { Clock, CalendarDays } from 'lucide-react'

interface GanttPageProps {
  onNavigate: (page: PageState) => void
}

type Scale = 'day' | 'week' | 'month'

function startOf(date: Date, scale: Scale): Date {
  const d = new Date(date)
  if (scale === 'month') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  } else if (scale === 'week') {
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    d.setHours(0, 0, 0, 0)
  } else {
    d.setHours(0, 0, 0, 0)
  }
  return d
}

function addPeriod(date: Date, scale: Scale, n: number): Date {
  const d = new Date(date)
  if (scale === 'month') {
    d.setMonth(d.getMonth() + n)
  } else if (scale === 'week') {
    d.setDate(d.getDate() + n * 7)
  } else {
    d.setDate(d.getDate() + n)
  }
  return d
}

function formatPeriodLabel(date: Date, scale: Scale): string {
  if (scale === 'month') {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
  } else if (scale === 'week') {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }
}

const STATUS_COLORS: Record<TodoStatus, { bg: string; border: string; text: string }> = {
  todo:        { bg: 'bg-blue-500',  border: 'border-blue-600',  text: 'text-blue-900' },
  in_progress: { bg: 'bg-red-500',   border: 'border-red-600',   text: 'text-red-900' },
  done:        { bg: 'bg-green-500', border: 'border-green-600', text: 'text-green-900' },
}

export default function GanttPage({ onNavigate }: GanttPageProps) {
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [scale, setScale] = React.useState<Scale>('week')
  const [tooltip, setTooltip] = React.useState<{ todo: Todo; x: number; y: number } | null>(null)

  React.useEffect(() => {
    setTodos(storage.getTodos())
  }, [])

  // Split todos into scheduled (has both dates) and unscheduled
  const scheduledTodos = React.useMemo(
    () => todos.filter(t => t.start_date && t.end_date),
    [todos]
  )
  const unscheduledTodos = React.useMemo(
    () => todos.filter(t => !t.start_date || !t.end_date),
    [todos]
  )

  // Calculate display range
  const { rangeStart, rangeEnd, periods } = React.useMemo(() => {
    const today = new Date()

    let minDate = today
    let maxDate = today

    if (scheduledTodos.length > 0) {
      const starts = scheduledTodos.map(t => new Date(t.start_date!))
      const ends = scheduledTodos.map(t => new Date(t.end_date!))
      minDate = new Date(Math.min(...starts.map(d => d.getTime())))
      maxDate = new Date(Math.max(...ends.map(d => d.getTime())))
    }

    // Pad range with 1 period on each side
    const start = startOf(addPeriod(minDate, scale, -1), scale)
    const end = addPeriod(startOf(maxDate, scale), scale, 2)

    // Build period columns
    const cols: Date[] = []
    let cur = new Date(start)
    while (cur < end) {
      cols.push(new Date(cur))
      cur = addPeriod(cur, scale, 1)
    }

    return { rangeStart: start, rangeEnd: end, periods: cols }
  }, [scheduledTodos, scale])

  const totalMs = rangeEnd.getTime() - rangeStart.getTime()

  function toPercent(date: Date): number {
    return Math.max(0, Math.min(100, ((date.getTime() - rangeStart.getTime()) / totalMs) * 100))
  }

  const todayPct = toPercent(new Date())

  const prioritizeText: Record<string, string> = {
    low: 'Low', medium: 'Medium', high: 'High'
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Gantt</h2>
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg text-sm font-medium">
          {(['day', 'week', 'month'] as Scale[]).map(s => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`px-3 py-1.5 rounded-md transition-all capitalize ${
                scale === s
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {s === 'day' ? 'Days' : s === 'week' ? 'Weeks' : 'Months'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {scheduledTodos.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <CalendarDays className="mx-auto mb-3 opacity-40" size={40} />
            <p className="font-medium">No tasks with both Start Date and End Date set.</p>
            <p className="text-sm mt-1">Add dates to your tasks to see them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(800, periods.length * 80)}px` }}>
              {/* Timeline header */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                <div className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Task
                </div>
                <div className="flex-1 relative">
                  <div className="flex h-full">
                    {periods.map((p, i) => (
                      <div
                        key={i}
                        className="flex-1 px-1 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-center border-r border-gray-100 dark:border-gray-700/50 last:border-r-0"
                      >
                        {formatPeriodLabel(p, scale)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows */}
              {scheduledTodos.map(todo => {
                const start = toPercent(new Date(todo.start_date!))
                const end = toPercent(new Date(todo.end_date!))
                const width = Math.max(0.5, end - start)
                const colors = STATUS_COLORS[todo.status]

                return (
                  <div
                    key={todo.id}
                    className="flex border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 group"
                  >
                    {/* Task label */}
                    <div
                      className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 px-4 py-3 cursor-pointer"
                      onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                    >
                      <p className={`text-sm font-medium truncate ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                        {todo.title}
                      </p>
                      <Badge priority={todo.priority} className="mt-1 text-[10px]">
                        {prioritizeText[todo.priority || 'medium']}
                      </Badge>
                    </div>

                    {/* Bar area */}
                    <div className="flex-1 relative py-3 px-1">
                      {/* Period grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {periods.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-gray-100 dark:border-gray-700/30 last:border-r-0" />
                        ))}
                      </div>

                      {/* Today line */}
                      {todayPct > 0 && todayPct < 100 && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                          style={{ left: `${todayPct}%` }}
                        />
                      )}

                      {/* Gantt bar */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md ${colors.bg} opacity-90 cursor-pointer hover:opacity-100 transition-opacity shadow-sm flex items-center px-2 overflow-hidden`}
                        style={{ left: `${start}%`, width: `${width}%` }}
                        onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                        onMouseEnter={(e) => setTooltip({ todo, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span className="text-white text-[10px] font-semibold truncate whitespace-nowrap">
                          {todo.title}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-xl px-3 py-2 pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-semibold mb-1">{tooltip.todo.title}</p>
          <p className="text-gray-300">
            <span className="text-gray-400">Start:</span>{' '}
            {new Date(tooltip.todo.start_date!).toLocaleDateString('ja-JP')}
          </p>
          <p className="text-gray-300">
            <span className="text-gray-400">End:</span>{' '}
            {new Date(tooltip.todo.end_date!).toLocaleDateString('ja-JP')}
          </p>
        </div>
      )}

      {/* Unscheduled tasks */}
      {unscheduledTodos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock size={16} />
            日付が未設定のタスク ({unscheduledTodos.length})
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 shadow-sm">
            {unscheduledTodos.map(todo => (
              <div
                key={todo.id}
                onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-sm font-medium truncate ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                    {todo.title}
                  </span>
                  <Badge priority={todo.priority} className="text-[10px] shrink-0">
                    {prioritizeText[todo.priority || 'medium']}
                  </Badge>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-4 group-hover:text-indigo-500 transition-colors">
                  {!todo.start_date && !todo.end_date
                    ? '開始日・終了日が未設定'
                    : !todo.start_date
                    ? '開始日が未設定'
                    : '終了日が未設定'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
