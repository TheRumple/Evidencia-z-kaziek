import { DragEvent, PointerEvent, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CalendarPlan, Customer, Order } from '@/lib/dashboard-types'
import { formatDate, getTodayDate } from '@/lib/dashboard-utils'

type CalendarViewProps = {
  addCalendarPlan: (input: { orderId?: string; customerId?: string; title?: string; planDate: string; startTime: string; endTime: string; note: string; isPrivate: boolean }) => Promise<void>
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  calendarPlans: CalendarPlan[]
  customers: Customer[]
  deleteCalendarPlan: (planId: string) => Promise<void>
  getCustomerName: (customerId: string) => string
  orders: Order[]
  startEditOrder: (order: Order) => void
  updateCalendarPlan: (planId: string, changes: Partial<Pick<CalendarPlan, 'order_id' | 'customer_id' | 'plan_date' | 'start_time' | 'end_time' | 'note' | 'title' | 'is_private'>>) => Promise<void>
}

const dayNames = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa']
const shortDayNames = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']
const inactiveStatuses = new Set(['odovzdana', 'fakturovana', 'stornovana'])
const dayStartMinutes = 7 * 60
const dayEndMinutes = 16 * 60
const hourHeight = 72
const timelineHours = Array.from({ length: 10 }, (_, index) => index + 7)

function toLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateKey: string, days: number) {
  const date = toLocalDate(dateKey)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function getMonday(dateKey: string) {
  const date = toLocalDate(dateKey)
  const mondayIndex = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayIndex)
  return toDateKey(date)
}

function getWeekDays(weekStart: string, count = 7) {
  return Array.from({ length: count }, (_, index) => addDays(weekStart, index))
}

function getShortDate(dateKey: string) {
  const date = toLocalDate(dateKey)
  return `${date.getDate()}.${date.getMonth() + 1}.`
}

