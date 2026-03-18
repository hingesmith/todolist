import React from 'react'
import { PageState } from '../App'
import { Badge } from '../components/ui/Badge'
import { storage } from '../storage/local'
import { Todo, TodoStatus } from '../types/todo'
import { Clock, CalendarDays, X, Tag } from 'lucide-react'

interface GanttPageProps {
  onNavigate: (page: PageState) => void
  selectedTags: string[]
  onTagSelect: (tag: string) => void
  onTagClear: () => void
}

const ROW_HEIGHT = 64
const SIDEBAR_WIDTH = 208
const MS_PER_DAY = 86_400_000
const MIN_DURATION_MS = MS_PER_DAY // minimum 1 day

type Scale = 'day' | 'week' | 'month'
type DragMode = 'left' | 'right' | 'move'

interface DragState {
  todoId: string
  mode: DragMode
  startX: number
  barAreaWidth: number
  origRangeStart: Date
  origTotalMs: number
  origStart: Date
  origEnd: Date
  hasMoved: boolean
}

// ─── pure helpers ────────────────────────────────────────────────────────────

function startOf(date: Date, scale: Scale): Date {
  const d = new Date(date)
  if (scale === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
  else if (scale === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0) }
  else d.setHours(0, 0, 0, 0)
  return d
}

function addPeriod(date: Date, scale: Scale, n: number): Date {
  const d = new Date(date)
  if (scale === 'month') d.setMonth(d.getMonth() + n)
  else if (scale === 'week') d.setDate(d.getDate() + n * 7)
  else d.setDate(d.getDate() + n)
  return d
}

function formatPeriodLabel(date: Date, scale: Scale): string {
  if (scale === 'month') return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** BFS: shift every transitive successor of rootId by deltaMs */
function cascadeByDelta(todos: Todo[], rootId: string, deltaMs: number): Todo[] {
  if (deltaMs === 0) return todos
  const affected = new Set<string>()
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    for (const t of todos) {
      if (t.dependencies?.includes(id) && !affected.has(t.id)) {
        affected.add(t.id)
        queue.push(t.id)
      }
    }
  }
  return todos.map(t => {
    if (!affected.has(t.id) || !t.start_date || !t.end_date) return t
    return {
      ...t,
      start_date: toISODate(new Date(t.start_date).getTime() + deltaMs),
      end_date:   toISODate(new Date(t.end_date).getTime()   + deltaMs),
    }
  })
}

/** Compute the new todo array for a given drag clientX */
function computeDragResult(
  todos: Todo[],
  drag: DragState,
  clientX: number,
): Todo[] {
  const deltaX  = clientX - drag.startX
  const deltaMsRaw = (deltaX / drag.barAreaWidth) * drag.origTotalMs
  const deltaDays = Math.round(deltaMsRaw / MS_PER_DAY)
  const deltaMs   = deltaDays * MS_PER_DAY

  const origStartMs = drag.origStart.getTime()
  const origEndMs   = drag.origEnd.getTime()

  let newStartMs = origStartMs
  let newEndMs   = origEndMs

  if (drag.mode === 'move') {
    newStartMs = origStartMs + deltaMs
    newEndMs   = origEndMs   + deltaMs
  } else if (drag.mode === 'right') {
    newEndMs = Math.max(origStartMs + MIN_DURATION_MS, origEndMs + deltaMs)
  } else {
    newStartMs = Math.min(origEndMs - MIN_DURATION_MS, origStartMs + deltaMs)
  }

  // Apply to the dragged task
  const updated = todos.map(t =>
    t.id !== drag.todoId ? t : {
      ...t,
      start_date: toISODate(newStartMs),
      end_date:   toISODate(newEndMs),
    }
  )

  // Cascade: use end-date delta for all modes (resize-left doesn't change end date → 0)
  const endDeltaMs = newEndMs - origEndMs
  return cascadeByDelta(updated, drag.todoId, endDeltaMs)
}

// ─── colors ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TodoStatus, string> = {
  todo:        'bg-blue-500',
  in_progress: 'bg-red-500',
  done:        'bg-green-500',
}

// ─── component ───────────────────────────────────────────────────────────────

// colWidth (px per period column) → scale
function scaleFromColWidth(w: number): Scale {
  if (w < 40) return 'month'
  if (w < 90) return 'week'
  return 'day'
}

const DEFAULT_COL_WIDTH = 60  // → week scale

