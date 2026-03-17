import React from 'react'
import { PageState } from '../App'
import { Badge } from '../components/ui/Badge'
import { storage } from '../storage/local'
import { Todo, TodoStatus } from '../types/todo'
import { Clock, CalendarDays } from 'lucide-react'

interface GanttPageProps {
  onNavigate: (page: PageState) => void
}

const ROW_HEIGHT = 64

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
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }
}

const STATUS_COLORS: Record<TodoStatus, { bg: string }> = {
  todo:        { bg: 'bg-blue-500' },
  in_progress: { bg: 'bg-red-500' },
  done:        { bg: 'bg-green-500' },
}

export default function GanttPage({ onNavigate }: GanttPageProps) {
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [scale, setScale] = React.useState<Scale>('week')
  const [tooltip, setTooltip] = React.useState<{ todo: Todo; x: number; y: number } | null>(null)

  // For dependency arrow measurement
  const rowsDivRef = React.useRef<HTMLDivElement | null>(null)
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null)
  const barRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const [arrowData, setArrowData] = React.useState<Array<{ key: string; d: string }>>([])
  const [svgDims, setSvgDims] = React.useState({ w: 0, h: 0 })
  const [measureTick, setMeasureTick] = React.useState(0)

  // Callback ref: fires when rows container mounts/unmounts
  const rowsContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    rowsDivRef.current = node
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = null
    }
    if (node) {
      resizeObserverRef.current = new ResizeObserver(() => {
        setMeasureTick(t => t + 1)
      })
      resizeObserverRef.current.observe(node)
    }
  }, [])

  React.useEffect(() => {
    setTodos(storage.getTodos())
  }, [])

  const scheduledTodos = React.useMemo(
    () => todos.filter(t => t.start_date && t.end_date),
    [todos]
  )
  const unscheduledTodos = React.useMemo(
    () => todos.filter(t => !t.start_date || !t.end_date),
    [todos]
  )

  const { rangeStart, rangeEnd, periods } = React.useMemo(() => {
    const today = new Date()
    let minDate = today
    let maxDate = today

    if (scheduledTodos.length > 0) {
      const starts = scheduledTodos.map(t => { const d = new Date(t.start_date!); d.setHours(0,0,0,0); return d.getTime() })
      const ends   = scheduledTodos.map(t => { const d = new Date(t.end_date!);   d.setHours(23,59,59,999); return d.getTime() })
      minDate = new Date(Math.min(...starts))
      maxDate = new Date(Math.max(...ends))
    }

    const start = startOf(addPeriod(minDate, scale, -1), scale)
    const end   = addPeriod(startOf(maxDate, scale), scale, 2)

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

  // Measure bar positions and build SVG arrow paths
  React.useLayoutEffect(() => {
    const container = rowsDivRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    setSvgDims({ w: containerRect.width, h: containerRect.height })

    const paths: Array<{ key: string; d: string }> = []

    scheduledTodos.forEach(todo => {
      if (!todo.dependencies?.length) return
      todo.dependencies.forEach(depId => {
        const fromEl = barRefs.current.get(depId)
        const toEl   = barRefs.current.get(todo.id)
        if (!fromEl || !toEl) return

        const fromRect = fromEl.getBoundingClientRect()
        const toRect   = toEl.getBoundingClientRect()

        // Coordinates relative to the rows container's top-left
        const x1 = fromRect.right  - containerRect.left
        const y1 = fromRect.top    + fromRect.height / 2 - containerRect.top
        const x2 = toRect.left     - containerRect.left
        const y2 = toRect.top      + toRect.height  / 2 - containerRect.top

        const dx  = Math.max(40, Math.abs(x2 - x1))
        const cx1 = x1 + dx / 2
        const cx2 = x2 - dx / 2

        paths.push({ key: `${depId}-${todo.id}`, d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}` })
      })
    })

    setArrowData(paths)
  }, [scheduledTodos, measureTick])

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
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-20 h-[33px]">
                <div className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                  Task
                </div>
                <div className="flex-1 relative">
                  <div className="flex h-full">
                    {periods.map((p, i) => (
                      <div
                        key={i}
                        className="flex-1 px-1 py-1 flex items-center justify-center text-[10px] font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0"
                      >
                        {formatPeriodLabel(p, scale)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows Container */}
              <div className="relative" ref={rowsContainerRef}>
                {/* SVG Dependency Overlay — coordinates come from getBoundingClientRect */}
                {svgDims.w > 0 && svgDims.h > 0 && (
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: svgDims.w, height: svgDims.h, pointerEvents: 'none', zIndex: 10, overflow: 'visible' }}
                  >
                    <defs>
                      <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 2 L 10 5 L 0 8 z" fill="#9ca3af" />
                      </marker>
                    </defs>
                    {arrowData.map(({ key, d }) => (
                      <path
                        key={key}
                        d={d}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        markerEnd="url(#dep-arrow)"
                      />
                    ))}
                  </svg>
                )}

                {/* Task Rows */}
                {scheduledTodos.map(todo => {
                  const startDate = new Date(todo.start_date!)
                  startDate.setHours(0, 0, 0, 0)
                  const start = toPercent(startDate)

                  const endDate = new Date(todo.end_date!)
                  endDate.setHours(23, 59, 59, 999)
                  const end = toPercent(endDate)

                  const width = Math.max(0.5, end - start)
                  const colors = STATUS_COLORS[todo.status]

                  return (
                    <div
                      key={todo.id}
                      className="flex border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 group relative z-0"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Task label */}
                      <div
                        className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 px-4 py-2 cursor-pointer flex flex-col justify-center bg-white dark:bg-gray-800"
                        onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                      >
                        <p className={`text-sm font-medium truncate ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          {todo.title}
                        </p>
                        <div>
                          <Badge priority={todo.priority} className="mt-1 text-[10px]">
                            {prioritizeText[todo.priority || 'medium']}
                          </Badge>
                        </div>
                      </div>

                      {/* Bar area */}
                      <div className="flex-1 relative">
                        {/* Period grid lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {periods.map((_, idx) => (
                            <div key={idx} className="flex-1 border-r border-gray-100 dark:border-gray-700/30 last:border-r-0" />
                          ))}
                        </div>

                        {/* Today line */}
                        {todayPct > 0 && todayPct < 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10 pointer-events-none"
                            style={{ left: `${todayPct}%` }}
                          />
                        )}

                        {/* Gantt bar */}
                        <div
                          ref={el => {
                            if (el) barRefs.current.set(todo.id, el)
                            else barRefs.current.delete(todo.id)
                          }}
                          className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md ${colors.bg} opacity-90 cursor-pointer hover:opacity-100 transition-opacity shadow-sm flex items-center px-2 overflow-hidden z-20 hover:z-30`}
                          style={{ left: `${start}%`, width: `${width}%` }}
                          onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                          onMouseEnter={e => setTooltip({ todo, x: e.clientX, y: e.clientY })}
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
