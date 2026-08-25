import { DragEvent, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CalendarPlan, Order } from '@/lib/dashboard-types'
import { formatDate, getStatusBadgeStyle, getStatusLabel, getTodayDate } from '@/lib/dashboard-utils'

type CalendarViewProps = {
  addCalendarPlan: (input: {
    orderId?: string
    title?: string
    planDate: string
    startTime: string
    endTime: string
    note: string
  }) => Promise<void>
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

function getWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

function getShortDate(dateKey: string) {
  const date = toLocalDate(dateKey)
  return `${date.getDate()}.${date.getMonth() + 1}.`
}

function getTimeRange(plan: CalendarPlan) {
  if (plan.start_time && plan.end_time) return `${plan.start_time.slice(0, 5)}-${plan.end_time.slice(0, 5)}`
  if (plan.start_time) return plan.start_time.slice(0, 5)
  return 'čas neurčený'
}

function timeToMinutes(time?: string | null) {
  if (!time) return null
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function getPlanDurationMinutes(plan: CalendarPlan) {
  const start = timeToMinutes(plan.start_time)
  const end = timeToMinutes(plan.end_time)
  if (start === null || end === null || end <= start) return 0
  return end - start
}

function getPlanDurationLabel(minutes: number) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest) return `${hours} h ${rest} min`
  if (hours) return `${hours} h`
  return `${rest} min`
}

function getPlanAccent(order?: Order | null) {
  if (!order) return { border: '#60a5fa', bg: '#eff6ff', color: '#1d4ed8' }
  const badge = getStatusBadgeStyle(order.stav)
  return {
    border: String(badge.borderColor || '#84cc16'),
    bg: String(badge.background || '#f7fee7'),
    color: String(badge.color || '#365314'),
  }
}

