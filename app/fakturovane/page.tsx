'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: string
  user_id: string
  nazov: string
  kontakt: string | null
  telefon: string | null
  email: string | null
  created_at?: string
}

type Order = {
  id: string
  user_id: string
  nazov: string
  customer_id: string
  stav: string
  praca: string | null
  popis: string | null
  termin: string | null
  hodiny?: number
  created_at?: string
}

const STATUSY = [
  { value: 'nova', label: 'Nová' },
  { value: 'rozpracovana', label: 'Rozpracovaná' },
  { value: 'caka', label: 'Čaká na materiál' },
  { value: 'hotova', label: 'Dokončená' },
  { value: 'odovzdana', label: 'Fakturovaná' },
  { value: 'stornovana', label: 'Stornovaná' },
]

const ARCHIV_STATUSY = ['odovzdana', 'stornovana']

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function getStatusLabel(stav: string) {
  return STATUSY.find((s) => s.value === stav)?.label || stav
}

function getStatusBadgeStyle(stav: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    nova: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
    rozpracovana: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    caka: { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' },
    hotova: { background: '#cffafe', color: '#155e75', border: '1px solid #67e8f9' },
    odovzdana: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
    stornovana: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  }
  return map[stav] || {}
}

function getStatusCardBorder(stav: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    odovzdana: { borderLeft: '6px solid #34d399' },
    stornovana: { borderLeft: '6px solid #f87171' },
    nova: { borderLeft: '6px solid #60a5fa' },
    rozpracovana: { borderLeft: '6px solid #fbbf24' },
    caka: { borderLeft: '6px solid #fb923c' },
    hotova: { borderLeft: '6px solid #22d3ee' },
  }
  return map[stav] || {}
}