export default function GanttPage({ onNavigate, selectedTags, onTagSelect, onTagClear }: GanttPageProps) {
  const [todos, setTodos]       = React.useState<Todo[]>([])
  const [colWidth, setColWidth] = React.useState(DEFAULT_COL_WIDTH)
  const [tooltip, setTooltip]   = React.useState<{ todo: Todo; x: number; y: number } | null>(null)

  const scale = scaleFromColWidth(colWidth)

  const zoom = (factor: number) =>
    setColWidth(prev => Math.max(20, Math.min(250, Math.round(prev * factor))))

  // Drag state
  const dragRef      = React.useRef<DragState | null>(null)
  const didDragMoveRef = React.useRef(false)
  const liveTodosRef = React.useRef<Todo[]>([])
  const [liveTodos, setLiveTodosState] = React.useState<Todo[] | null>(null)
  const setLiveTodos = (t: Todo[] | null) => { liveTodosRef.current = t ?? []; setLiveTodosState(t) }

  // Stale-closure-safe ref to latest derived values (updated every render)
  const stateRef = React.useRef({ rangeStart: new Date(), totalMs: 1, barAreaWidth: 0 })

  // Arrow measurement
  const rowsDivRef        = React.useRef<HTMLDivElement | null>(null)
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null)
  const barRefs           = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const [arrowData, setArrowData] = React.useState<Array<{ key: string; d: string }>>([])
  const [svgDims, setSvgDims]     = React.useState({ w: 0, h: 0 })
  const [measureTick, setMeasureTick] = React.useState(0)

  const rowsContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    rowsDivRef.current = node
    if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null }
    if (node) {
      resizeObserverRef.current = new ResizeObserver(() => setMeasureTick(t => t + 1))
      resizeObserverRef.current.observe(node)
    }
  }, [])

  React.useEffect(() => { setTodos(storage.getTodos()) }, [])

  const allTags = React.useMemo(() => {
    const set = new Set<string>()
    todos.forEach(t => t.tags?.forEach(tag => set.add(tag)))
    return Array.from(set).sort()
  }, [todos])

  // Display source: live during drag, stored otherwise
  const tagFilter = React.useCallback((t: Todo) =>
    selectedTags.length === 0 || selectedTags.some(tag => t.tags?.includes(tag)), [selectedTags])

  const displayTodos = React.useMemo(
    () => (liveTodos ?? todos).filter(t => t.start_date && t.end_date && tagFilter(t)),
    [liveTodos, todos, tagFilter]
  )
  const scheduledTodos  = React.useMemo(() => todos.filter(t => t.start_date && t.end_date && tagFilter(t)), [todos, tagFilter])
  const unscheduledTodos = React.useMemo(() => todos.filter(t => (!t.start_date || !t.end_date) && tagFilter(t)), [todos, tagFilter])

  // Range: derived from stored todos (stays fixed during drag)
  const { rangeStart, rangeEnd, periods } = React.useMemo(() => {
    const today = new Date()
    let minDate = today, maxDate = today
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
    while (cur < end) { cols.push(new Date(cur)); cur = addPeriod(cur, scale, 1) }
    return { rangeStart: start, rangeEnd: end, periods: cols }
  }, [scheduledTodos, scale])

  const totalMs = rangeEnd.getTime() - rangeStart.getTime()

  function toPercent(date: Date): number {
    return Math.max(0, Math.min(100, ((date.getTime() - rangeStart.getTime()) / totalMs) * 100))
  }

  const todayPct = toPercent(new Date())

  // Keep stateRef fresh
  React.useEffect(() => {
    const baw = (rowsDivRef.current?.getBoundingClientRect().width ?? 0) - SIDEBAR_WIDTH
    stateRef.current = { rangeStart, totalMs, barAreaWidth: Math.max(1, baw) }
  })

  // ── drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(
    e: React.MouseEvent | React.TouchEvent,
    todoId: string,
    mode: DragMode,
  ) {
    e.preventDefault()
    e.stopPropagation()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const todo = (liveTodos ?? todos).find(t => t.id === todoId)
    if (!todo?.start_date || !todo.end_date) return
    const baw = (rowsDivRef.current?.getBoundingClientRect().width ?? 0) - SIDEBAR_WIDTH
    dragRef.current = {
      todoId, mode,
      startX: clientX,
      barAreaWidth: Math.max(1, baw),
      origRangeStart: rangeStart,
      origTotalMs: totalMs,
      origStart: new Date(todo.start_date),
      origEnd:   new Date(todo.end_date),
      hasMoved: false,
    }
    setLiveTodos(liveTodos ?? todos)
  }

  // Register document-level listeners once
  React.useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return
      e.preventDefault()
      dragRef.current.hasMoved = true
      didDragMoveRef.current = true
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const next = computeDragResult(liveTodosRef.current, dragRef.current, clientX)
      setLiveTodos(next)
    }

    function onUp(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return
      const clientX = 'touches' in e
        ? (e as TouchEvent).changedTouches[0].clientX
        : (e as MouseEvent).clientX
      const final = computeDragResult(liveTodosRef.current, dragRef.current, clientX)
      dragRef.current = null

      // Persist only changed todos
      const saved = storage.getTodos()
      final.forEach(t => {
        const orig = saved.find(s => s.id === t.id)
        if (orig && (orig.start_date !== t.start_date || orig.end_date !== t.end_date)) {
          storage.updateTodo({ ...orig, start_date: t.start_date, end_date: t.end_date })
        }
      })
      setTodos(storage.getTodos())
      setLiveTodos(null)
      setMeasureTick(n => n + 1)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend',  onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend',  onUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── arrow measurement ─────────────────────────────────────────────────────

  React.useLayoutEffect(() => {
    const container = rowsDivRef.current
    if (!container) return
    const cr = container.getBoundingClientRect()
    setSvgDims({ w: cr.width, h: cr.height })
    const paths: Array<{ key: string; d: string }> = []
    displayTodos.forEach(todo => {
      if (!todo.dependencies?.length) return
      todo.dependencies.forEach(depId => {
        const fromEl = barRefs.current.get(depId)
        const toEl   = barRefs.current.get(todo.id)
        if (!fromEl || !toEl) return
        const fr = fromEl.getBoundingClientRect()
        const tr = toEl.getBoundingClientRect()
        const x1 = fr.right  - cr.left;  const y1 = fr.top + fr.height / 2 - cr.top
        const x2 = tr.left   - cr.left;  const y2 = tr.top + tr.height / 2 - cr.top
        const dx = Math.max(40, Math.abs(x2 - x1))
        paths.push({ key: `${depId}-${todo.id}`, d: `M ${x1} ${y1} C ${x1+dx/2} ${y1}, ${x2-dx/2} ${y2}, ${x2} ${y2}` })
      })
    })
    setArrowData(paths)
  }, [displayTodos, measureTick])

  // ─────────────────────────────────────────────────────────────────────────

  const prioritizeText: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' }

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoom(e.deltaY < 0 ? 1.15 : 0.87)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pinch-to-zoom
  const pinchRef = React.useRef<{ dist: number } | null>(null)

  const getTouchDist = (e: React.TouchEvent) => {
    const t0 = e.touches[0], t1 = e.touches[1]
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
  }

  const handleChartTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      dragRef.current = null // cancel any bar drag
      pinchRef.current = { dist: getTouchDist(e) }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChartTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return
    e.preventDefault()
    const newDist = getTouchDist(e)
    const factor = newDist / pinchRef.current.dist
    pinchRef.current.dist = newDist
    zoom(factor)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChartTouchEnd = React.useCallback(() => {
    pinchRef.current = null
  }, [])

  const scaleLabel = scale === 'day' ? 'Days' : scale === 'week' ? 'Weeks' : 'Months'

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Gantt</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400 select-none">{scaleLabel}</span>
      </div>

      {/* Filter strip */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 flex items-center gap-1"><Tag size={11} />Tag:</span>
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

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {scheduledTodos.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <CalendarDays className="mx-auto mb-3 opacity-40" size={40} />
            <p className="font-medium">No tasks with both Start Date and End Date set.</p>
            <p className="text-sm mt-1">Add dates to your tasks to see them here.</p>
          </div>
        ) : (
          <div
            className="overflow-x-auto"
            ref={scrollContainerRef}
            onTouchStart={handleChartTouchStart}
            onTouchMove={handleChartTouchMove}
            onTouchEnd={handleChartTouchEnd}
          >
            <div style={{ minWidth: `${Math.max(600, SIDEBAR_WIDTH + periods.length * colWidth)}px` }}>
              {/* Timeline header */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-20 h-[33px]">
                <div className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                  Task
                </div>
                <div className="flex-1 relative">
                  <div className="flex h-full">
                    {periods.map((p, i) => (
                      <div key={i} className="flex-1 px-1 py-1 flex items-center justify-center text-[10px] font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0">
                        {formatPeriodLabel(p, scale)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows Container */}
              <div className="relative" ref={rowsContainerRef}>
                {/* SVG dependency overlay */}
                {svgDims.w > 0 && svgDims.h > 0 && (
                  <svg style={{ position: 'absolute', top: 0, left: 0, width: svgDims.w, height: svgDims.h, pointerEvents: 'none', zIndex: 10, overflow: 'visible' }}>
                    <defs>
                      <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 2 L 10 5 L 0 8 z" fill="#9ca3af" />
                      </marker>
                    </defs>
                    {arrowData.map(({ key, d }) => (
                      <path key={key} d={d} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#dep-arrow)" />
                    ))}
                  </svg>
                )}

                {/* Task rows */}
                {displayTodos.map(todo => {
                  const startDate = new Date(todo.start_date!); startDate.setHours(0, 0, 0, 0)
                  const endDate   = new Date(todo.end_date!);   endDate.setHours(23, 59, 59, 999)
                  const start = toPercent(startDate)
                  const end   = toPercent(endDate)
                  const width = Math.max(0.5, end - start)
                  const isDragging = dragRef.current?.todoId === todo.id

                  return (
                    <div
                      key={todo.id}
                      className="flex border-b border-gray-100 dark:border-gray-700/50 group relative z-0"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Task label */}
                      <div
                        className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 px-4 py-2 cursor-pointer flex flex-col justify-center bg-white dark:bg-gray-800"
                        onClick={() => {
                          if (!didDragMoveRef.current) onNavigate({ type: 'edit', id: todo.id })
                          didDragMoveRef.current = false
                        }}
                      >
                        <p className={`text-sm font-medium truncate ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          {todo.title}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge priority={todo.priority} className="text-[10px]">
                            {prioritizeText[todo.priority || 'medium']}
                          </Badge>
                          {todo.tags?.map(tag => (
                            <span
                              key={tag}
                              className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${selectedTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'}`}
                              onClick={e => { e.stopPropagation(); onTagSelect(tag) }}
                            >
                              {tag}
                            </span>
                          ))}
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
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10 pointer-events-none" style={{ left: `${todayPct}%` }} />
                        )}

                        {/* Gantt bar */}
                        <div
                          ref={el => { if (el) barRefs.current.set(todo.id, el); else barRefs.current.delete(todo.id) }}
                          className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md ${STATUS_COLORS[todo.status]} ${isDragging ? 'opacity-100 shadow-lg ring-2 ring-white/50' : 'opacity-90 hover:opacity-100'} transition-opacity shadow-sm flex items-center overflow-visible z-20`}
                          style={{ left: `${start}%`, width: `${width}%`, cursor: dragRef.current ? 'grabbing' : 'grab' }}
                          onMouseDown={e => handleDragStart(e, todo.id, 'move')}
                          onTouchStart={e => handleDragStart(e, todo.id, 'move')}
                          onClick={() => {
                            if (!didDragMoveRef.current) onNavigate({ type: 'edit', id: todo.id })
                            didDragMoveRef.current = false
                          }}
                          onMouseEnter={e => { if (!dragRef.current) setTooltip({ todo, x: e.clientX, y: e.clientY }) }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize z-30 group/handle"
                            onMouseDown={e => { e.stopPropagation(); handleDragStart(e, todo.id, 'left') }}
                            onTouchStart={e => { e.stopPropagation(); handleDragStart(e, todo.id, 'left') }}
                          >
                            <div className="w-0.5 h-3 bg-white/60 rounded-full group-hover/handle:bg-white transition-colors" />
                          </div>

                          {/* Bar label */}
                          <span className="flex-1 text-white text-[10px] font-semibold truncate whitespace-nowrap px-3 pointer-events-none select-none">
                            {todo.title}
                          </span>

                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize z-30 group/handle"
                            onMouseDown={e => { e.stopPropagation(); handleDragStart(e, todo.id, 'right') }}
                            onTouchStart={e => { e.stopPropagation(); handleDragStart(e, todo.id, 'right') }}
                          >
                            <div className="w-0.5 h-3 bg-white/60 rounded-full group-hover/handle:bg-white transition-colors" />
                          </div>
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
      {tooltip && !dragRef.current && (
        <div className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-xl px-3 py-2 pointer-events-none max-w-xs" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <p className="font-semibold mb-1">{tooltip.todo.title}</p>
          <p className="text-gray-300"><span className="text-gray-400">Start:</span> {new Date(tooltip.todo.start_date!).toLocaleDateString('ja-JP')}</p>
          <p className="text-gray-300"><span className="text-gray-400">End:</span>   {new Date(tooltip.todo.end_date!).toLocaleDateString('ja-JP')}</p>
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
              <div key={todo.id} onClick={() => onNavigate({ type: 'edit', id: todo.id })}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-sm font-medium truncate ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{todo.title}</span>
                  <Badge priority={todo.priority} className="text-[10px] shrink-0">{prioritizeText[todo.priority || 'medium']}</Badge>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-4 group-hover:text-indigo-500 transition-colors">
                  {!todo.start_date && !todo.end_date ? '開始日・終了日が未設定' : !todo.start_date ? '開始日が未設定' : '終了日が未設定'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