export function CalendarView({
  addCalendarPlan,
  boxStyle,
  buttonStyle,
  calendarPlans,
  deleteCalendarPlan,
  getCustomerName,
  onBackToOrders,
  orders,
  startEditOrder,
  updateCalendarPlan,
}: CalendarViewProps) {
  const today = getTodayDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'unplanned'>('week')
  const [planDate, setPlanDate] = useState(today)
  const [planStart, setPlanStart] = useState('')
  const [planEnd, setPlanEnd] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskNote, setTaskNote] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [dragOverDate, setDragOverDate] = useState('')
  const [editingPlanId, setEditingPlanId] = useState('')

  const weekDays = getWeekDays(weekStart)
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])
  const activeOrders = useMemo(() => orders.filter((order) => !inactiveStatuses.has(order.stav)), [orders])
  const plannedOrderIds = useMemo(
    () => new Set(calendarPlans.map((plan) => plan.order_id).filter(Boolean) as string[]),
    [calendarPlans]
  )
  const plansByDate = useMemo(() => {
    return calendarPlans.reduce<Record<string, CalendarPlan[]>>((acc, plan) => {
      const key = String(plan.plan_date).slice(0, 10)
      if (!acc[key]) acc[key] = []
      acc[key].push(plan)
      acc[key].sort((a, b) => `${a.start_time || '99:99'} ${a.title || ''}`.localeCompare(`${b.start_time || '99:99'} ${b.title || ''}`))
      return acc
    }, {})
  }, [calendarPlans])
  const weekPlans = weekDays.flatMap((day) => plansByDate[day] || [])
  const selectedPlans = plansByDate[selectedDate] || []
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const unplannedOrders = activeOrders
    .filter((order) => !plannedOrderIds.has(order.id))
    .filter((order) => {
      if (!normalizedSearch) return true
      return `${order.nazov} ${getCustomerName(order.customer_id)} ${order.popis || ''}`.toLowerCase().includes(normalizedSearch)
    })

  async function savePlan() {
    const title = selectedOrderId ? undefined : taskTitle
    await addCalendarPlan({
      orderId: selectedOrderId || undefined,
      title,
      planDate,
      startTime: planStart,
      endTime: planEnd,
      note: taskNote,
    })
    setSelectedOrderId('')
    setTaskTitle('')
    setTaskNote('')
  }

  async function saveEditedPlan() {
    if (!editingPlanId) return
    await updateCalendarPlan(editingPlanId, {
      plan_date: planDate,
      start_time: planStart || null,
      end_time: planEnd || null,
      title: taskTitle.trim() || null,
      note: taskNote.trim() || null,
    })
    clearForm()
  }

  function clearForm() {
    setEditingPlanId('')
    setSelectedOrderId('')
    setTaskTitle('')
    setTaskNote('')
    setPlanStart('')
    setPlanEnd('')
  }

  async function addOrderToDate(orderId: string, targetDate: string) {
    await addCalendarPlan({
      orderId,
      planDate: targetDate,
      startTime: '',
      endTime: '',
      note: '',
    })
  }

  function chooseDate(dateKey: string) {
    setSelectedDate(dateKey)
    setPlanDate(dateKey)
    setWeekStart(getMonday(dateKey))
  }

  function prepareOrder(orderId: string, dateKey = selectedDate) {
    setSelectedOrderId(orderId)
    setTaskTitle('')
    setPlanDate(dateKey)
    setViewMode('week')
  }

  function startEditPlan(plan: CalendarPlan) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    setEditingPlanId(plan.id)
    setSelectedOrderId('')
    setTaskTitle(plan.title || order?.nazov || '')
    setPlanDate(String(plan.plan_date).slice(0, 10))
    setPlanStart(plan.start_time || '')
    setPlanEnd(plan.end_time || '')
    setTaskNote(plan.note || '')
  }

  function onOrderDragStart(event: DragEvent<HTMLButtonElement>, orderId: string) {
    event.dataTransfer.setData('application/x-itspot-order', orderId)
    event.dataTransfer.effectAllowed = 'copy'
  }

  function onPlanDragStart(event: DragEvent<HTMLDivElement>, planId: string) {
    event.dataTransfer.setData('application/x-itspot-plan', planId)
    event.dataTransfer.effectAllowed = 'move'
  }

  function onDayDrop(event: DragEvent<HTMLDivElement>, dateKey: string) {
    event.preventDefault()
    setDragOverDate('')

    const planId = event.dataTransfer.getData('application/x-itspot-plan')
    if (planId) {
      void updateCalendarPlan(planId, { plan_date: dateKey })
      chooseDate(dateKey)
      return
    }

    const orderId = event.dataTransfer.getData('application/x-itspot-order') || event.dataTransfer.getData('text/plain')
    if (orderId) {
      void addOrderToDate(orderId, dateKey)
      chooseDate(dateKey)
    }
  }

  function renderPlan(plan: CalendarPlan, compact = false) {
    const order = plan.order_id ? orderMap.get(plan.order_id) : null
    const title = order?.nazov || plan.title || 'Úloha'
    const accent = getPlanAccent(order)
    const durationMinutes = getPlanDurationMinutes(plan)
    const durationLabel = getPlanDurationLabel(durationMinutes)
    const plannedBlockHeight = compact && durationMinutes ? Math.min(210, Math.max(58, 34 + durationMinutes * 0.26)) : undefined

    return (
      <div
        key={plan.id}
        className="workPlannerItem"
        draggable
        onDragStart={(event) => onPlanDragStart(event, plan.id)}
        style={{ borderLeftColor: accent.border, background: accent.bg, minHeight: plannedBlockHeight }}
      >
        <button
          type="button"
          className="workPlannerItemMain"
          onClick={() => startEditPlan(plan)}
          onDoubleClick={() => order && startEditOrder(order)}
          title={order ? `${order.nazov} - ${getCustomerName(order.customer_id)}` : plan.note || title}
        >
          <span style={{ color: accent.color }}>{getTimeRange(plan)}</span>
          {durationLabel && <b style={{ background: accent.border, color: '#fff' }}>{durationLabel}</b>}
          <strong>{title}</strong>
          {order && <em>{getCustomerName(order.customer_id)}</em>}
          {(!compact || durationMinutes >= 180) && plan.note && <small>{plan.note}</small>}
        </button>
        <button type="button" className="workPlannerDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z plánu">
          ×
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="workPlannerHero" style={{ ...boxStyle }}>
        <div>
          <div className="sectionKicker">Pracovný plán</div>
          <h2>Kalendár zákaziek a úloh</h2>
          <p>Sem dávaj len reálne naplánované práce. Termín dokončenia zákazky sa do kalendára nepridáva automaticky.</p>
        </div>
        <div className="workPlannerHeroActions">
          <button type="button" onClick={() => { const week = getMonday(addDays(weekStart, -7)); setWeekStart(week); setSelectedDate(week); setPlanDate(week) }} style={buttonStyle}>
            Predošlý týždeň
          </button>
          <button type="button" onClick={() => { setWeekStart(getMonday(today)); setSelectedDate(today); setPlanDate(today) }} style={buttonStyle}>
            Dnes
          </button>
          <button type="button" onClick={() => { const week = getMonday(addDays(weekStart, 7)); setWeekStart(week); setSelectedDate(week); setPlanDate(week) }} style={buttonStyle}>
            Ďalší týždeň
          </button>
          <button type="button" onClick={onBackToOrders} style={{ ...buttonStyle, background: '#0f172a', color: '#fff' }}>
            Späť na zákazky
          </button>
        </div>
      </div>

      <div className="workPlannerToolbar" style={{ ...boxStyle }}>
        <div className="workPlannerMode">
          {[
            ['week', 'Týždeň'],
            ['day', 'Deň'],
            ['unplanned', 'Nenaplánované'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode as 'week' | 'day' | 'unplanned')}
              className={viewMode === mode ? 'active' : ''}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="workPlannerStats">
          <span><strong>{weekPlans.length}</strong> tento týždeň</span>
          <span><strong>{selectedPlans.length}</strong> vybraný deň</span>
          <span><strong>{unplannedOrders.length}</strong> čaká na plán</span>
        </div>
      </div>

      <div className="workPlannerLayout">
        <div className="workPlannerBoard" style={{ ...boxStyle }}>
          {viewMode === 'week' && (
            <div className="workPlannerWeek">
              {weekDays.map((dateKey, index) => {
                const dayPlans = plansByDate[dateKey] || []
                const isToday = dateKey === today
                const isSelected = dateKey === selectedDate
                const isWeekend = index > 4
                const isDragOver = dragOverDate === dateKey

                return (
                  <div
                    key={dateKey}
                    className={`workPlannerDay${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${isWeekend ? ' weekend' : ''}${isDragOver ? ' dragOver' : ''}`}
                    onClick={() => chooseDate(dateKey)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOverDate(dateKey)
                    }}
                    onDragLeave={() => setDragOverDate('')}
                    onDrop={(event) => onDayDrop(event, dateKey)}
                  >
                    <div className="workPlannerDayHeader">
                      <span>{shortDayNames[index]}</span>
                      <strong>{getShortDate(dateKey)}</strong>
                      <em>{dayPlans.length}</em>
                    </div>
                    <div className="workPlannerDayItems">
                      {dayPlans.length === 0 ? <span className="workPlannerEmpty">Voľné</span> : dayPlans.map((plan) => renderPlan(plan, true))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {viewMode === 'day' && (
            <div className="workPlannerDayDetail">
              <div className="workPlannerDayTitle">
                <div>
                  <div className="sectionKicker">{dayNames[(toLocalDate(selectedDate).getDay() + 6) % 7]}</div>
                  <h3>{formatDate(selectedDate)}</h3>
                </div>
                <input className="calendarPlanInput" type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} />
              </div>
              {selectedPlans.length === 0 ? (
                <div className="workPlannerNoData">Na tento deň zatiaľ nie je nič naplánované.</div>
              ) : (
                <div className="workPlannerDetailList">{selectedPlans.map((plan) => renderPlan(plan))}</div>
              )}
            </div>
          )}

          {viewMode === 'unplanned' && (
            <div className="workPlannerUnplannedWide">
              <div className="workPlannerDayTitle">
                <div>
                  <div className="sectionKicker">Zákazky bez dátumu montáže</div>
                  <h3>Nenaplánované zákazky</h3>
                </div>
                <input className="calendarPlanInput" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Hľadať zákazku alebo zákazníka..." />
              </div>
              <div className="workPlannerOrderList">
                {unplannedOrders.map((order) => (
                  <button key={order.id} type="button" className="workPlannerOrder" onClick={() => prepareOrder(order.id)}>
                    <strong>{order.nazov}</strong>
                    <span>{getCustomerName(order.customer_id)}</span>
                    <em style={getStatusBadgeStyle(order.stav)}>{getStatusLabel(order.stav)}</em>
                  </button>
                ))}
                {unplannedOrders.length === 0 && <div className="workPlannerNoData">Všetky aktívne zákazky sú už v pláne alebo nič nespĺňa filter.</div>}
              </div>
            </div>
          )}
        </div>

        <aside className="workPlannerSide">
          <div style={{ ...boxStyle }} className="workPlannerForm">
            <div>
              <div className="sectionKicker">{editingPlanId ? 'Úprava plánu' : 'Rýchle plánovanie'}</div>
              <h3>{editingPlanId ? 'Upraviť položku' : 'Pridať do kalendára'}</h3>
            </div>

            {!editingPlanId && (
              <div>
                <label className="calendarPlanLabel" htmlFor="calendar-order">Zákazka</label>
                <select id="calendar-order" className="calendarPlanInput" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
                  <option value="">Interná úloha bez zákazky</option>
                  {activeOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.nazov} - {getCustomerName(order.customer_id)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(!selectedOrderId || editingPlanId) && (
              <div>
                <label className="calendarPlanLabel" htmlFor="calendar-title">Názov úlohy</label>
                <input id="calendar-title" className="calendarPlanInput" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Napr. pošta, nákup, programovanie" />
              </div>
            )}

            <div className="workPlannerFormGrid">
              <div>
                <label className="calendarPlanLabel" htmlFor="calendar-date">Deň</label>
                <input id="calendar-date" className="calendarPlanInput" type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
              </div>
              <div>
                <label className="calendarPlanLabel" htmlFor="calendar-start">Od</label>
                <input id="calendar-start" className="calendarPlanInput" type="time" value={planStart} onChange={(event) => setPlanStart(event.target.value)} />
              </div>
              <div>
                <label className="calendarPlanLabel" htmlFor="calendar-end">Do</label>
                <input id="calendar-end" className="calendarPlanInput" type="time" value={planEnd} onChange={(event) => setPlanEnd(event.target.value)} />
              </div>
            </div>

            <div>
              <label className="calendarPlanLabel" htmlFor="calendar-note">Poznámka</label>
              <textarea id="calendar-note" className="calendarPlanInput workPlannerTextarea" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} placeholder="Čo treba pripraviť, adresa, materiál..." />
            </div>

            <div className="workPlannerActionRow">
              <button type="button" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d', color: '#111827' }} onClick={editingPlanId ? saveEditedPlan : savePlan}>
                {editingPlanId ? 'Uložiť zmenu' : 'Pridať do plánu'}
              </button>
              {(editingPlanId || selectedOrderId || taskTitle || taskNote) && (
                <button type="button" style={buttonStyle} onClick={clearForm}>
                  Vyčistiť
                </button>
              )}
            </div>
          </div>

          <div style={{ ...boxStyle }} className="workPlannerSidebarList">
            <div className="workPlannerSideHeader">
              <div>
                <div className="sectionKicker">Na plánovanie</div>
                <h3>Nenaplánované</h3>
              </div>
              <span>{unplannedOrders.length}</span>
            </div>
            <input className="calendarPlanInput" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Hľadať..." />
            <div className="workPlannerOrderList">
              {unplannedOrders.slice(0, 14).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  draggable
                  onDragStart={(event) => onOrderDragStart(event, order.id)}
                  onClick={() => prepareOrder(order.id)}
                  onDoubleClick={() => startEditOrder(order)}
                  className="workPlannerOrder"
                >
                  <strong>{order.nazov}</strong>
                  <span>{getCustomerName(order.customer_id)}</span>
                  <em style={getStatusBadgeStyle(order.stav)}>{getStatusLabel(order.stav)}</em>
                </button>
              ))}
              {unplannedOrders.length === 0 && <div className="workPlannerNoData">Všetko je naplánované.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