export default function FakturovanePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('vsetky')
  const [sortBy, setSortBy] = useState('newest')

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
      setUserEmail(session.user.email || '')
      setCheckingAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (userId) {
      loadInitialData(userId)
    }
  }, [userId])

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      window.location.href = '/login'
      return
    }

    setUserId(session.user.id)
    setUserEmail(session.user.email || '')
    setCheckingAuth(false)
  }

  async function loadInitialData(currentUserId: string) {
    setLoading(true)
    await Promise.all([loadCustomers(currentUserId), loadOrders(currentUserId)])
    setLoading(false)
  }

  async function loadCustomers(currentUserId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    setCustomers((data || []) as Customer[])
  }

  async function loadOrders(currentUserId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    setOrders((data || []) as Order[])
  }

  async function updateOrderStatus(orderId: string, stav: string) {
    if (!userId) return

    const { error } = await supabase
      .from('orders')
      .update({ stav })
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
      return
    }

    loadOrders(userId)
  }

  async function deleteOrder(orderId: string) {
    if (!userId) return

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
      return
    }

    loadOrders(userId)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function getCustomerName(id: string) {
    return customers.find((c) => c.id === id)?.nazov || 'Neznámy zákazník'
  }

  const archiveOrders = useMemo(() => {
    return orders.filter((o) => ARCHIV_STATUSY.includes(o.stav))
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()

    const result = archiveOrders.filter((o) => {
      const customerName = getCustomerName(o.customer_id).toLowerCase()
      const matchesSearch = !q
        ? true
        : [o.nazov, o.praca || '', o.popis || '', customerName].join(' ').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'vsetky' ? true : o.stav === statusFilter
      return matchesSearch && matchesStatus
    })

    result.sort((a, b) => {
      const customerA = getCustomerName(a.customer_id).toLowerCase()
      const customerB = getCustomerName(b.customer_id).toLowerCase()
      const statusA = getStatusLabel(a.stav).toLowerCase()
      const statusB = getStatusLabel(b.stav).toLowerCase()
      const nazovA = (a.nazov || '').toLowerCase()
      const nazovB = (b.nazov || '').toLowerCase()
      const terminA = a.termin || '9999-12-31'
      const terminB = b.termin || '9999-12-31'
      const createdA = a.created_at || ''
      const createdB = b.created_at || ''

      switch (sortBy) {
        case 'customer':
          return customerA.localeCompare(customerB, 'sk')
        case 'status':
          return statusA.localeCompare(statusB, 'sk')
        case 'name':
          return nazovA.localeCompare(nazovB, 'sk')
        case 'deadline':
          return terminA.localeCompare(terminB)
        case 'oldest':
          return createdA.localeCompare(createdB)
        case 'newest':
        default:
          return createdB.localeCompare(createdA)
      }
    })

    return result
  }, [archiveOrders, search, statusFilter, sortBy, customers])

  const boxStyle: CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    outline: 'none',
    background: '#fff',
    fontSize: 14,
  }

  const buttonStyle: CSSProperties = {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const dangerButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#be123c',
  }

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)',
        padding: 16,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div
          style={{
            ...boxStyle,
            marginBottom: 22,
            padding: 24,
            background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div className="headerWrap">
            <div>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8, letterSpacing: 1 }}>
                ARCHÍV ZÁKAZIEK
              </div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Fakturované / Stornované</h1>
              <div style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>
                Zákazky odložené mimo hlavnej tabuľky
              </div>
            </div>

            <div className="headerActions">
              <div
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  minWidth: 220,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Prihlásený používateľ</div>
                <div style={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>
                  {userEmail || 'Používateľ'}
                </div>
              </div>

              <Link
                href="/"
                style={{
                  ...buttonStyle,
                  background: '#fff',
                  color: '#166534',
                  borderColor: '#fff',
                }}
              >
                Späť na hlavné zákazky
              </Link>

              <button
                style={{
                  ...buttonStyle,
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
                onClick={logout}
              >
                Odhlásiť
              </button>
            </div>
          </div>
        </div>

        <div className="summaryGrid" style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
          <div style={{ ...boxStyle, padding: 16 }}>
            <div
              style={{
                ...getStatusBadgeStyle('odovzdana'),
                display: 'inline-flex',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              Fakturované
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {archiveOrders.filter((o) => o.stav === 'odovzdana').length}
            </div>
          </div>

          <div style={{ ...boxStyle, padding: 16 }}>
            <div
              style={{
                ...getStatusBadgeStyle('stornovana'),
                display: 'inline-flex',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              Stornované
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {archiveOrders.filter((o) => o.stav === 'stornovana').length}
            </div>
          </div>
        </div>

        <div style={{ ...boxStyle, marginBottom: 20 }}>
          <div className="filtersGrid">
            <div>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, marginBottom: 6 }}>Hľadať</div>
              <input
                style={inputStyle}
                placeholder="Hľadať zákazku, popis, prácu alebo zákazníka"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, marginBottom: 6 }}>Filter</div>
              <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="vsetky">Všetky stavy</option>
                <option value="odovzdana">Fakturovaná</option>
                <option value="stornovana">Stornovaná</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, marginBottom: 6 }}>Radenie</div>
              <select style={inputStyle} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Najnovšie</option>
                <option value="oldest">Najstaršie</option>
                <option value="customer">Podľa zákazníka</option>
                <option value="status">Podľa stavu</option>
                <option value="name">Podľa názvu</option>
                <option value="deadline">Podľa termínu</option>
              </select>
            </div>
          </div>
        </div>

        <div style={boxStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>Archív zákaziek</div>
            <div style={{ color: '#475569', fontWeight: 700 }}>Zobrazené: {filteredOrders.length}</div>
          </div>

          <div className="desktopTable">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 10px' }}>Názov</th>
                    <th style={{ padding: '12px 10px' }}>Zákazník</th>
                    <th style={{ padding: '12px 10px' }}>Práca</th>
                    <th style={{ padding: '12px 10px' }}>Termín</th>
                    <th style={{ padding: '12px 10px' }}>Stav</th>
                    <th style={{ padding: '12px 10px' }}>Akcie</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: 800 }}>{o.nazov}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{o.popis || '-'}</div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>{getCustomerName(o.customer_id)}</td>
                      <td style={{ padding: '12px 10px' }}>{o.praca || '-'}</td>
                      <td style={{ padding: '12px 10px' }}>{formatDate(o.termin)}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <select
                          value={o.stav}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          style={{
                            ...getStatusBadgeStyle(o.stav),
                            padding: '8px 10px',
                            borderRadius: 999,
                            fontWeight: 800,
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          {STATUSY.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <button style={dangerButtonStyle} onClick={() => deleteOrder(o.id)}>
                          Zmazať
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                        Žiadne archivované zákazky
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mobileCards">
            {filteredOrders.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                Žiadne archivované zákazky
              </div>
            )}

            {filteredOrders.map((o) => (
              <div
                key={o.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 12,
                  background: '#fff',
                  ...getStatusCardBorder(o.stav),
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{o.nazov}</div>
                    <div style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>{o.popis || '-'}</div>
                  </div>

                  <div
                    style={{
                      ...getStatusBadgeStyle(o.stav),
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getStatusLabel(o.stav)}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                  <div><strong>Zákazník:</strong> {getCustomerName(o.customer_id)}</div>
                  <div><strong>Práca:</strong> {o.praca || '-'}</div>
                  <div><strong>Termín:</strong> {formatDate(o.termin)}</div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, marginBottom: 6 }}>Stav</div>
                  <select
                    value={o.stav}
                    onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                    style={{
                      ...inputStyle,
                      ...getStatusBadgeStyle(o.stav),
                      fontWeight: 800,
                    }}
                  >
                    {STATUSY.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button style={{ ...dangerButtonStyle, width: '100%' }} onClick={() => deleteOrder(o.id)}>
                    Zmazať
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 18 }}>
            Načítavam dáta...
          </div>
        )}
      </div>

      <style jsx>{`
        .headerWrap {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          flex-wrap: wrap;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .summaryGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .filtersGrid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
        }

        .mobileCards {
          display: none;
        }

        .desktopTable {
          display: block;
        }

        @media (max-width: 768px) {
          .filtersGrid,
          .summaryGrid {
            grid-template-columns: 1fr;
          }

          .desktopTable {
            display: none;
          }

          .mobileCards {
            display: block;
          }

          .headerActions {
            width: 100%;
            justify-content: stretch;
          }

          .headerActions :global(a),
          .headerActions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}