'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STATUSY = [
  { value: 'nova', label: 'Nová' },
  { value: 'rozpracovana', label: 'Rozpracovaná' },
  { value: 'caka', label: 'Čaká na materiál' },
  { value: 'hotova', label: 'Dokončená' },
  { value: 'odovzdana', label: 'Fakturovaná' },
  { value: 'stornovana', label: 'Stornovaná' },
]

function getStatusBadgeStyle(stav: string) {
  const map: Record<string, React.CSSProperties> = {
    nova: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
    rozpracovana: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    caka: { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' },
    hotova: { background: '#cffafe', color: '#155e75', border: '1px solid #67e8f9' },
    odovzdana: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
    stornovana: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  }
  return map[stav] || {}
}

function getStatusRowStyle(stav: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    nova: { background: '#eff6ff' },
    rozpracovana: { background: '#fffbeb' },
    caka: { background: '#fff7ed' },
    hotova: { background: '#ecfeff' },
    odovzdana: { background: '#ecfdf5' },
    stornovana: { background: '#fef2f2' },
  }
  return map[stav] || {}
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: '1px solid #cbd5e1',
              background: '#fff',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Zavrieť
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [customers, setCustomers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'zakazky' | 'zakaznici'>('zakazky')

  const [nazov, setNazov] = useState('')
  const [kontakt, setKontakt] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')

  const [orderNazov, setOrderNazov] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [orderPraca, setOrderPraca] = useState('Servis')
  const [orderPopis, setOrderPopis] = useState('')
  const [orderTermin, setOrderTermin] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('vsetky')

  const [editCustomerId, setEditCustomerId] = useState('')
  const [editCustomerNazov, setEditCustomerNazov] = useState('')
  const [editCustomerKontakt, setEditCustomerKontakt] = useState('')
  const [editCustomerTelefon, setEditCustomerTelefon] = useState('')
  const [editCustomerEmail, setEditCustomerEmail] = useState('')

  const [editOrderId, setEditOrderId] = useState('')
  const [editOrderNazov, setEditOrderNazov] = useState('')
  const [editOrderCustomerId, setEditOrderCustomerId] = useState('')
  const [editOrderPraca, setEditOrderPraca] = useState('Servis')
  const [editOrderPopis, setEditOrderPopis] = useState('')
  const [editOrderTermin, setEditOrderTermin] = useState('')

  const [openAddCustomer, setOpenAddCustomer] = useState(false)
  const [openAddOrder, setOpenAddOrder] = useState(false)
  const [openEditCustomer, setOpenEditCustomer] = useState(false)
  const [openEditOrder, setOpenEditOrder] = useState(false)

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
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (userId) {
      loadCustomers(userId)
      loadOrders(userId)
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
    setCheckingAuth(false)
  }

  async function loadCustomers(currentUserId: string) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    setCustomers(data || [])
  }

  async function loadOrders(currentUserId: string) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    setOrders(data || [])
  }

  function resetAddCustomerForm() {
    setNazov('')
    setKontakt('')
    setTelefon('')
    setEmail('')
  }

  function resetAddOrderForm() {
    setOrderNazov('')
    setCustomerId('')
    setOrderPraca('Servis')
    setOrderPopis('')
    setOrderTermin('')
  }

  function resetEditCustomerForm() {
    setEditCustomerId('')
    setEditCustomerNazov('')
    setEditCustomerKontakt('')
    setEditCustomerTelefon('')
    setEditCustomerEmail('')
  }

  function resetEditOrderForm() {
    setEditOrderId('')
    setEditOrderNazov('')
    setEditOrderCustomerId('')
    setEditOrderPraca('Servis')
    setEditOrderPopis('')
    setEditOrderTermin('')
  }

  async function addCustomer() {
    if (!nazov.trim() || !userId) return

    await supabase.from('customers').insert([
      {
        user_id: userId,
        nazov,
        kontakt,
        telefon,
        email,
      },
    ])

    resetAddCustomerForm()
    setOpenAddCustomer(false)
    loadCustomers(userId)
  }

  async function addOrder() {
    if (!orderNazov.trim() || !customerId || !userId) return

    await supabase.from('orders').insert([
      {
        user_id: userId,
        nazov: orderNazov,
        customer_id: customerId,
        stav: 'nova',
        praca: orderPraca,
        popis: orderPopis,
        termin: orderTermin || null,
        hodiny: 0,
      },
    ])

    resetAddOrderForm()
    setOpenAddOrder(false)
    loadOrders(userId)
  }

  async function updateOrderStatus(orderId: string, stav: string) {
    if (!userId) return

    await supabase.from('orders').update({ stav }).eq('id', orderId)
    loadOrders(userId)
  }

  async function deleteOrder(orderId: string) {
    if (!userId) return

    const ok = window.confirm('Naozaj chceš zmazať túto zákazku?')
    if (!ok) return

    await supabase.from('orders').delete().eq('id', orderId)
    loadOrders(userId)
  }

  async function deleteCustomer(customerIdToDelete: string) {
    if (!userId) return

    const hasOrders = orders.some((o) => o.customer_id === customerIdToDelete)

    if (hasOrders) {
      alert('Tento zákazník má naviazané zákazky. Najprv zmaž alebo presuň zákazky.')
      return
    }

    const ok = window.confirm('Naozaj chceš zmazať tohto zákazníka?')
    if (!ok) return

    await supabase.from('customers').delete().eq('id', customerIdToDelete)
    loadCustomers(userId)
  }

  function startEditCustomer(c: any) {
    setEditCustomerId(c.id)
    setEditCustomerNazov(c.nazov || '')
    setEditCustomerKontakt(c.kontakt || '')
    setEditCustomerTelefon(c.telefon || '')
    setEditCustomerEmail(c.email || '')
    setOpenEditCustomer(true)
  }

  async function saveCustomerEdit() {
    if (!editCustomerId || !editCustomerNazov.trim() || !userId) return

    await supabase
      .from('customers')
      .update({
        nazov: editCustomerNazov,
        kontakt: editCustomerKontakt,
        telefon: editCustomerTelefon,
        email: editCustomerEmail,
      })
      .eq('id', editCustomerId)

    resetEditCustomerForm()
    setOpenEditCustomer(false)
    loadCustomers(userId)
  }

  function startEditOrder(o: any) {
    setEditOrderId(o.id)
    setEditOrderNazov(o.nazov || '')
    setEditOrderCustomerId(o.customer_id || '')
    setEditOrderPraca(o.praca || 'Servis')
    setEditOrderPopis(o.popis || '')
    setEditOrderTermin(o.termin || '')
    setOpenEditOrder(true)
  }

  async function saveOrderEdit() {
    if (!editOrderId || !editOrderNazov.trim() || !editOrderCustomerId || !userId) return

    await supabase
      .from('orders')
      .update({
        nazov: editOrderNazov,
        customer_id: editOrderCustomerId,
        praca: editOrderPraca,
        popis: editOrderPopis,
        termin: editOrderTermin || null,
      })
      .eq('id', editOrderId)

    resetEditOrderForm()
    setOpenEditOrder(false)
    loadOrders(userId)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function getCustomerName(id: string) {
    return customers.find((c) => c.id === id)?.nazov || 'Neznámy zákazník'
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()

    return orders.filter((o) => {
      const customerName = getCustomerName(o.customer_id).toLowerCase()
      const matchesSearch = !q
        ? true
        : [o.nazov, o.praca, o.popis || '', customerName]
            .join(' ')
            .toLowerCase()
            .includes(q)

      const matchesStatus = statusFilter === 'vsetky' ? true : o.stav === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [orders, search, statusFilter, customers])

  const boxStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    outline: 'none',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
  }

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #0f172a',
  }

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#be123c',
  }

  const tabButton = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 12,
    border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#0f172a',
    cursor: 'pointer',
    fontWeight: 600,
  })

  if (checkingAuth) {
    return (
      <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        Načítavam...
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: 24,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>ITspot s.r.o.</h1>
            <div style={{ marginTop: 6, fontSize: 20, color: '#334155', fontWeight: 600 }}>
              Evidencia zákaziek
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={primaryButtonStyle} onClick={() => setOpenAddOrder(true)}>
              Nová zákazka
            </button>
            <button style={buttonStyle} onClick={() => setOpenAddCustomer(true)}>
              Nový zákazník
            </button>
            <button style={buttonStyle} onClick={logout}>
              Odhlásiť
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button style={tabButton(activeTab === 'zakazky')} onClick={() => setActiveTab('zakazky')}>
            Zákazky
          </button>
          <button style={tabButton(activeTab === 'zakaznici')} onClick={() => setActiveTab('zakaznici')}>
            Zákazníci
          </button>
        </div>

        {activeTab === 'zakazky' && (
          <>
            <div style={{ ...boxStyle, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Prehľad stavov</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setStatusFilter('vsetky')}
                  style={{
                    ...buttonStyle,
                    background: statusFilter === 'vsetky' ? '#e2e8f0' : '#fff',
                    fontWeight: 600,
                  }}
                >
                  Všetky ({orders.length})
                </button>

                {STATUSY.map((s) => {
                  const count = orders.filter((o) => o.stav === s.value).length
                  return (
                    <button
                      key={s.value}
                      onClick={() => setStatusFilter(s.value)}
                      style={{
                        ...buttonStyle,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: statusFilter === s.value ? '#f1f5f9' : '#fff',
                      }}
                    >
                      <span
                        style={{
                          ...getStatusBadgeStyle(s.value),
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {s.label}
                      </span>
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={boxStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontWeight: 700 }}>Prehľad zákaziek</div>
                <input
                  style={{ ...inputStyle, maxWidth: 320 }}
                  placeholder="Hľadať zákazku alebo zákazníka"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

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
                      <tr
                        key={o.id}
                        style={{
                          ...getStatusRowStyle(o.stav),
                          borderBottom: '1px solid #e2e8f0',
                          verticalAlign: 'top',
                        }}
                      >
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ fontWeight: 700 }}>{o.nazov}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {o.popis || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px' }}>{getCustomerName(o.customer_id)}</td>
                        <td style={{ padding: '12px 10px' }}>{o.praca || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{o.termin || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <select
                            value={o.stav}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                            style={{
                              ...getStatusBadgeStyle(o.stav),
                              padding: '8px 10px',
                              borderRadius: 999,
                              fontWeight: 700,
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
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={buttonStyle} onClick={() => startEditOrder(o)}>
                              Upraviť
                            </button>
                            <button style={dangerButtonStyle} onClick={() => deleteOrder(o.id)}>
                              Zmazať
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'zakaznici' && (
          <div style={boxStyle}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Zoznam zákazníkov</div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 10px' }}>Názov</th>
                    <th style={{ padding: '12px 10px' }}>Kontakt</th>
                    <th style={{ padding: '12px 10px' }}>Telefón</th>
                    <th style={{ padding: '12px 10px' }}>Email</th>
                    <th style={{ padding: '12px 10px' }}>Akcie</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>{c.nazov}</td>
                      <td style={{ padding: '12px 10px' }}>{c.kontakt || '-'}</td>
                      <td style={{ padding: '12px 10px' }}>{c.telefon || '-'}</td>
                      <td style={{ padding: '12px 10px' }}>{c.email || '-'}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button style={buttonStyle} onClick={() => startEditCustomer(c)}>
                            Upraviť
                          </button>
                          <button style={dangerButtonStyle} onClick={() => deleteCustomer(c.id)}>
                            Zmazať
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal
          open={openAddCustomer}
          title="Pridať zákazníka"
          onClose={() => {
            setOpenAddCustomer(false)
            resetAddCustomerForm()
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="Názov firmy"
              value={nazov}
              onChange={(e) => setNazov(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Kontaktná osoba"
              value={kontakt}
              onChange={(e) => setKontakt(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Telefón"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={primaryButtonStyle} onClick={addCustomer}>
                Uložiť zákazníka
              </button>
              <button
                style={buttonStyle}
                onClick={() => {
                  setOpenAddCustomer(false)
                  resetAddCustomerForm()
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={openAddOrder}
          title="Pridať zákazku"
          onClose={() => {
            setOpenAddOrder(false)
            resetAddOrderForm()
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="Názov zákazky"
              value={orderNazov}
              onChange={(e) => setOrderNazov(e.target.value)}
            />

            <select
              style={inputStyle}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Vyber zákazníka</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nazov}
                </option>
              ))}
            </select>

            <input
              style={inputStyle}
              placeholder="Typ práce"
              value={orderPraca}
              onChange={(e) => setOrderPraca(e.target.value)}
            />

            <input
              style={inputStyle}
              type="date"
              value={orderTermin}
              onChange={(e) => setOrderTermin(e.target.value)}
            />

            <input
              style={{ ...inputStyle, gridColumn: '1 / -1' }}
              placeholder="Popis"
              value={orderPopis}
              onChange={(e) => setOrderPopis(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={primaryButtonStyle} onClick={addOrder}>
              Uložiť zákazku
            </button>
            <button
              style={buttonStyle}
              onClick={() => {
                setOpenAddOrder(false)
                resetAddOrderForm()
              }}
            >
              Zrušiť
            </button>
          </div>
        </Modal>

        <Modal
          open={openEditCustomer}
          title="Upraviť zákazníka"
          onClose={() => {
            setOpenEditCustomer(false)
            resetEditCustomerForm()
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              style={inputStyle}
              value={editCustomerNazov}
              onChange={(e) => setEditCustomerNazov(e.target.value)}
              placeholder="Názov firmy"
            />
            <input
              style={inputStyle}
              value={editCustomerKontakt}
              onChange={(e) => setEditCustomerKontakt(e.target.value)}
              placeholder="Kontaktná osoba"
            />
            <input
              style={inputStyle}
              value={editCustomerTelefon}
              onChange={(e) => setEditCustomerTelefon(e.target.value)}
              placeholder="Telefón"
            />
            <input
              style={inputStyle}
              value={editCustomerEmail}
              onChange={(e) => setEditCustomerEmail(e.target.value)}
              placeholder="Email"
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={primaryButtonStyle} onClick={saveCustomerEdit}>
                Uložiť zmeny
              </button>
              <button
                style={buttonStyle}
                onClick={() => {
                  setOpenEditCustomer(false)
                  resetEditCustomerForm()
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={openEditOrder}
          title="Upraviť zákazku"
          onClose={() => {
            setOpenEditOrder(false)
            resetEditOrderForm()
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="Názov zákazky"
              value={editOrderNazov}
              onChange={(e) => setEditOrderNazov(e.target.value)}
            />

            <select
              style={inputStyle}
              value={editOrderCustomerId}
              onChange={(e) => setEditOrderCustomerId(e.target.value)}
            >
              <option value="">Vyber zákazníka</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nazov}
                </option>
              ))}
            </select>

            <input
              style={inputStyle}
              placeholder="Typ práce"
              value={editOrderPraca}
              onChange={(e) => setEditOrderPraca(e.target.value)}
            />

            <input
              style={inputStyle}
              type="date"
              value={editOrderTermin}
              onChange={(e) => setEditOrderTermin(e.target.value)}
            />

            <input
              style={{ ...inputStyle, gridColumn: '1 / -1' }}
              placeholder="Popis"
              value={editOrderPopis}
              onChange={(e) => setEditOrderPopis(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={primaryButtonStyle} onClick={saveOrderEdit}>
              Uložiť zmeny
            </button>
            <button
              style={buttonStyle}
              onClick={() => {
                setOpenEditOrder(false)
                resetEditOrderForm()
              }}
            >
              Zrušiť
            </button>
          </div>
        </Modal>
      </div>
    </div>
  )
}