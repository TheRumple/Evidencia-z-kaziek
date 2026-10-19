import { DragEvent, MouseEvent, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CalendarPlan, Order } from '@/lib/dashboard-types'
import { formatDate, getStatusBadgeStyle, getTodayDate } from '@/lib/dashboard-utils'

type CalendarViewProps = {
  addCalendarPlan: (input: { orderId?: string; title?: string; planDate: string; startTime: string; endTime: string; note: string }) => Promise<void>
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  calendarPlans: CalendarPlan[]
  deleteCalendarPlan: (planId: string) => Promise<void>
  getCustomerName: (customerId: string) => string
  onBackToOrders: () => void
  orders: Order[]
  startEditOrder: (order: Order) => void
  updateCalendarPlan: (planId: string, changes: Partial<Pick<CalendarPlan, 'plan_date' | 'start_time' | 'end_time' | 'note' | 'title'>>) => Promise<void>
}

const dayNames = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa']
const shortDayNames = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']
const inactiveStatuses = new Set(['odovzdana', 'fakturovana', 'stornovana'])
const dayStartMinutes = 7 * 60
const dayEndMinutes = 19 * 60
const hourHeight = 64
const timelineHours = Array.from({ length: 13 }, (_, index) => index + 7)

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

function getPlanAccent(order?: Order | null) {
  if (!order) return { border: '#3b82f6', bg: '#eff6ff', color: '#1d4ed8' }
  const badge = getStatusBadgeStyle(order.stav)
  return {
    border: String(badge.borderColor || '#84cc16'),
    bg: String(badge.background || '#f7fee7'),
    color: String(badge.color || '#365314'),
  }
}

