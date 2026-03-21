import React from 'react'
import { PageState } from '../types/navigation'
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
  dragPixelsPerDay: number
  origStart: Date
  origEnd: Date
  hasMoved: boolean
  multiIds: string[]
  multiOrigPositions: Map<string, { start: Date; end: Date }>
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


function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function cascadeConstraint(todos: Todo[], rootId: string): Todo[] {
  let result = todos
  const queue = [rootId]
  const visited = new Set<string>()

  while (queue.length) {
    const predId = queue.shift()!
    const pred = result.find(t => t.id === predId)
    if (!pred?.end_date) continue

    for (const succ of result) {
      if (!succ.dependencies?.includes(predId)) continue
      if (visited.has(succ.id)) continue
      if (!succ.start_date || !succ.end_date) continue

      if (pred.end_date >= succ.start_date) {
        const predEndMs  = new Date(pred.end_date).getTime()
        const succStartMs = new Date(succ.start_date).getTime()
        const duration   = new Date(succ.end_date).getTime() - succStartMs
        const newStartMs = predEndMs + MS_PER_DAY
        result = result.map(t => t.id !== succ.id ? t : {
          ...t,
          start_date: toISODate(newStartMs),
          end_date:   toISODate(newStartMs + duration),
        })
        visited.add(succ.id)
        queue.push(succ.id)
      }
    }
  }

  return result
}

function cascadeConstraintBackward(todos: Todo[], rootId: string): Todo[] {
  let result = todos
  const queue = [rootId]
  const visited = new Set<string>()

  while (queue.length) {
    const succId = queue.shift()!
    const succ = result.find(t => t.id === succId)
    if (!succ?.start_date) continue

    for (const predId of (succ.dependencies ?? [])) {
      if (visited.has(predId)) continue
      const pred = result.find(t => t.id === predId)
      if (!pred?.start_date || !pred.end_date) continue

      if (pred.end_date >= succ.start_date) {
        const succStartMs = new Date(succ.start_date).getTime()
        const duration    = new Date(pred.end_date).getTime() - new Date(pred.start_date).getTime()
        const newEndMs    = succStartMs - MS_PER_DAY
        const newStartMs  = newEndMs - duration
        result = result.map(t => t.id !== predId ? t : {
          ...t,
          start_date: toISODate(newStartMs),
          end_date:   toISODate(newEndMs),
        })
        visited.add(predId)
        queue.push(predId)
      }
    }
  }

  return result
}

/** Compute the new todo array for a given drag clientX */
function computeDragResult(
  todos: Todo[],
  drag: DragState,
  clientX: number,
): Todo[] {
  const deltaX  = clientX - drag.startX
  const deltaDaysRaw = deltaX / drag.dragPixelsPerDay
  const deltaDays = Math.round(deltaDaysRaw)
  const deltaMs   = deltaDays * MS_PER_DAY

  // Multi-bar move: apply same deltaMs to all selected bars
  if (drag.multiIds.length > 1 && drag.mode === 'move') {
    let updated = todos
    for (const id of drag.multiIds) {
      const origPos = drag.multiOrigPositions.get(id)
      if (!origPos) continue
      const newStartMs = origPos.start.getTime() + deltaMs
      const newEndMs   = origPos.end.getTime()   + deltaMs
      updated = updated.map(t => t.id !== id ? t : {
        ...t,
        start_date: toISODate(newStartMs),
        end_date:   toISODate(newEndMs),
      })
    }
    return updated
  }

  // Single-bar logic
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

  // Forward cascade: shift successors if they'd overlap
  const afterForward = cascadeConstraint(updated, drag.todoId)
  // Backward cascade: shift predecessors if they'd overlap
  return cascadeConstraintBackward(afterForward, drag.todoId)
}

// ─── colors ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TodoStatus, string> = {
  todo:        'bg-blue-500',
  in_progress: 'bg-red-500',
  done:        'bg-green-500',
}