function getWeekLabel(weekStart: string) {
  const start = toLocalDate(weekStart)
  const end = toLocalDate(addDays(weekStart, 4))
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}. – ${end.getDate()}. ${end.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })}`
  }
  return `${start.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function timeToMinutes(time?: string | null) {
  if (!time) return null
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function minutesToTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes))
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`
}

function getTimeRange(plan: CalendarPlan) {
  if (plan.start_time && plan.end_time) return `${plan.start_time.slice(0, 5)} – ${plan.end_time.slice(0, 5)}`
  if (plan.start_time) return plan.start_time.slice(0, 5)
  return 'Bez času'
}

type PlanAccent = { border: string; bg: string; color: string }

const customerAccents: PlanAccent[] = [
  { border: '#2563eb', bg: '#eff6ff', color: '#1d4ed8' },
  { border: '#16a34a', bg: '#f0fdf4', color: '#166534' },
  { border: '#ea580c', bg: '#fff7ed', color: '#9a3412' },
  { border: '#7c3aed', bg: '#f5f3ff', color: '#6d28d9' },
  { border: '#0891b2', bg: '#ecfeff', color: '#0e7490' },
  { border: '#db2777', bg: '#fdf2f8', color: '#be185d' },
  { border: '#ca8a04', bg: '#fefce8', color: '#a16207' },
  { border: '#0f766e', bg: '#f0fdfa', color: '#115e59' },
  { border: '#4f46e5', bg: '#eef2ff', color: '#3730a3' },
  { border: '#dc2626', bg: '#fef2f2', color: '#991b1b' },
  { border: '#65a30d', bg: '#f7fee7', color: '#3f6212' },
  { border: '#c026d3', bg: '#fdf4ff', color: '#86198f' },
  { border: '#0284c7', bg: '#f0f9ff', color: '#075985' },
  { border: '#059669', bg: '#ecfdf5', color: '#047857' },
  { border: '#9333ea', bg: '#faf5ff', color: '#7e22ce' },
]

const internalAccent = { border: '#64748b', bg: '#f1f5f9', color: '#334155' }
const privateAccent = { border: '#e11d48', bg: '#fff1f2', color: '#be123c' }

function customerHash(customerId: string) {
  let hash = 0
  for (const character of customerId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash)
}

function buildCustomerAccentMap(customers: Customer[]) {
  const accents = new Map<string, PlanAccent>()
  const usedIndexes = new Set<number>()
  const stableCustomers = [...customers].sort((a, b) => a.id.localeCompare(b.id))
  stableCustomers.forEach((customer) => {
    const preferredIndex = customerHash(customer.id) % customerAccents.length
    let selectedIndex = preferredIndex
    for (let offset = 0; offset < customerAccents.length; offset += 1) {
      const candidate = (preferredIndex + offset) % customerAccents.length
      if (!usedIndexes.has(candidate)) {
        selectedIndex = candidate
        break
      }
    }
    usedIndexes.add(selectedIndex)
    accents.set(customer.id, customerAccents[selectedIndex])
  })
  return accents
}

function getPlanAccent(customerId: string | null | undefined, isPrivate: boolean, customerAccentMap: Map<string, PlanAccent>) {
  if (isPrivate) return privateAccent
  if (!customerId) return internalAccent
  return customerAccentMap.get(customerId) || customerAccents[customerHash(customerId) % customerAccents.length]
}

export function CalendarView({ addCalendarPlan, boxStyle, buttonStyle, calendarPlans, customers, deleteCalendarPlan, getCustomerName, orders, startEditOrder, updateCalendarPlan }: CalendarViewProps) {
  const today = getTodayDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'agenda'>('week')
  const [planDate, setPlanDate] = useState(today)
  const [planStart, setPlanStart] = useState('08:00')
  const [planEnd, setPlanEnd] = useState('09:00')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskNote, setTaskNote] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [dragOverDate, setDragOverDate] = useState('')
  const [editingPlanId, setEditingPlanId] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [timeSelection, setTimeSelection] = useState<{ dateKey: string; anchor: number; start: number; end: number } | null>(null)
  const timeSelectionRef = useRef<typeof timeSelection>(null)

  const workWeekDays = getWeekDays(weekStart, 5)
  const fullWeekDays = getWeekDays(weekStart, 7)
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])
  const customerAccentMap = useMemo(() => buildCustomerAccentMap(customers), [customers])
  const activeOrders = useMemo(() => orders.filter((order) => !inactiveStatuses.has(order.stav)), [orders])
  const plansByDate = useMemo(() => calendarPlans.reduce<Record<string, CalendarPlan[]>>((acc, plan) => {
    const key = String(plan.plan_date).slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(plan)
    acc[key].sort((a, b) => `${a.start_time || '99:99'} ${a.title || ''}`.localeCompare(`${b.start_time || '99:99'} ${b.title || ''}`))
    return acc
  }, {}), [calendarPlans])
  const weekPlans = fullWeekDays.flatMap((day) => plansByDate[day] || [])
  const visibleDays = viewMode === 'day' ? [selectedDate] : workWeekDays

  function chooseDate(dateKey: string) {
    setSelectedDate(dateKey)
    setPlanDate(dateKey)
    setWeekStart(getMonday(dateKey))
  }

  function movePeriod(direction: -1 | 1) {
    if (viewMode === 'day') {
      chooseDate(addDays(selectedDate, direction))
      return
    }
    const nextWeek = addDays(weekStart, direction * 7)
    setWeekStart(nextWeek)
    setSelectedDate(nextWeek)
    setPlanDate(nextWeek)
  }

  function clearForm(close = false) {
    setEditingPlanId('')
    setSelectedOrderId('')
    setSelectedCustomerId('')
    setTaskTitle('')
    setTaskNote('')
    setIsPrivate(false)
    if (close) setIsFormOpen(false)
  }

  function openNewPlan(dateKey = selectedDate, startTime = '08:00', endTime?: string) {
    const startMinutes = timeToMinutes(startTime) ?? 8 * 60
    clearForm()
    chooseDate(dateKey)
    setPlanStart(minutesToTime(startMinutes))
    setPlanEnd(endTime || minutesToTime(startMinutes + 60))
    setIsFormOpen(true)
  }

  async function savePlan() {
    const order = selectedOrderId ? orderMap.get(selectedOrderId) : null
    await addCalendarPlan({ orderId: isPrivate ? undefined : selectedOrderId || undefined, customerId: isPrivate ? undefined : order?.customer_id || selectedCustomerId || undefined, title: selectedOrderId && !isPrivate ? undefined : taskTitle, planDate, startTime: planStart, endTime: planEnd, note: taskNote, isPrivate })
    clearForm(true)
  }

  async function saveEditedPlan() {
    if (!editingPlanId) return
    const originalPlan = calendarPlans.find((plan) => plan.id === editingPlanId)
    await updateCalendarPlan(editingPlanId, {
      ...(isPrivate ? { order_id: null } : {}),
      customer_id: isPrivate ? null : selectedCustomerId || null,
      plan_date: planDate,
      start_time: planStart || null,
      end_time: planEnd || null,
      title: taskTitle.trim() || null,
      note: taskNote.trim() || null,
      ...((isPrivate || originalPlan?.is_private) ? { is_private: isPrivate } : {}),
    })
    clearForm(true)
  }

  function startEditPlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    setEditingPlanId(plan.id)
    setSelectedOrderId('')
    setSelectedCustomerId(plan.customer_id || order?.customer_id || '')
    setTaskTitle(plan.title || order?.nazov || '')
    setPlanDate(String(plan.plan_date).slice(0, 10))
    setPlanStart(plan.start_time?.slice(0, 5) || '08:00')
    setPlanEnd(plan.end_time?.slice(0, 5) || '09:00')
    setTaskNote(plan.note || '')
    setIsPrivate(Boolean(plan.is_private))
    setIsFormOpen(true)
  }

  function onPlanDragStart(event: DragEvent<HTMLDivElement>, planId: string) {
    event.dataTransfer.setData('application/x-itspot-plan', planId)
    event.dataTransfer.effectAllowed = 'move'
  }

  function onDayDrop(event: DragEvent<HTMLDivElement>, dateKey: string) {
    event.preventDefault()
    setDragOverDate('')
    const planId = event.dataTransfer.getData('application/x-itspot-plan')
    if (!planId) return
    void updateCalendarPlan(planId, { plan_date: dateKey })
    chooseDate(dateKey)
  }

  function pointerMinutes(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    const rawMinutes = dayStartMinutes + (relativeY / rect.height) * (dayEndMinutes - dayStartMinutes)
    return Math.max(dayStartMinutes, Math.min(dayEndMinutes - 30, Math.floor(rawMinutes / 30) * 30))
  }

  function onTimelinePointerDown(event: PointerEvent<HTMLDivElement>, dateKey: string) {
    if (event.pointerType === 'touch' || (event.target as HTMLElement).closest('.simpleCalendarEvent')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const anchor = pointerMinutes(event)
    const selection = { dateKey, anchor, start: anchor, end: anchor + 30 }
    timeSelectionRef.current = selection
    setTimeSelection(selection)
  }

  function onTimelinePointerMove(event: PointerEvent<HTMLDivElement>, dateKey: string) {
    const selection = timeSelectionRef.current
    if (!selection || selection.dateKey !== dateKey || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const current = pointerMinutes(event)
    const nextSelection = {
      ...selection,
      start: Math.min(selection.anchor, current),
      end: Math.min(dayEndMinutes, Math.max(selection.anchor, current) + 30),
    }
    timeSelectionRef.current = nextSelection
    setTimeSelection(nextSelection)
  }

  function onTimelinePointerUp(event: PointerEvent<HTMLDivElement>, dateKey: string) {
    const selection = timeSelectionRef.current
    if (!selection || selection.dateKey !== dateKey) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const { start, end } = selection
    timeSelectionRef.current = null
    setTimeSelection(null)
    openNewPlan(dateKey, minutesToTime(start), minutesToTime(end))
  }

  function renderTimelinePlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    const title = order?.nazov || plan.title || 'Úloha'
    const customerId = order?.customer_id || plan.customer_id
    const customer = customerId ? getCustomerName(customerId) : ''
    const accent = getPlanAccent(customerId, plan.is_private, customerAccentMap)
    const rawStart = timeToMinutes(plan.start_time) ?? dayStartMinutes
    const rawEnd = timeToMinutes(plan.end_time) ?? rawStart + 60
    const start = Math.max(dayStartMinutes, Math.min(dayEndMinutes - 30, rawStart))
    const end = Math.max(start + 30, Math.min(dayEndMinutes, rawEnd))
    const top = ((start - dayStartMinutes) / 60) * hourHeight
    const height = Math.max(28, ((end - start) / 60) * hourHeight - 4)
    return (
      <div key={plan.id} className={`simpleCalendarEvent${height < 44 ? ' compact' : ''}`} draggable onDragStart={(event) => onPlanDragStart(event, plan.id)} style={{ top, height, borderColor: accent.border, background: accent.bg, '--event-accent': accent.border } as CSSProperties}>
        <button type="button" className="simpleCalendarEventMain" onClick={() => startEditPlan(plan)} onDoubleClick={() => order && startEditOrder(order)}>
          <span style={{ color: accent.color }}>{getTimeRange(plan)}</span><strong>{title}</strong>{plan.is_private ? <small style={{ color: privateAccent.color }}>Súkromné</small> : customer && <small>{customer}</small>}{height >= 92 && plan.note && <em>{plan.note}</em>}
        </button>
        <button type="button" className="simpleCalendarEventDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z kalendára">×</button>
      </div>
    )
  }

  function renderAgendaPlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    const title = order?.nazov || plan.title || 'Úloha'
    const customerId = order?.customer_id || plan.customer_id
    const accent = getPlanAccent(customerId, plan.is_private, customerAccentMap)
    return (
      <div key={plan.id} className="simpleAgendaItem" style={{ borderLeftColor: accent.border }}>
        <button type="button" onClick={() => startEditPlan(plan)}><span>{getTimeRange(plan)}</span><strong>{title}</strong>{plan.is_private ? <small style={{ color: privateAccent.color }}>Súkromné</small> : customerId && <small>{getCustomerName(customerId)}</small>}{plan.note && <em>{plan.note}</em>}</button>
        <button type="button" className="simpleAgendaDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z kalendára">×</button>
      </div>
    )
  }

  return (
    <div className="simpleCalendar">
      <section className="simpleCalendarTop" style={boxStyle}>
        <div><div className="sectionKicker">Pracovný plán</div><h2>Kalendár</h2></div>
        <div className="workPlannerMode">
          {[['week', 'Týždeň'], ['day', 'Deň'], ['agenda', 'Program']].map(([mode, label]) => <button key={mode} type="button" className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode as typeof viewMode)}>{label}</button>)}
        </div>
        <div className="simpleCalendarNavigation">
          <button type="button" style={buttonStyle} onClick={() => movePeriod(-1)} title={viewMode === 'day' ? 'Predošlý deň' : 'Predošlý týždeň'}>‹</button>
          <button type="button" style={buttonStyle} onClick={() => { setWeekStart(getMonday(today)); setSelectedDate(today); setPlanDate(today) }}>Dnes</button>
          <button type="button" style={buttonStyle} onClick={() => movePeriod(1)} title={viewMode === 'day' ? 'Ďalší deň' : 'Ďalší týždeň'}>›</button>
          <strong>{viewMode === 'day' ? formatDate(selectedDate) : getWeekLabel(weekStart)}</strong>
        </div>
        <div className="simpleCalendarTopActions">
          <div className="simpleCalendarSummary"><span><strong>{weekPlans.length}</strong> položiek</span>{viewMode === 'day' && <input type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} />}</div>
          <button type="button" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }} onClick={() => openNewPlan()}>+ Pridať</button>
        </div>
      </section>

      {viewMode !== 'agenda' ? (
        <section className="simpleCalendarBoard" style={boxStyle}>
          <div className="simpleCalendarScroller">
            <div className={`simpleCalendarGrid${viewMode === 'day' ? ' dayView' : ''}`}>
              <div className="simpleCalendarCorner">Čas</div>
              {visibleDays.map((dateKey) => {
                const dayIndex = (toLocalDate(dateKey).getDay() + 6) % 7
                return <button key={dateKey} type="button" className={`simpleCalendarDayHeader${dateKey === today ? ' today' : ''}`} onClick={() => { chooseDate(dateKey); setViewMode('day') }}><span>{viewMode === 'day' ? dayNames[dayIndex] : shortDayNames[dayIndex]}</span><strong>{getShortDate(dateKey)}</strong><em>{(plansByDate[dateKey] || []).length}</em></button>
              })}
              <div className="simpleCalendarTimeScale" style={{ height: (dayEndMinutes - dayStartMinutes) / 60 * hourHeight }}>{timelineHours.map((hour, index) => <span key={hour} style={{ top: index * hourHeight }}>{hour}:00</span>)}</div>
              {visibleDays.map((dateKey) => <div key={dateKey} className={`simpleCalendarTrack${dateKey === today ? ' today' : ''}${dragOverDate === dateKey ? ' dragOver' : ''}`} style={{ height: (dayEndMinutes - dayStartMinutes) / 60 * hourHeight }} onPointerDown={(event) => onTimelinePointerDown(event, dateKey)} onPointerMove={(event) => onTimelinePointerMove(event, dateKey)} onPointerUp={(event) => onTimelinePointerUp(event, dateKey)} onPointerCancel={() => { timeSelectionRef.current = null; setTimeSelection(null) }} onDragOver={(event) => { event.preventDefault(); setDragOverDate(dateKey) }} onDragLeave={() => setDragOverDate('')} onDrop={(event) => onDayDrop(event, dateKey)}>{timeSelection?.dateKey === dateKey && <div className="simpleCalendarSelection" style={{ top: ((timeSelection.start - dayStartMinutes) / 60) * hourHeight, height: ((timeSelection.end - timeSelection.start) / 60) * hourHeight }}><strong>{minutesToTime(timeSelection.start)} – {minutesToTime(timeSelection.end)}</strong></div>}{(plansByDate[dateKey] || []).map(renderTimelinePlan)}</div>)}
            </div>
          </div>
        </section>
      ) : (
        <section className="simpleAgenda" style={boxStyle}>
          {fullWeekDays.map((dateKey, index) => {
            const plans = plansByDate[dateKey] || []
            return <div key={dateKey} className={`simpleAgendaDay${dateKey === today ? ' today' : ''}`}><button type="button" className="simpleAgendaDayHeader" onClick={() => { chooseDate(dateKey); setViewMode('day') }}><span>{dayNames[index]}</span><strong>{formatDate(dateKey)}</strong></button><div className="simpleAgendaItems">{plans.length ? plans.map(renderAgendaPlan) : <span className="simpleAgendaEmpty">Bez programu</span>}</div><button type="button" className="simpleAgendaAdd" onClick={() => openNewPlan(dateKey)}>+</button></div>
          })}
        </section>
      )}

      {isFormOpen && (
        <div className="simpleCalendarModal" role="dialog" aria-modal="true" aria-label={editingPlanId ? 'Upraviť položku kalendára' : 'Pridať do kalendára'}>
          <form className="simpleCalendarForm" style={boxStyle} onSubmit={(event) => { event.preventDefault(); void (editingPlanId ? saveEditedPlan() : savePlan()) }}>
            <div className="simpleCalendarFormHeader"><div><div className="sectionKicker">{editingPlanId ? 'Úprava plánu' : 'Nová položka'}</div><h3>{editingPlanId ? 'Upraviť položku' : 'Pridať do kalendára'}</h3></div><button type="button" style={buttonStyle} onClick={() => clearForm(true)} title="Zavrieť">×</button></div>
            <label className="calendarPrivateToggle"><input type="checkbox" checked={isPrivate} onChange={(event) => { const checked = event.target.checked; setIsPrivate(checked); if (checked) { setSelectedOrderId(''); setSelectedCustomerId('') } }}/><span><strong>Súkromná položka</strong><small>Bez zákazníka a bez zákazky, v kalendári bude označená vlastnou farbou.</small></span></label>
            {!editingPlanId && <div><label className="calendarPlanLabel" htmlFor="calendar-order">Zákazka (voliteľné)</label><select id="calendar-order" className="calendarPlanInput" value={selectedOrderId} disabled={isPrivate} onChange={(event) => { const orderId = event.target.value; setSelectedOrderId(orderId); const order = orderMap.get(orderId); if (order) setSelectedCustomerId(order.customer_id) }}><option value="">Bez zákazky</option>{activeOrders.map((order) => <option key={order.id} value={order.id}>{order.nazov} – {getCustomerName(order.customer_id)}</option>)}</select></div>}
            <div><label className="calendarPlanLabel" htmlFor="calendar-customer">Zákazník (voliteľné)</label><select id="calendar-customer" className="calendarPlanInput" value={selectedCustomerId} disabled={isPrivate || Boolean(selectedOrderId)} onChange={(event) => { const customerId = event.target.value; setSelectedCustomerId(customerId); if (customerId && !taskTitle.trim()) setTaskTitle('Stretnutie') }}><option value="">Interná položka bez zákazníka</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nazov}</option>)}</select></div>
            {(!selectedOrderId || editingPlanId) && <div><label className="calendarPlanLabel" htmlFor="calendar-title">Názov</label><input id="calendar-title" className="calendarPlanInput" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Napr. servis kamier" autoFocus required={!selectedOrderId} /></div>}
            <div className="simpleCalendarFormGrid"><div><label className="calendarPlanLabel" htmlFor="calendar-date">Deň</label><input id="calendar-date" className="calendarPlanInput" type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} required /></div><div><label className="calendarPlanLabel" htmlFor="calendar-start">Od</label><input id="calendar-start" className="calendarPlanInput" type="time" value={planStart} onChange={(event) => setPlanStart(event.target.value)} /></div><div><label className="calendarPlanLabel" htmlFor="calendar-end">Do</label><input id="calendar-end" className="calendarPlanInput" type="time" value={planEnd} onChange={(event) => setPlanEnd(event.target.value)} /></div></div>
            <div><label className="calendarPlanLabel" htmlFor="calendar-note">Poznámka alebo miesto</label><textarea id="calendar-note" className="calendarPlanInput simpleCalendarTextarea" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} /></div>
            <div className="simpleCalendarFormActions"><button type="button" style={buttonStyle} onClick={() => clearForm(true)}>Zrušiť</button><button type="submit" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }}>{editingPlanId ? 'Uložiť zmenu' : 'Pridať do plánu'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