export function CalendarView({ addCalendarPlan, boxStyle, buttonStyle, calendarPlans, deleteCalendarPlan, getCustomerName, onBackToOrders, orders, startEditOrder, updateCalendarPlan }: CalendarViewProps) {
  const today = getTodayDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'agenda'>('week')
  const [planDate, setPlanDate] = useState(today)
  const [planStart, setPlanStart] = useState('08:00')
  const [planEnd, setPlanEnd] = useState('09:00')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskNote, setTaskNote] = useState('')
  const [dragOverDate, setDragOverDate] = useState('')
  const [editingPlanId, setEditingPlanId] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const workWeekDays = getWeekDays(weekStart, 5)
  const fullWeekDays = getWeekDays(weekStart, 7)
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])
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
    setTaskTitle('')
    setTaskNote('')
    if (close) setIsFormOpen(false)
  }

  function openNewPlan(dateKey = selectedDate, startTime = '08:00') {
    const startMinutes = timeToMinutes(startTime) ?? 8 * 60
    clearForm()
    chooseDate(dateKey)
    setPlanStart(minutesToTime(startMinutes))
    setPlanEnd(minutesToTime(startMinutes + 60))
    setIsFormOpen(true)
  }

  async function savePlan() {
    await addCalendarPlan({ orderId: selectedOrderId || undefined, title: selectedOrderId ? undefined : taskTitle, planDate, startTime: planStart, endTime: planEnd, note: taskNote })
    clearForm(true)
  }

  async function saveEditedPlan() {
    if (!editingPlanId) return
    await updateCalendarPlan(editingPlanId, { plan_date: planDate, start_time: planStart || null, end_time: planEnd || null, title: taskTitle.trim() || null, note: taskNote.trim() || null })
    clearForm(true)
  }

  function startEditPlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    setEditingPlanId(plan.id)
    setSelectedOrderId('')
    setTaskTitle(plan.title || order?.nazov || '')
    setPlanDate(String(plan.plan_date).slice(0, 10))
    setPlanStart(plan.start_time?.slice(0, 5) || '08:00')
    setPlanEnd(plan.end_time?.slice(0, 5) || '09:00')
    setTaskNote(plan.note || '')
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

  function onTimelineClick(event: MouseEvent<HTMLDivElement>, dateKey: string) {
    if ((event.target as HTMLElement).closest('.simpleCalendarEvent')) return
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    const rawMinutes = dayStartMinutes + (relativeY / rect.height) * (dayEndMinutes - dayStartMinutes)
    const roundedMinutes = Math.round(rawMinutes / 30) * 30
    openNewPlan(dateKey, minutesToTime(Math.min(roundedMinutes, dayEndMinutes - 60)))
  }

  function renderTimelinePlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    const title = order?.nazov || plan.title || 'Úloha'
    const customer = order ? getCustomerName(order.customer_id) : ''
    const accent = getPlanAccent(order)
    const rawStart = timeToMinutes(plan.start_time) ?? dayStartMinutes
    const rawEnd = timeToMinutes(plan.end_time) ?? rawStart + 60
    const start = Math.max(dayStartMinutes, Math.min(dayEndMinutes - 30, rawStart))
    const end = Math.max(start + 30, Math.min(dayEndMinutes, rawEnd))
    const top = ((start - dayStartMinutes) / 60) * hourHeight
    const height = Math.max(46, ((end - start) / 60) * hourHeight - 4)
    return (
      <div key={plan.id} className="simpleCalendarEvent" draggable onDragStart={(event) => onPlanDragStart(event, plan.id)} style={{ top, height, borderColor: accent.border, background: accent.bg }}>
        <button type="button" className="simpleCalendarEventMain" onClick={() => startEditPlan(plan)} onDoubleClick={() => order && startEditOrder(order)}>
          <span style={{ color: accent.color }}>{getTimeRange(plan)}</span><strong>{title}</strong>{customer && <small>{customer}</small>}{height >= 92 && plan.note && <em>{plan.note}</em>}
        </button>
        <button type="button" className="simpleCalendarEventDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z kalendára">×</button>
      </div>
    )
  }

  function renderAgendaPlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    const title = order?.nazov || plan.title || 'Úloha'
    const accent = getPlanAccent(order)
    return (
      <div key={plan.id} className="simpleAgendaItem" style={{ borderLeftColor: accent.border }}>
        <button type="button" onClick={() => startEditPlan(plan)}><span>{getTimeRange(plan)}</span><strong>{title}</strong>{order && <small>{getCustomerName(order.customer_id)}</small>}{plan.note && <em>{plan.note}</em>}</button>
        <button type="button" className="simpleAgendaDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z kalendára">×</button>
      </div>
    )
  }

  return (
    <div className="simpleCalendar">
      <section className="simpleCalendarTop" style={boxStyle}>
        <div><div className="sectionKicker">Pracovný plán</div><h2>Kalendár</h2></div>
        <div className="simpleCalendarNavigation">
          <button type="button" style={buttonStyle} onClick={() => movePeriod(-1)} title={viewMode === 'day' ? 'Predošlý deň' : 'Predošlý týždeň'}>‹</button>
          <button type="button" style={buttonStyle} onClick={() => { setWeekStart(getMonday(today)); setSelectedDate(today); setPlanDate(today) }}>Dnes</button>
          <button type="button" style={buttonStyle} onClick={() => movePeriod(1)} title={viewMode === 'day' ? 'Ďalší deň' : 'Ďalší týždeň'}>›</button>
          <strong>{viewMode === 'day' ? formatDate(selectedDate) : getWeekLabel(weekStart)}</strong>
        </div>
        <div className="simpleCalendarTopActions">
          <button type="button" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }} onClick={() => openNewPlan()}>+ Pridať</button>
          <button type="button" style={buttonStyle} onClick={onBackToOrders}>Zákazky</button>
        </div>
      </section>

      <section className="simpleCalendarToolbar" style={boxStyle}>
        <div className="workPlannerMode">
          {[['week', 'Týždeň'], ['day', 'Deň'], ['agenda', 'Program']].map(([mode, label]) => <button key={mode} type="button" className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode as typeof viewMode)}>{label}</button>)}
        </div>
        <div className="simpleCalendarSummary"><span><strong>{weekPlans.length}</strong> položiek tento týždeň</span>{viewMode === 'day' && <input type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} />}</div>
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
              {visibleDays.map((dateKey) => <div key={dateKey} className={`simpleCalendarTrack${dateKey === today ? ' today' : ''}${dragOverDate === dateKey ? ' dragOver' : ''}`} style={{ height: (dayEndMinutes - dayStartMinutes) / 60 * hourHeight }} onClick={(event) => onTimelineClick(event, dateKey)} onDragOver={(event) => { event.preventDefault(); setDragOverDate(dateKey) }} onDragLeave={() => setDragOverDate('')} onDrop={(event) => onDayDrop(event, dateKey)}>{(plansByDate[dateKey] || []).map(renderTimelinePlan)}</div>)}
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
            {!editingPlanId && <div><label className="calendarPlanLabel" htmlFor="calendar-order">Zákazka alebo interná úloha</label><select id="calendar-order" className="calendarPlanInput" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}><option value="">Interná úloha bez zákazky</option>{activeOrders.map((order) => <option key={order.id} value={order.id}>{order.nazov} – {getCustomerName(order.customer_id)}</option>)}</select></div>}
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