// ─── component ───────────────────────────────────────────────────────────────

function scaleFromPixels(pxPerDay: number): Scale {
  if (pxPerDay >= 18) return 'day'
  if (pxPerDay >= 2.5) return 'week'
  return 'month'
}

const DEFAULT_PIXELS_PER_DAY = 10

export default function GanttPage({ onNavigate, selectedTags, onTagSelect, onTagClear }: GanttPageProps) {
  const [todos, setTodos]       = React.useState<Todo[]>([])
  const [pixelsPerDay, setPixelsPerDay] = React.useState(DEFAULT_PIXELS_PER_DAY)
  const [tooltip, setTooltip]   = React.useState<{ todo: Todo; x: number; y: number } | null>(null)

  const scale = scaleFromPixels(pixelsPerDay)

  const zoom = React.useCallback((factor: number) => {
    setPixelsPerDay(prev => Math.max(0.1, Math.min(250, prev * factor)))
  }, [])

  // Drag state
  const dragRef        = React.useRef<DragState | null>(null)
  const didDragMoveRef = React.useRef(false)
  const liveTodosRef   = React.useRef<Todo[]>([])
  const origTodosRef   = React.useRef<Todo[]>([])
  const [liveTodos, setLiveTodosState] = React.useState<Todo[] | null>(null)
  const setLiveTodos = (t: Todo[] | null) => { liveTodosRef.current = t ?? []; setLiveTodosState(t) }

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  // Marquee state
  const marqueeRef = React.useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [marqueeDisplay, setMarqueeDisplay] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Ref to keep displayTodos accessible inside useEffect closure
  const displayTodosRef = React.useRef<Todo[]>([])

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

  // Keep displayTodosRef fresh for use in event handlers
  React.useEffect(() => {
    displayTodosRef.current = displayTodos
  }, [displayTodos])

  // Scroll container width (for range extension to fill visible area)
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const scrollWidthObserverRef = React.useRef<ResizeObserver | null>(null)
  const [scrollContainerWidth, setScrollContainerWidth] = React.useState(1200)

  const scrollContainerCallbackRef = React.useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el
    if (scrollWidthObserverRef.current) {
      scrollWidthObserverRef.current.disconnect()
      scrollWidthObserverRef.current = null
    }
    if (el) {
      const update = () => setScrollContainerWidth(el.getBoundingClientRect().width)
      update()
      scrollWidthObserverRef.current = new ResizeObserver(update)
      scrollWidthObserverRef.current.observe(el)
    }
  }, [])

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
    let end = addPeriod(startOf(maxDate, scale), scale, 2)
    // Ensure the chart fills the full visible scroll container width
    const availableWidth = Math.max(0, scrollContainerWidth - SIDEBAR_WIDTH)
    const minDays = Math.ceil(availableWidth / pixelsPerDay)
    const minEnd = new Date(start.getTime() + minDays * MS_PER_DAY)
    if (end < minEnd) end = minEnd
    const cols: Date[] = []
    let cur = new Date(start)
    while (cur < end) { cols.push(new Date(cur)); cur = addPeriod(cur, scale, 1) }
    return { rangeStart: start, rangeEnd: end, periods: cols }
  }, [scheduledTodos, scale, pixelsPerDay, scrollContainerWidth])

  const totalMs = rangeEnd.getTime() - rangeStart.getTime()
  const totalDays = totalMs / MS_PER_DAY
  const chartWidth = totalDays * pixelsPerDay

  function toPx(date: Date): number {
    return Math.max(0, (date.getTime() - rangeStart.getTime()) / MS_PER_DAY * pixelsPerDay)
  }

  const todayPx = toPx(new Date())

  // Keep stateRef fresh (includes pixelsPerDay for marquee intersection calc)
  const stateRef = React.useRef({ rangeStart, totalDays, chartWidth, pixelsPerDay })
  React.useEffect(() => {
    stateRef.current = { rangeStart, totalDays, chartWidth, pixelsPerDay }
  }, [rangeStart, totalDays, chartWidth, pixelsPerDay])

  // ── drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(
    e: React.MouseEvent | React.TouchEvent,
    todoId: string,
    mode: DragMode,
  ) {
    e.preventDefault()
    e.stopPropagation()
    document.body.style.userSelect = 'none'
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const baseTodos = liveTodos ?? todos
    const todo = baseTodos.find(t => t.id === todoId)
    if (!todo?.start_date || !todo.end_date) return
    const containerW = rowsDivRef.current?.getBoundingClientRect().width ?? (SIDEBAR_WIDTH + chartWidth)
    const baw = Math.max(1, containerW - SIDEBAR_WIDTH)
    const dragPPD = baw / stateRef.current.totalDays

    origTodosRef.current = baseTodos

    // Build multi-drag info if moving a selected bar and multiple bars are selected
    let multiIds: string[] = []
    let multiOrigPositions: Map<string, { start: Date; end: Date }> = new Map()

    if (mode === 'move' && selectedIds.has(todoId) && selectedIds.size > 1) {
      multiIds = Array.from(selectedIds)
      for (const id of multiIds) {
        const t = baseTodos.find(x => x.id === id)
        if (t?.start_date && t.end_date) {
          multiOrigPositions.set(id, { start: new Date(t.start_date), end: new Date(t.end_date) })
        }
      }
    }

    dragRef.current = {
      todoId, mode,
      startX: clientX,
      dragPixelsPerDay: dragPPD,
      origStart: new Date(todo.start_date),
      origEnd:   new Date(todo.end_date),
      hasMoved: false,
      multiIds,
      multiOrigPositions,
    }
    setLiveTodos(baseTodos)
  }

  // Register document-level listeners once
  React.useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      // Handle marquee drag
      if (marqueeRef.current) {
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY
        const container = rowsDivRef.current
        if (container) {
          const cr = container.getBoundingClientRect()
          const scrollLeft = container.closest('.gantt-scroll')?.scrollLeft ?? 0
          const x = clientX - cr.left + scrollLeft
          const y = clientY - cr.top
          marqueeRef.current = { ...marqueeRef.current, x2: x, y2: y }
          setMarqueeDisplay({ ...marqueeRef.current })
        }
        return
      }

      if (!dragRef.current) return
      e.preventDefault()
      dragRef.current.hasMoved = true
      didDragMoveRef.current = true
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
      const next = computeDragResult(origTodosRef.current, dragRef.current, clientX)
      setLiveTodos(next)
    }

    function onUp(e: MouseEvent | TouchEvent) {
      // Handle marquee release
      if (marqueeRef.current) {
        const m = marqueeRef.current
        marqueeRef.current = null
        setMarqueeDisplay(null)
        document.body.style.userSelect = ''

        const dx = Math.abs(m.x2 - m.x1)
        const dy = Math.abs(m.y2 - m.y1)

        // Click (no drag) → clear selection
        if (dx < 5 && dy < 5) {
          setSelectedIds(new Set())
          return
        }

        // Marquee selection: find intersecting bars
        const selLeft   = Math.min(m.x1, m.x2)
        const selRight  = Math.max(m.x1, m.x2)
        const selTop    = Math.min(m.y1, m.y2)
        const selBottom = Math.max(m.y1, m.y2)

        const { rangeStart: rs, pixelsPerDay: ppd } = stateRef.current
        const newSelected = new Set<string>()
        displayTodosRef.current.forEach((todo, i) => {
          if (!todo.start_date || !todo.end_date) return
          const startDate = new Date(todo.start_date); startDate.setHours(0, 0, 0, 0)
          const endDate   = new Date(todo.end_date);   endDate.setHours(23, 59, 59, 999)
          const barLeft   = SIDEBAR_WIDTH + Math.max(0, (startDate.getTime() - rs.getTime()) / MS_PER_DAY * ppd)
          const barRight  = SIDEBAR_WIDTH + Math.max(0, (endDate.getTime()   - rs.getTime()) / MS_PER_DAY * ppd)
          const barTop    = i * ROW_HEIGHT
          const barBottom = (i + 1) * ROW_HEIGHT
          if (selLeft < barRight && selRight > barLeft && selTop < barBottom && selBottom > barTop) {
            newSelected.add(todo.id)
          }
        })
        setSelectedIds(newSelected)
        return
      }

      if (!dragRef.current) return
      const drag = dragRef.current
      const clientX = 'touches' in e
        ? (e as TouchEvent).changedTouches[0].clientX
        : (e as MouseEvent).clientX

      document.body.style.userSelect = ''
      // Bar click (no move) → toggle selection
      if (!drag.hasMoved) {
        dragRef.current = null
        setSelectedIds(prev => {
          const next = new Set(prev)
          if (next.has(drag.todoId)) {
            next.delete(drag.todoId)
          } else {
            next.add(drag.todoId)
          }
          return next
        })
        setLiveTodos(null)
        return
      }

      const final = computeDragResult(origTodosRef.current, drag, clientX)
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

  // ── rows container mousedown (marquee) ────────────────────────────────────

  function handleRowsMouseDown(e: React.MouseEvent) {
    if (dragRef.current) return
    const target = e.target as HTMLElement
    if (target.closest('[data-gantt-bar]') || target.closest('[data-gantt-sidebar]')) return

    const container = rowsDivRef.current
    if (!container) return
    const cr = container.getBoundingClientRect()
    const scrollLeft = container.closest('.gantt-scroll')?.scrollLeft ?? 0
    const x = e.clientX - cr.left + scrollLeft
    const y = e.clientY - cr.top

    document.body.style.userSelect = 'none'
    marqueeRef.current = { x1: x, y1: y, x2: x, y2: y }
    setMarqueeDisplay({ x1: x, y1: y, x2: x, y2: y })
  }

  // ─────────────────────────────────────────────────────────────────────────

  const prioritizeText: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' }

  // ── header groups (month row above day/week row) ───────────────────────────
  const headerGroups = React.useMemo(() => {
    const groups: { label: string; widthPx: number }[] = []
    let currentKey = ''
    let currentLabel = ''
    let currentWidth = 0
    periods.forEach((p, i) => {
      const nextP = periods[i + 1] || rangeEnd
      const wPx = Math.max(0, (nextP.getTime() - p.getTime()) / MS_PER_DAY * pixelsPerDay)
      const key   = scale === 'month' ? String(p.getFullYear()) : `${p.getFullYear()}-${p.getMonth()}`
      const label = scale === 'month'
        ? `${p.getFullYear()}年`
        : p.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
      if (key !== currentKey) {
        if (currentKey) groups.push({ label: currentLabel, widthPx: currentWidth })
        currentKey = key; currentLabel = label; currentWidth = wPx
      } else {
        currentWidth += wPx
      }
    })
    if (currentKey) groups.push({ label: currentLabel, widthPx: currentWidth })
    return groups
  }, [periods, rangeEnd, scale, pixelsPerDay])

  const pinchRef = React.useRef<{ dist: number } | null>(null)
  const isHoveredRef = React.useRef(false)

  // Document-level wheel handler: intercepts browser zoom when mouse is over the chart
  React.useEffect(() => {
    const onDocWheel = (e: WheelEvent) => {
      if (!isHoveredRef.current) return
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = Math.exp(-e.deltaY * 0.005)
        zoom(factor)
      }
    }
    document.addEventListener('wheel', onDocWheel, { passive: false })
    return () => document.removeEventListener('wheel', onDocWheel)
  }, [zoom])

  React.useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const onGestureStart = (e: Event) => e.preventDefault()
    const onGestureChange = (e: Event) => e.preventDefault()

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        dragRef.current = null
        pinchRef.current = {
          dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        if (!pinchRef.current) return
        const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        const factor = newDist / pinchRef.current.dist
        pinchRef.current.dist = newDist
        zoom(factor)
      }
    }

    const onTouchEnd = () => { pinchRef.current = null }

    el.addEventListener('gesturestart', onGestureStart, { passive: false })
    el.addEventListener('gesturechange', onGestureChange, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [zoom])

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
            className="overflow-x-auto gantt-scroll"
            ref={scrollContainerCallbackRef}
            style={{ touchAction: 'pan-x pan-y' }}
            onMouseEnter={() => { isHoveredRef.current = true }}
            onMouseLeave={() => { isHoveredRef.current = false }}
          >
            <div style={{ width: `${Math.max(600, SIDEBAR_WIDTH + chartWidth)}px` }}>
              {/* Selection badge */}
              {selectedIds.size > 0 && (
                <div className="sticky left-0 z-30 flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-200 dark:border-indigo-700 text-xs">
                  <span className="font-medium text-indigo-700 dark:text-indigo-300">{selectedIds.size} 件選択中</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200">
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Timeline header */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-20 h-[48px]">
                <div className="w-52 shrink-0 sticky left-0 z-30 border-r border-gray-200 dark:border-gray-700 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center bg-gray-50 dark:bg-gray-800">
                  Task
                </div>
                <div className="flex-1 flex flex-col">
                  {/* Row 1: Month (or year) groups */}
                  <div className="flex border-b border-gray-100 dark:border-gray-700/50 h-[22px]">
                    {headerGroups.map((g, i) => (
                      <div key={i} style={{ width: g.widthPx }} className="shrink-0 px-1.5 flex items-center text-[10px] font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 overflow-hidden whitespace-nowrap">
                        {g.label}
                      </div>
                    ))}
                  </div>
                  {/* Row 2: Day / week-start / month number */}
                  <div className="flex h-[26px]">
                    {periods.map((p, i) => {
                      const nextP = periods[i + 1] || rangeEnd
                      const wPx = Math.max(0, (nextP.getTime() - p.getTime()) / MS_PER_DAY * pixelsPerDay)
                      let label: string
                      let colorClass = 'text-gray-500 dark:text-gray-400'
                      if (scale === 'month') {
                        label = p.toLocaleDateString('ja-JP', { month: 'short' })
                      } else {
                        label = String(p.getDate())
                        const dow = p.getDay()
                        if (dow === 6) colorClass = 'text-blue-500 dark:text-blue-400'
                        else if (dow === 0) colorClass = 'text-red-500 dark:text-red-400'
                      }
                      return (
                        <div key={i} style={{ width: wPx }} className={`shrink-0 flex items-center justify-center text-[10px] font-medium border-r border-gray-100 dark:border-gray-700/30 last:border-r-0 overflow-hidden ${colorClass}`}>
                          {label}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Rows Container */}
              <div className="relative" ref={rowsContainerRef} onMouseDown={handleRowsMouseDown}>
                {/* SVG dependency overlay */}
                {svgDims.w > 0 && svgDims.h > 0 && (
                  <svg style={{ position: 'absolute', top: 0, left: 0, width: svgDims.w, height: svgDims.h, pointerEvents: 'none', zIndex: 10, overflow: 'visible' }}>
                    <defs>
                      <clipPath id="gantt-arrows-clip">
                        <rect x={SIDEBAR_WIDTH} y={0} width={svgDims.w - SIDEBAR_WIDTH} height={svgDims.h} />
                      </clipPath>
                      <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 2 L 10 5 L 0 8 z" fill="#9ca3af" />
                      </marker>
                    </defs>
                    <g clipPath="url(#gantt-arrows-clip)">
                      {arrowData.map(({ key, d }) => (
                        <path key={key} d={d} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#dep-arrow)" />
                      ))}
                    </g>
                  </svg>
                )}

                {/* Marquee selection rectangle */}
                {marqueeDisplay && (() => {
                  const left   = Math.min(marqueeDisplay.x1, marqueeDisplay.x2)
                  const top    = Math.min(marqueeDisplay.y1, marqueeDisplay.y2)
                  const width  = Math.abs(marqueeDisplay.x2 - marqueeDisplay.x1)
                  const height = Math.abs(marqueeDisplay.y2 - marqueeDisplay.y1)
                  return (
                    <div
                      className="absolute pointer-events-none z-40 border-2 border-indigo-500 bg-indigo-500/10 rounded"
                      style={{ left, top, width, height }}
                    />
                  )
                })()}

                {/* Task rows */}
                {displayTodos.map(todo => {
                  const startDate = new Date(todo.start_date!); startDate.setHours(0, 0, 0, 0)
                  const endDate   = new Date(todo.end_date!);   endDate.setHours(23, 59, 59, 999)
                  const startPx = toPx(startDate)
                  const endPx   = toPx(endDate)
                  const widthPx = Math.max(2, endPx - startPx)
                  const isDragging = dragRef.current?.todoId === todo.id || (dragRef.current?.multiIds.includes(todo.id) ?? false)
                  const isSelected = selectedIds.has(todo.id)

                  return (
                    <div
                      key={todo.id}
                      className="flex border-b border-gray-100 dark:border-gray-700/50 group relative z-0"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Task label */}
                      <div
                        data-gantt-sidebar={todo.id}
                        className="w-52 shrink-0 sticky left-0 z-30 border-r border-gray-200 dark:border-gray-700 px-4 py-2 cursor-pointer flex flex-col justify-center bg-white dark:bg-gray-800"
                        onClick={() => {
                          if (!didDragMoveRef.current) onNavigate({ type: 'edit', id: todo.id })
                          didDragMoveRef.current = false
                        }}
                      >
                        <p className={`text-sm font-medium truncate ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          {todo.title}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {todo.priority && <Badge priority={todo.priority} className="text-[10px]">{prioritizeText[todo.priority]}</Badge>}
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
                          {periods.map((p, i) => {
                            const nextP = periods[i + 1] || rangeEnd
                            const wMs = nextP.getTime() - p.getTime()
                            const wPx = Math.max(0, (wMs / MS_PER_DAY) * pixelsPerDay)
                            return (
                              <div key={i} style={{ width: wPx }} className="shrink-0 border-r border-gray-100 dark:border-gray-700/30 last:border-r-0" />
                            )
                          })}
                        </div>

                        {/* Today line */}
                        {todayPx > 0 && todayPx < chartWidth && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10 pointer-events-none" style={{ left: todayPx }} />
                        )}

                        {/* Gantt bar */}
                        <div
                          data-gantt-bar={todo.id}
                          ref={el => { if (el) barRefs.current.set(todo.id, el); else barRefs.current.delete(todo.id) }}
                          className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md ${STATUS_COLORS[todo.status]} ${isDragging ? 'opacity-100 shadow-lg ring-2 ring-white/50' : isSelected ? 'opacity-100 shadow-lg ring-2 ring-white brightness-110' : 'opacity-90 hover:opacity-100'} transition-opacity shadow-sm flex items-center overflow-visible z-20`}
                          style={{ left: startPx, width: widthPx, cursor: dragRef.current ? 'grabbing' : 'grab' }}
                          onMouseDown={e => handleDragStart(e, todo.id, 'move')}
                          onTouchStart={e => handleDragStart(e, todo.id, 'move')}
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
                  {todo.priority && <Badge priority={todo.priority} className="text-[10px] shrink-0">{prioritizeText[todo.priority]}</Badge>}
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
