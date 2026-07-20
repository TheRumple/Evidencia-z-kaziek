import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CalendarPlan, Order } from '@/lib/dashboard-types'
import { formatDate, getStatusBadgeStyle, getStatusLabel, getTodayDate } from '@/lib/dashboard-utils'

type CalendarViewProps = {
  addCalendarPlan: (input: {
    orderId: string
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
  orders: Order[]
  startEditOrder: (order: Order) => void
}

const monthNames = [
  'Január',
  'Február',
  'Marec',
  'Apríl',
  'Máj',
  'Jún',
  'Júl',
  'August',
  'September',
  'Október',
  'November',
  'December',
]

const dayNames = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const mondayIndex = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayIndex)

  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    const next = new Date(start)
    next.setDate(start.getDate() + i)
    days.push(next)
  }

  const lastWeekAllNextMonth = days.slice(35).every((day) => day > last && day.getMonth() !== monthDate.getMonth())
  return lastWeekAllNextMonth ? days.slice(0, 35) : days
}

export function CalendarView({
  addCalendarPlan,
  boxStyle,
  buttonStyle,
  calendarPlans,
  deleteCalendarPlan,
  getCustomerName,
  orders,
  startEditOrder,
}: CalendarViewProps) {
  const today = getTodayDate()
  const [planOrderId, setPlanOrderId] = useState('')
  const [planDate, setPlanDate] = useState(today)
  const [planStart, setPlanStart] = useState('')
  const [planEnd, setPlanEnd] = useState('')
  const [planNote, setPlanNote] = useState('')
  const currentMonth = new Date()
  const calendarDays = buildCalendarDays(currentMonth)
  const activeOrders = orders.filter((order) => !['odovzdana', 'stornovana'].includes(order.stav))
  const plannedOrders = activeOrders.filter((order) => order.termin)
  const overdueOrders = plannedOrders.filter((order) => order.termin && order.termin < today)
  const thisWeekEnd = new Date()
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7)
  const upcomingOrders = plannedOrders
    .filter((order) => order.termin && order.termin >= today && order.termin <= toDateKey(thisWeekEnd))
    .sort((a, b) => String(a.termin).localeCompare(String(b.termin)))

  const ordersByDate = plannedOrders.reduce<Record<string, Order[]>>((acc, order) => {
    const key = String(order.termin).slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(order)
    return acc
  }, {})
  const planOrderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])
  const plansByDate = calendarPlans.reduce<Record<string, CalendarPlan[]>>((acc, plan) => {
    const key = String(plan.plan_date).slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(plan)
    acc[key].sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')))
    return acc
  }, {})

  async function submitPlan() {
    await addCalendarPlan({
      orderId: planOrderId,
      planDate,
      startTime: planStart,
      endTime: planEnd,
      note: planNote,
    })
    setPlanStart('')
    setPlanEnd('')
    setPlanNote('')
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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', fontWeight: 800, marginBottom: 5 }}>Kalendár zákaziek</div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.78)', fontSize: 14 }}>
              Prehľad termínov, zákaziek po termíne a práce na najbližšie dni.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '9px 12px' }}>
              <strong>{calendarPlans.length}</strong> v pláne
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '9px 12px', color: overdueOrders.length ? '#fecaca' : '#fff' }}>
              <strong>{overdueOrders.length}</strong> po termíne
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...boxStyle, padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Naplánovať zákazku</div>
        <div className="calendarPlanForm">
          <div>
            <label className="calendarPlanLabel" htmlFor="plan-order">Zákazka</label>
            <select id="plan-order" className="calendarPlanInput" value={planOrderId} onChange={(event) => setPlanOrderId(event.target.value)}>
              <option value="">Vyber zákazku</option>
              {activeOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.nazov} - {getCustomerName(order.customer_id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="calendarPlanLabel" htmlFor="plan-date">Deň</label>
            <input id="plan-date" className="calendarPlanInput" type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
          </div>

          <div>
            <label className="calendarPlanLabel" htmlFor="plan-start">Od</label>
            <input id="plan-start" className="calendarPlanInput" type="time" value={planStart} onChange={(event) => setPlanStart(event.target.value)} />
          </div>

          <div>
            <label className="calendarPlanLabel" htmlFor="plan-end">Do</label>
            <input id="plan-end" className="calendarPlanInput" type="time" value={planEnd} onChange={(event) => setPlanEnd(event.target.value)} />
          </div>

          <div>
            <label className="calendarPlanLabel" htmlFor="plan-note">Poznámka</label>
            <input id="plan-note" className="calendarPlanInput" value={planNote} onChange={(event) => setPlanNote(event.target.value)} placeholder="Napr. montáž, obhliadka, servis" />
          </div>

          <button type="button" style={{ ...buttonStyle, alignSelf: 'end', minHeight: 42, background: '#84cc16', borderColor: '#65a30d', color: '#111827', fontWeight: 900 }} onClick={submitPlan}>
            Pridať do plánu
          </button>
        </div>
      </div>

      {overdueOrders.length > 0 && (
        <div style={{ ...boxStyle, padding: 14, border: '1px solid #fecaca', background: '#fff7f7' }}>
          <div style={{ fontWeight: 900, color: '#991b1b', marginBottom: 10 }}>Po termíne</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {overdueOrders.slice(0, 6).map((order) => (
              <button key={order.id} type="button" onClick={() => startEditOrder(order)} style={{ ...buttonStyle, justifyContent: 'space-between', color: '#991b1b' }}>
                <span>{order.nazov}</span>
                <strong>{formatDate(order.termin)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="calendarLayout">
        <div style={{ ...boxStyle, padding: 14 }}>
          <div className="calendarGrid calendarWeekDays">
            {dayNames.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="calendarGrid">
            {calendarDays.map((day) => {
              const key = toDateKey(day)
              const dayOrders = ordersByDate[key] || []
              const dayPlans = plansByDate[key] || []
              const inMonth = day.getMonth() === currentMonth.getMonth()
              const isToday = key === today

              return (
                <div
                  key={key}
                  className="calendarDay"
                  style={{
                    opacity: inMonth ? 1 : 0.42,
                    borderColor: isToday ? '#84cc16' : '#e2e8f0',
                    background: isToday ? '#f7fee7' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ color: isToday ? '#365314' : '#0f172a' }}>{day.getDate()}</strong>
                    {dayPlans.length > 0 && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 900 }}>{dayPlans.length}</span>}
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    {dayPlans.slice(0, 4).map((plan) => {
                      const order = planOrderMap.get(plan.order_id)
                      return (
                        <div key={plan.id} className="calendarPlanItem">
                          <button
                            type="button"
                            onClick={() => order && startEditOrder(order)}
                            className="calendarPlanMain"
                            title={order ? `${order.nazov} - ${getCustomerName(order.customer_id)}` : 'Neznáma zákazka'}
                          >
                            <span>{plan.start_time || '--:--'}{plan.end_time ? `-${plan.end_time}` : ''}</span>
                            <strong>{order?.nazov || 'Neznáma zákazka'}</strong>
                          </button>
                          <button type="button" className="calendarPlanDelete" onClick={() => void deleteCalendarPlan(plan.id)} title="Zmazať z plánu">
                            ×
                          </button>
                        </div>
                      )
                    })}
                    {dayPlans.length > 4 && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>+ {dayPlans.length - 4} ďalšie</div>}
                    {dayOrders.slice(0, 3).map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => startEditOrder(order)}
                        className="calendarOrder"
                        style={getStatusBadgeStyle(order.stav)}
                        title={`${order.nazov} - ${getCustomerName(order.customer_id)}`}
                      >
                        Termín: {order.nazov}
                      </button>
                    ))}
                    {dayOrders.length > 3 && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>+ {dayOrders.length - 3} ďalšie</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ ...boxStyle, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Najbližších 7 dní</div>
          {upcomingOrders.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 14 }}>Na najbližší týždeň nie je zadaný žiadny termín.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {upcomingOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => startEditOrder(order)}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    borderRadius: 12,
                    padding: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong>{formatDate(order.termin)}</strong>
                    <span style={{ fontSize: 12, fontWeight: 900, ...getStatusBadgeStyle(order.stav), padding: '2px 7px', borderRadius: 999 }}>
                      {getStatusLabel(order.stav)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 900 }}>{order.nazov}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{getCustomerName(order.customer_id)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
