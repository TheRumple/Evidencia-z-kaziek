'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'
import type { Customer, Order, WorkLog } from '@/lib/dashboard-types'
import { supabase } from '@/lib/supabase'

type InvoiceLog = WorkLog & {
  order?: Order
  customer?: Customer
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function formatHours(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} h`
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = `${month}-01`
  const endDate = new Date(year, monthNumber, 0)
  const end = `${year}-${String(monthNumber).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  return { start, end }
}

function getMonthDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()

  return Array.from({ length: lastDay }, (_item, index) => {
    const day = String(index + 1).padStart(2, '0')
    return `${month}-${day}`
  })
}

function getLogTitle(text: string) {
  const cleaned = text.trim().replace(/\s+/g, ' ')
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned
}

export default function MesacnyVykazPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(getCurrentMonth())
  const [selectedCustomerId, setSelectedCustomerId] = useState('vsetci')
  const [search, setSearch] = useState('')
  const [activeAddDate, setActiveAddDate] = useState('')
  const [newLogOrderId, setNewLogOrderId] = useState('')
  const [newLogText, setNewLogText] = useState('')
  const [newLogHours, setNewLogHours] = useState('')
  const [newLogKm, setNewLogKm] = useState('')
  const [savingLog, setSavingLog] = useState(false)
  const [notice, setNotice] = useState('')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])

  useEffect(() => {
    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        window.location.href = '/login'
        return
      }

      setUserId(session.user.id)
      setCheckingAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (userId) void loadData(userId)
  }, [userId, month])

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      window.location.href = '/login'
      return
    }

    setUserId(session.user.id)
    setCheckingAuth(false)
  }

  async function loadData(currentUserId: string) {
    setLoading(true)
    const { start, end } = getMonthRange(month)

    const [customersResult, ordersResult, logsResult] = await Promise.all([
      supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov', { ascending: true }),
      supabase.from('orders').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
      supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', currentUserId)
        .gte('datum', start)
        .lte('datum', end)
        .order('datum', { ascending: true }),
    ])

    if (customersResult.error) alert(customersResult.error.message)
    if (ordersResult.error) alert(ordersResult.error.message)
    if (logsResult.error) alert(logsResult.error.message)

    setCustomers((customersResult.data || []) as Customer[])
    setOrders((ordersResult.data || []) as Order[])
    setWorkLogs((logsResult.data || []) as WorkLog[])
    setLoading(false)
  }

  const orderById = useMemo(() => {
    return Object.fromEntries(orders.map((order) => [order.id, order]))
  }, [orders])

  const customerById = useMemo(() => {
    return Object.fromEntries(customers.map((customer) => [customer.id, customer]))
  }, [customers])

  const invoiceLogs = useMemo<InvoiceLog[]>(() => {
    return workLogs
      .map((log) => {
        const order = orderById[log.order_id]
        const customer = order ? customerById[order.customer_id] : undefined
        return { ...log, order, customer }
      })
      .filter((log) => {
        if (selectedCustomerId !== 'vsetci' && log.customer?.id !== selectedCustomerId) return false
        const q = search.trim().toLowerCase()
        if (!q) return true
        return [
          log.customer?.nazov || '',
          log.order?.nazov || '',
          log.nazov_vykazu || '',
          log.praca_popis || '',
          (log.zamestnanci || []).join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
  }, [workLogs, orderById, customerById, selectedCustomerId, search])

  const groupedByDay = useMemo(() => {
    const groups: Record<string, InvoiceLog[]> = {}
    for (const log of invoiceLogs) {
      groups[log.datum] = groups[log.datum] || []
      groups[log.datum].push(log)
    }
    return groups
  }, [invoiceLogs])

  const monthDays = useMemo(() => getMonthDays(month), [month])

  const filteredOrdersForForm = useMemo(() => {
    return orders
      .filter((order) => {
        if (selectedCustomerId === 'vsetci') return true
        return order.customer_id === selectedCustomerId
      })
      .sort((a, b) => {
        const customerA = customerById[a.customer_id]?.nazov || ''
        const customerB = customerById[b.customer_id]?.nazov || ''
        return `${customerA} ${a.nazov}`.localeCompare(`${customerB} ${b.nazov}`, 'sk')
      })
  }, [orders, selectedCustomerId, customerById])

  const customerSummary = useMemo(() => {
    const summary: Record<string, { customerName: string; hours: number; km: number; count: number }> = {}
    for (const log of invoiceLogs) {
      const customerName = log.customer?.nazov || 'Nepriradené'
      summary[customerName] = summary[customerName] || { customerName, hours: 0, km: 0, count: 0 }
      summary[customerName].hours += Number(log.hodiny || 0)
      summary[customerName].km += Number(log.kilometre || 0)
      summary[customerName].count += 1
    }
    return Object.values(summary).sort((a, b) => a.customerName.localeCompare(b.customerName, 'sk'))
  }, [invoiceLogs])

  const totals = useMemo(() => {
    return invoiceLogs.reduce(
      (sum, log) => ({
        hours: sum.hours + Number(log.hodiny || 0),
        km: sum.km + Number(log.kilometre || 0),
      }),
      { hours: 0, km: 0 }
    )
  }, [invoiceLogs])

  function copyInvoiceText() {
    const lines = invoiceLogs.map((log) => {
      return [
        formatDate(log.datum),
        log.customer?.nazov || 'Nepriradené',
        log.order?.nazov || 'Bez zákazky',
        log.nazov_vykazu || '',
        log.praca_popis || '',
        formatHours(log.hodiny),
        `${Number(log.kilometre || 0).toFixed(0)} km`,
      ]
        .filter(Boolean)
        .join(' | ')
    })

    navigator.clipboard.writeText(lines.join('\n'))
  }

  function openAddForDate(date: string) {
    setActiveAddDate(date)
    setNewLogText('')
    setNewLogHours('')
    setNewLogKm('')
    setNotice('')

    if (!newLogOrderId || !filteredOrdersForForm.some((order) => order.id === newLogOrderId)) {
      setNewLogOrderId(filteredOrdersForForm[0]?.id || '')
    }
  }

  async function addWorkLogFromMonth(date: string) {
    if (!userId) return

    if (!newLogOrderId) {
      setNotice('Vyber zákazku.')
      return
    }

    if (!newLogText.trim()) {
      setNotice('Zadaj popis práce.')
      return
    }

    const hours = Number(String(newLogHours).replace(',', '.'))
    if (!Number.isFinite(hours) || hours <= 0) {
      setNotice('Zadaj platný počet hodín.')
      return
    }

    const kilometres = Number(String(newLogKm || '0').replace(',', '.'))
    if (!Number.isFinite(kilometres) || kilometres < 0) {
      setNotice('Zadaj platné kilometre.')
      return
    }

    setSavingLog(true)
    setNotice('')

    const { error } = await supabase.from('work_logs').insert([
      {
        user_id: userId,
        order_id: newLogOrderId,
        datum: date,
        nazov_vykazu: getLogTitle(newLogText),
        start_time: null,
        end_time: null,
        praca_popis: newLogText.trim(),
        hodiny: hours,
        kilometre: kilometres,
        zamestnanci: [],
      },
    ])

    setSavingLog(false)

    if (error) {
      setNotice(`Výkaz sa neuložil: ${error.message}`)
      return
    }

    setNewLogText('')
    setNewLogHours('')
    setNewLogKm('')
    setActiveAddDate('')
    setNotice('Výkaz bol uložený do zákazky aj do mesačného prehľadu.')
    await loadData(userId)
  }

  const boxStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.97)',
    border: '1px solid rgba(226,232,240,0.9)',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 16px 42px rgba(15, 23, 42, 0.1)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 42,
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    padding: '9px 11px',
    fontWeight: 700,
    outline: 'none',
  }

  const buttonStyle: CSSProperties = {
    minHeight: 42,
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    padding: '9px 13px',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 75% -10%, rgba(132,204,22,0.18), transparent 30%), linear-gradient(180deg, #060a12 0%, #111827 300px, #eef4ff 301px, #f8fafc 100%)',
        padding: 12,
        color: '#0f172a',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <style jsx global>{`
        .invoiceGrid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 12px;
          align-items: start;
        }

        .invoiceFilters {
          display: grid;
          grid-template-columns: 180px 1fr 1.4fr auto;
          gap: 10px;
          align-items: end;
        }

        .invoiceDay {
          display: grid;
          gap: 9px;
          padding: 14px;
          border-top: 1px solid #e2e8f0;
        }

        .invoiceDay:first-child {
          border-top: none;
        }

        .invoiceLogRow {
          display: grid;
          grid-template-columns: 1.1fr 1.2fr minmax(0, 2fr) 84px 72px;
          gap: 10px;
          align-items: start;
          border: 1px solid #e2e8f0;
          border-left: 5px solid #84cc16;
          border-radius: 14px;
          padding: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          box-shadow: 0 7px 18px rgba(15, 23, 42, 0.06);
        }

        .invoiceAddForm {
          display: grid;
          grid-template-columns: minmax(220px, 1.1fr) minmax(260px, 2fr) 100px 90px auto;
          gap: 9px;
          align-items: end;
          border: 1px solid #bef264;
          border-radius: 14px;
          padding: 10px;
          background: linear-gradient(135deg, #f7fee7 0%, #ffffff 100%);
        }

        .invoiceDayEmpty {
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          padding: 12px;
          color: #64748b;
          font-weight: 800;
          background: #f8fafc;
        }

        .invoiceMuted {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .invoiceStrong {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
        }

        .invoiceSummaryRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          border-bottom: 1px solid #e2e8f0;
          padding: 9px 0;
        }

        @media (max-width: 980px) {
          .invoiceGrid,
          .invoiceFilters {
            grid-template-columns: 1fr;
          }

          .invoiceLogRow {
            grid-template-columns: 1fr;
          }

          .invoiceAddForm {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1380, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div
          style={{
            ...boxStyle,
            background: 'linear-gradient(135deg, #0b1120 0%, #1f2937 74%, #365314 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <BrandLogo size="sm" tone="dark" style={{ marginBottom: 10 }} />
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Mesačný výkaz</h1>
              <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: 700 }}>
                Prehľad práce podľa dní a zákazníkov pre fakturáciu.
              </div>
            </div>

            <Link href="/" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }}>
              Späť na zákazky
            </Link>
          </div>
        </div>

        <div style={boxStyle}>
          {notice && (
            <div
              style={{
                marginBottom: 12,
                border: notice.includes('neuložil') || notice.includes('Zadaj') || notice.includes('Vyber') ? '1px solid #fecaca' : '1px solid #bef264',
                background: notice.includes('neuložil') || notice.includes('Zadaj') || notice.includes('Vyber') ? '#fff1f2' : '#f7fee7',
                color: notice.includes('neuložil') || notice.includes('Zadaj') || notice.includes('Vyber') ? '#991b1b' : '#365314',
                borderRadius: 12,
                padding: '10px 12px',
                fontWeight: 900,
              }}
            >
              {notice}
            </div>
          )}

          <div className="invoiceFilters">
            <div>
              <label className="invoiceMuted" htmlFor="month">
                Mesiac
              </label>
              <input id="month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={inputStyle} />
            </div>

            <div>
              <label className="invoiceMuted" htmlFor="customer">
                Firma
              </label>
              <select id="customer" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} style={inputStyle}>
                <option value="vsetci">Všetky firmy</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.nazov}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="invoiceMuted" htmlFor="search">
                Hľadať
              </label>
              <input
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Firma, zákazka, popis práce..."
                style={inputStyle}
              />
            </div>

            <button type="button" style={buttonStyle} onClick={copyInvoiceText}>
              Kopírovať pre faktúru
            </button>
          </div>
        </div>

        <div className="invoiceGrid">
          <div style={{ ...boxStyle, padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 20, color: '#64748b', fontWeight: 800 }}>Načítavam výkazy...</div>
            ) : (
              monthDays.map((date) => {
                const logs = groupedByDay[date] || []

                return (
                <section key={date} className="invoiceDay">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{formatDate(date)}</div>
                      <div className="invoiceMuted">{logs.length} zápisov</div>
                    </div>
                    <div style={{ fontWeight: 900, color: '#365314' }}>
                      {formatHours(logs.reduce((sum, log) => sum + Number(log.hodiny || 0), 0))}
                    </div>
                    <button type="button" style={buttonStyle} onClick={() => openAddForDate(date)}>
                      + Pridať zápis
                    </button>
                  </div>

                  {activeAddDate === date && (
                    <div className="invoiceAddForm">
                      <div>
                        <label className="invoiceMuted" htmlFor={`order-${date}`}>
                          Zákazka
                        </label>
                        <select id={`order-${date}`} value={newLogOrderId} onChange={(event) => setNewLogOrderId(event.target.value)} style={inputStyle}>
                          <option value="">Vyber zákazku</option>
                          {filteredOrdersForForm.map((order) => (
                            <option key={order.id} value={order.id}>
                              {customerById[order.customer_id]?.nazov || 'Neznámy zákazník'} - {order.nazov}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="invoiceMuted" htmlFor={`text-${date}`}>
                          Čo sa spravilo
                        </label>
                        <input
                          id={`text-${date}`}
                          value={newLogText}
                          onChange={(event) => setNewLogText(event.target.value)}
                          placeholder="Napr. výmena zdroja, konfigurácia siete, diagnostika..."
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label className="invoiceMuted" htmlFor={`hours-${date}`}>
                          Hodiny
                        </label>
                        <input
                          id={`hours-${date}`}
                          value={newLogHours}
                          onChange={(event) => setNewLogHours(event.target.value)}
                          placeholder="1,5"
                          inputMode="decimal"
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label className="invoiceMuted" htmlFor={`km-${date}`}>
                          Km
                        </label>
                        <input
                          id={`km-${date}`}
                          value={newLogKm}
                          onChange={(event) => setNewLogKm(event.target.value)}
                          placeholder="0"
                          inputMode="decimal"
                          style={inputStyle}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }}
                          onClick={() => addWorkLogFromMonth(date)}
                          disabled={savingLog}
                        >
                          {savingLog ? 'Ukladám...' : 'Uložiť'}
                        </button>
                        <button type="button" style={buttonStyle} onClick={() => setActiveAddDate('')}>
                          Zrušiť
                        </button>
                      </div>
                    </div>
                  )}

                  {logs.length === 0 && <div className="invoiceDayEmpty">Bez zápisu pre zvolený filter.</div>}

                  {logs.map((log) => (
                    <div key={log.id} className="invoiceLogRow">
                      <div>
                        <div className="invoiceMuted">Firma</div>
                        <div className="invoiceStrong">{log.customer?.nazov || 'Nepriradené'}</div>
                      </div>

                      <div>
                        <div className="invoiceMuted">Zákazka</div>
                        <div className="invoiceStrong">{log.order?.nazov || 'Bez zákazky'}</div>
                        {log.nazov_vykazu && <div className="invoiceMuted" style={{ marginTop: 3 }}>{log.nazov_vykazu}</div>}
                      </div>

                      <div>
                        <div className="invoiceMuted">Popis práce</div>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.35 }}>{log.praca_popis || '-'}</div>
                        {(log.zamestnanci || []).length > 0 && (
                          <div className="invoiceMuted" style={{ marginTop: 5 }}>
                            {(log.zamestnanci || []).join(', ')}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="invoiceMuted">Čas</div>
                        <div className="invoiceStrong">{formatHours(log.hodiny)}</div>
                      </div>

                      <div>
                        <div className="invoiceMuted">Km</div>
                        <div className="invoiceStrong">{Number(log.kilometre || 0).toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </section>
                )
              })
            )}
          </div>

          <aside style={boxStyle}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 900, marginBottom: 5 }}>Súhrn mesiaca</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{formatHours(totals.hours)}</div>
            <div style={{ color: '#64748b', fontWeight: 800, marginTop: 4 }}>{Number(totals.km || 0).toFixed(0)} km spolu</div>

            <div style={{ marginTop: 18, display: 'grid', gap: 2 }}>
              {customerSummary.map((item) => (
                <div key={item.customerName} className="invoiceSummaryRow">
                  <div>
                    <div className="invoiceStrong">{item.customerName}</div>
                    <div className="invoiceMuted">{item.count} zápisov</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 900 }}>
                    {formatHours(item.hours)}
                    <div className="invoiceMuted">{item.km.toFixed(0)} km</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
