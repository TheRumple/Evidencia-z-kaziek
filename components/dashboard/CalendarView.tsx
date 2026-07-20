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
}

const monthNames = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December']
const dayNames = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const mondayIndex = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayIndex)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
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
}: CalendarViewProps) {
  const today = getTodayDate()
  const [planDate, setPlanDate] = useState(today)
  const [planStart, setPlanStart] = useState('')
  const [planEnd, setPlanEnd] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskNote, setTaskNote] = useState('')
  const [dragOverDate, setDragOverDate] = useState('')

  const currentMonth = new Date()
  const calendarDays = buildCalendarDays(currentMonth)
  const activeOrders = orders.filter((order) => !['odovzdana', 'stornovana'].includes(order.stav))
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])
  const plansByDate = calendarPlans.reduce<Record<string, CalendarPlan[]>>((acc, plan) => {
    const key = String(plan.plan_date).slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(plan)
    acc[key].sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')))
    return acc
  }, {})

  async function addTask() {
    await addCalendarPlan({
      title: taskTitle,
      planDate,
      startTime: planStart,
      endTime: planEnd,
      note: taskNote,
    })
    setTaskTitle('')
    setTaskNote('')
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

  function onOrderDragStart(event: DragEvent<HTMLButtonElement>, orderId: string) {
    event.dataTransfer.setData('text/plain', orderId)
    event.dataTransfer.effectAllowed = 'copy'
  }

  function onDayDrop(event: DragEvent<HTMLDivElement>, dateKey: string) {
    event.preventDefault()
    setDragOverDate('')
    const orderId = event.dataTransfer.getData('text/plain')
    if (orderId) void addOrderToDate(orderId, dateKey)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          ...boxStyle,
          padding: 18,
          background: 'linear-gradient(135deg, #0f172a 0%, #243447 100%)',
          color: '#fff',
          border: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', fontWeight: 800, marginBottom: 5 }}>Pracovný kalendár</div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.78)', fontSize: 14 }}>
              Sem plánuj montáže, servisné výjazdy aj vlastné úlohy. Zákazky z boku môžeš pretiahnuť do dňa.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onBackToOrders} style={{ ...buttonStyle, background: '#fff', borderColor: '#fff', color: '#0f172a', fontWeight: 900 }}>
              Späť na zákazky
            </button>
            <div style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '9px 12px' }}>
              <strong>{calendarPlans.length}</strong> v pláne
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...boxStyle, padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Pridať jednoduchú úlohu</div>
        <div className="calendarTaskForm">
          <div>
            <label className="calendarPlanLabel" htmlFor="task-title">Úloha</label>
            <input id="task-title" className="calendarPlanInput" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Napr. pošta, objednať materiál, naprogramovať" />
          </div>
          <div>
            <label className="calendarPlanLabel" htmlFor="task-date">Deň</label>
            <input id="task-date" className="calendarPlanInput" type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
          </div>
          <div>
            <label className="calendarPlanLabel" htmlFor="task-start">Od</label>
            <input id="task-start" className="calendarPlanInput" type="time" value={planStart} onChange={(event) => setPlanStart(event.target.value)} />
          </div>
          <div>
            <label className="calendarPlanLabel" htmlFor="task-end">Do</label>
            <input id="task-end" className="calendarPlanInput" type="time" value={planEnd} onChange={(event) => setPlanEnd(event.target.value)} />
          </div>
          <div>
            <label className="calendarPlanLabel" htmlFor="task-note">Poznámka</label>
            <input id="task-note" className="calendarPlanInput" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} />
          </div>
          <button type="button" style={{ ...buttonStyle, alignSelf: 'end', minHeight: 42, background: '#84cc16', borderColor: '#65a30d', color: '#111827', fontWeight: 900 }} onClick={addTask}>
            Pridať úlohu
          </button>
        </div>
      </div>

      <div className="calendarPlannerLayout">
        <aside style={{ ...boxStyle, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Zákazky na plánovanie</div>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
            Potiahni zákazku do konkrétneho dňa v kalendári.
          </div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 680, overflowY: 'auto', paddingRight: 4 }}>
            {activeOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                draggable
                onDragStart={(event) => onOrderDragStart(event, order.id)}
                onDoubleClick={() => startEditOrder(order)}
                className="calendarDraggableOrder"
              >
                <span style={{ fontWeight: 900 }}>{order.nazov}</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>{getCustomerName(order.customer_id)}</span>
                <span style={{ fontSize: 11, fontWeight: 900, ...getStatusBadgeStyle(order.stav), padding: '2px 7px', borderRadius: 999, justifySelf: 'start' }}>
                  {getStatusLabel(order.stav)}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div style={{ ...boxStyle, padding: 14 }}>
          <div className="calendarGrid calendarWeekDays">
            {dayNames.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="calendarGrid">
            {calendarDays.map((day) => {
              const key = toDateKey(day)
              const dayPlans = plansByDate[key] || []
              const inMonth = day.getMonth() === currentMonth.getMonth()
              const isToday = key === today
              const isDragOver = dragOverDate === key

              return (
                <div
                  key={key}
                  className="calendarDay"
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOverDate(key)
                  }}
                  onDragLeave={() => setDragOverDate('')}
                  onDrop={(event) => onDayDrop(event, key)}
                  style={{
                    opacity: inMonth ? 1 : 0.42,
                    borderColor: isDragOver ? '#65a30d' : isToday ? '#84cc16' : '#e2e8f0',
                    background: isDragOver ? '#ecfccb' : isToday ? '#f7fee7' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ color: isToday ? '#365314' : '#0f172a' }}>{day.getDate()}</strong>
                    {dayPlans.length > 0 && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 900 }}>{dayPlans.length}</span>}
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    {dayPlans.slice(0, 5).map((plan) => {
                      const order = plan.order_id ? orderMap.get(plan.order_id) : null
                      const title = order?.nazov || plan.title || 'Úloha'
                      return (
                        <div key={plan.id} className="calendarPlanItem">
                          <button
                            type="button"
                            onClick={() => order && startEditOrder(order)}
                            className={order ? 'calendarPlanMain' : 'calendarPlanMain calendarPlanTask'}
                            title={order ? `${order.nazov} - ${getCustomerName(order.customer_id)}` : plan.note || title}
                          >
                            <span>{plan.start_time || '--:--'}{plan.end_time ? `-${plan.end_time}` : ''}</span>
                            <strong>{title}</strong>
                          </button>
                          <button type="button" className="calendarPlanDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z plánu">
                            ×
                          </button>
                        </div>
                      )
                    })}
                    {dayPlans.length > 5 && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>+ {dayPlans.length - 5} ďalšie</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
