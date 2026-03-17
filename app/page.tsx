'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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

const PRACE = ['Montáž', 'Servis', 'Vlastné'] as const
type PracaType = (typeof PRACE)[number]

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function getStatusRowStyle(stav: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
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
  children,
}: {
  open: boolean
  title: string
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div
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
          maxWidth: 780,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          padding: 22,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [activeTab, setActiveTab] = useState<'zakazky' | 'zakaznici'>('zakazky')

  const [nazov, setNazov] = useState('')
  const [kontakt, setKontakt] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')

  const [orderNazov, setOrderNazov] = useState('')
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [newCustomerNazov, setNewCustomerNazov] = useState('')
  const [newCustomerKontakt, setNewCustomerKontakt] = useState('')
  const [newCustomerTelefon, setNewCustomerTelefon] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [orderPracaType, setOrderPracaType] = useState<PracaType>('Servis')
  const [orderPracaCustom, setOrderPracaCustom] = useState('')
  const [orderPopis, setOrderPopis] = useState('')
  const [orderTermin, setOrderTermin] = useState(getTodayDate())

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('vsetky')
  const [sortBy, setSortBy] = useState('newest')

  const [editCustomerId, setEditCustomerId] = useState('')
  const [editCustomerNazov, setEditCustomerNazov] = useState('')
  const [editCustomerKontakt, setEditCustomerKontakt] = useState('')
  const [editCustomerTelefon, setEditCustomerTelefon] = useState('')
  const [editCustomerEmail, setEditCustomerEmail] = useState('')

  const [editOrderId, setEditOrderId] = useState('')
  const [editOrderNazov, setEditOrderNazov] = useState('')
  const [editOrderCustomerId, setEditOrderCustomerId] = useState('')
  const [editOrderPracaType, setEditOrderPracaType] = useState<PracaType>('Servis')
  const [editOrderPracaCustom, setEditOrderPracaCustom] = useState('')
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

  function resetAddCustomerForm() {
    setNazov('')
    setKontakt('')
    setTelefon('')
    setEmail('')
  }

  function resetAddOrderForm() {
    setOrderNazov('')
    setCustomerMode('existing')
    setCustomerId('')
    setNewCustomerNazov('')
    setNewCustomerKontakt('')
    setNewCustomerTelefon('')
    setNewCustomerEmail('')
    setOrderPracaType('Servis')
    setOrderPracaCustom('')
    setOrderPopis('')
    setOrderTermin(getTodayDate())
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
    setEditOrderPracaType('Servis')
    setEditOrderPracaCustom('')
    setEditOrderPopis('')
    setEditOrderTermin('')
  }

  async function addCustomer() {
    if (!nazov.trim() || !userId) return

    const { error } = await supabase.from('customers').insert([
      {
        user_id: userId,
        nazov: nazov.trim(),
        kontakt: kontakt.trim() || null,
        telefon: telefon.trim() || null,
        email: email.trim() || null,
      },
    ])

    if (error) {
      alert(error.message)
      return
    }

    resetAddCustomerForm()
    setOpenAddCustomer(false)
    loadCustomers(userId)
  }

  async function addOrder() {
    if (!orderNazov.trim() || !userId) return

    let finalCustomerId = customerId

    if (customerMode === 'existing') {
      if (!customerId) {
        alert('Vyber zákazníka.')
        return
      }
    }

    if (customerMode === 'new') {
      if (!newCustomerNazov.trim()) {
        alert('Zadaj názov zákazníka alebo meno osoby.')
        return
      }

      const { data: newCustomer, error: newCustomerError } = await supabase
        .from('customers')
        .insert([
          {
            user_id: userId,
            nazov: newCustomerNazov.trim(),
            kontakt: newCustomerKontakt.trim() || null,
            telefon: newCustomerTelefon.trim() || null,
            email: newCustomerEmail.trim() || null,
          },
        ])
        .select()
        .single()

      if (newCustomerError || !newCustomer) {
        alert(newCustomerError?.message || 'Nepodarilo sa vytvoriť zákazníka.')
        return
      }

      finalCustomerId = newCustomer.id
      await loadCustomers(userId)
    }

    const finalPraca = orderPracaType === 'Vlastné' ? orderPracaCustom.trim() : orderPracaType

    if (!finalPraca) {
      alert('Zadaj typ práce.')
      return
    }

    const { error } = await supabase.from('orders').insert([
      {
        user_id: userId,
        nazov: orderNazov.trim(),
        customer_id: finalCustomerId,
        stav: 'nova',
        praca: finalPraca,
        popis: orderPopis.trim() || null,
        termin: orderTermin || null,
        hodiny: 0,
      },
    ])

    if (error) {
      alert(error.message)
      return
    }

    resetAddOrderForm()
    setOpenAddOrder(false)
    loadOrders(userId)
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

    const { error } = await supabase.from('orders').delete().eq('id', orderId).eq('user_id', userId)

    if (error) {
      alert(error.message)
      return
    }

    loadOrders(userId)
  }

  async function deleteCustomer(customerIdToDelete: string) {
    if (!userId) return

    const hasOrders = orders.some((o) => o.customer_id === customerIdToDelete)

    if (hasOrders) {
      alert('Tento zákazník má naviazané zákazky. Najprv zmeň alebo zmaž zákazky.')
      return
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerIdToDelete)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
      return
    }

    loadCustomers(userId)
  }

  function startEditCustomer(c: Customer) {
    setEditCustomerId(c.id)
    setEditCustomerNazov(c.nazov || '')
    setEditCustomerKontakt(c.kontakt || '')
    setEditCustomerTelefon(c.telefon || '')
    setEditCustomerEmail(c.email || '')
    setOpenEditCustomer(true)
  }

  async function saveCustomerEdit() {
    if (!editCustomerId || !editCustomerNazov.trim() || !userId) return

    const { error } = await supabase
      .from('customers')
      .update({
        nazov: editCustomerNazov.trim(),
        kontakt: editCustomerKontakt.trim() || null,
        telefon: editCustomerTelefon.trim() || null,
        email: editCustomerEmail.trim() || null,
      })
      .eq('id', editCustomerId)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
      return
    }

    resetEditCustomerForm()
    setOpenEditCustomer(false)
    loadCustomers(userId)
  }

  function startEditOrder(o: Order) {
    setEditOrderId(o.id)
    setEditOrderNazov(o.nazov || '')
    setEditOrderCustomerId(o.customer_id || '')

    if (o.praca === 'Montáž' || o.praca === 'Servis') {
      setEditOrderPracaType(o.praca)
      setEditOrderPracaCustom('')
    } else {
      setEditOrderPracaType('Vlastné')
      setEditOrderPracaCustom(o.praca || '')
    }

    setEditOrderPopis(o.popis || '')
    setEditOrderTermin(o.termin || '')
    setOpenEditOrder(true)
  }

  async function saveOrderEdit() {
    if (!editOrderId || !editOrderNazov.trim() || !editOrderCustomerId || !userId) return

    const finalPraca =
      editOrderPracaType === 'Vlastné' ? editOrderPracaCustom.trim() : editOrderPracaType

    if (!finalPraca) {
      alert('Zadaj typ práce.')
      return
    }

    const { error } = await supabase
      .from('orders')
      .update({
        nazov: editOrderNazov.trim(),
        customer_id: editOrderCustomerId,
        praca: finalPraca,
        popis: editOrderPopis.trim() || null,
        termin: editOrderTermin || null,
      })
      .eq('id', editOrderId)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
      return
    }

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

    const result = orders.filter((o) => {
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
  }, [orders, search, statusFilter, sortBy, customers])

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
  }

  const buttonStyle: CSSProperties = {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  }

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #0f172a',
  }

  const dangerButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#be123c',
  }

  const secondaryDarkButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: '#e2e8f0',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
  }

  const tabButton = (active: boolean): CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 12,
    border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#0f172a',
    cursor: 'pointer',
    fontWeight: 700,
  })

  const summaryCard = (label: string, value: number, color: CSSProperties): ReactNode => (
    <div
      style={{
        ...boxStyle,
        minWidth: 160,
        padding: 16,
        flex: 1,
      }}
    >
      <div
        style={{
          ...color,
          display: 'inline-flex',
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  )

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)',
        padding: 24,
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
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 18,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 25, opacity: 0.8, marginBottom: 8, letterSpacing: 1 }}>
                ITspot s.r.o.
              </div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Evidencia zákaziek</h1>
              <div style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.82)' }}>
                Zákazky, zákazníci, stavy a termíny na jednom mieste
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
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
                <div style={{ fontSize: 14, fontWeight: 700 }}>{userEmail || 'Používateľ'}</div>
              </div>

              <button
                style={{ ...primaryButtonStyle, background: '#fff', color: '#0f172a', borderColor: '#fff' }}
                onClick={() => {
                  resetAddOrderForm()
                  setOpenAddOrder(true)
                }}
              >
                Nová zákazka
              </button>

              <button
                style={{
                  ...buttonStyle,
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
                onClick={() => {
                  resetAddCustomerForm()
                  setOpenAddCustomer(true)
                }}
              >
                Nový zákazník
              </button>

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

        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {summaryCard('Všetky zákazky', orders.length, {
            background: '#e2e8f0',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
          })}
          {summaryCard('Nové', orders.filter((o) => o.stav === 'nova').length, getStatusBadgeStyle('nova'))}
          {summaryCard(
            'Rozpracované',
            orders.filter((o) => o.stav === 'rozpracovana').length,
            getStatusBadgeStyle('rozpracovana'),
          )}
          {summaryCard('Čakajú', orders.filter((o) => o.stav === 'caka').length, getStatusBadgeStyle('caka'))}
          {summaryCard('Dokončené', orders.filter((o) => o.stav === 'hotova').length, getStatusBadgeStyle('hotova'))}
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: 12,
                }}
              >
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
                    {STATUSY.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
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
                <div style={{ fontWeight: 800, fontSize: 18 }}>Prehľad zákaziek</div>
                <div style={{ color: '#475569', fontWeight: 700 }}>Zobrazené: {filteredOrders.length}</div>
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
                          <div style={{ fontWeight: 800 }}>{o.nazov}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{o.popis || '-'}</div>
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

                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                          Žiadne zákazky na zobrazenie
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'zakaznici' && (
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
              <div style={{ fontWeight: 800, fontSize: 18 }}>Zoznam zákazníkov</div>
              <div style={{ color: '#475569', fontWeight: 700 }}>Spolu: {customers.length}</div>
            </div>

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
                      <td style={{ padding: '12px 10px', fontWeight: 800 }}>{c.nazov}</td>
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

                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                        Zatiaľ nemáš žiadnych zákazníkov
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal open={openAddCustomer} title="Pridať zákazníka">
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="Názov firmy alebo meno"
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
                style={secondaryDarkButtonStyle}
                onClick={() => {
                  resetAddCustomerForm()
                  setOpenAddCustomer(false)
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={openAddOrder} title="Pridať zákazku">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="Názov zákazky"
              value={orderNazov}
              onChange={(e) => setOrderNazov(e.target.value)}
            />

            <div style={{ display: 'grid', gap: 8 }}>
              <select
                style={inputStyle}
                value={customerMode}
                onChange={(e) => setCustomerMode(e.target.value as 'existing' | 'new')}
              >
                <option value="existing">Vybrať existujúceho zákazníka</option>
                <option value="new">Vytvoriť nového zákazníka</option>
              </select>
            </div>

            {customerMode === 'existing' ? (
              <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Vyber zákazníka</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nazov}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={inputStyle}
                placeholder="Názov firmy alebo meno osoby"
                value={newCustomerNazov}
                onChange={(e) => setNewCustomerNazov(e.target.value)}
              />
            )}

            <div style={{ display: 'grid', gap: 8 }}>
              <select
                style={inputStyle}
                value={orderPracaType}
                onChange={(e) => setOrderPracaType(e.target.value as PracaType)}
              >
                <option value="Montáž">Montáž</option>
                <option value="Servis">Servis</option>
                <option value="Vlastné">Vlastné</option>
              </select>
            </div>

            {customerMode === 'new' && (
              <>
                <input
                  style={inputStyle}
                  placeholder="Kontaktná osoba"
                  value={newCustomerKontakt}
                  onChange={(e) => setNewCustomerKontakt(e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Telefón"
                  value={newCustomerTelefon}
                  onChange={(e) => setNewCustomerTelefon(e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                />
              </>
            )}

            {orderPracaType === 'Vlastné' && (
              <input
                style={inputStyle}
                placeholder="Zadaj vlastný typ práce"
                value={orderPracaCustom}
                onChange={(e) => setOrderPracaCustom(e.target.value)}
              />
            )}

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

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button style={primaryButtonStyle} onClick={addOrder}>
              Uložiť zákazku
            </button>
            <button
              style={secondaryDarkButtonStyle}
              onClick={() => {
                resetAddOrderForm()
                setOpenAddOrder(false)
              }}
            >
              Zrušiť
            </button>
          </div>
        </Modal>

        <Modal open={openEditCustomer} title="Upraviť zákazníka">
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
                style={secondaryDarkButtonStyle}
                onClick={() => {
                  resetEditCustomerForm()
                  setOpenEditCustomer(false)
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={openEditOrder} title="Upraviť zákazku">
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

            <select
              style={inputStyle}
              value={editOrderPracaType}
              onChange={(e) => setEditOrderPracaType(e.target.value as PracaType)}
            >
              <option value="Montáž">Montáž</option>
              <option value="Servis">Servis</option>
              <option value="Vlastné">Vlastné</option>
            </select>

            <input
              style={inputStyle}
              type="date"
              value={editOrderTermin}
              onChange={(e) => setEditOrderTermin(e.target.value)}
            />

            {editOrderPracaType === 'Vlastné' && (
              <input
                style={{ ...inputStyle, gridColumn: '1 / -1' }}
                placeholder="Zadaj vlastný typ práce"
                value={editOrderPracaCustom}
                onChange={(e) => setEditOrderPracaCustom(e.target.value)}
              />
            )}

            <input
              style={{ ...inputStyle, gridColumn: '1 / -1' }}
              placeholder="Popis"
              value={editOrderPopis}
              onChange={(e) => setEditOrderPopis(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button style={primaryButtonStyle} onClick={saveOrderEdit}>
              Uložiť zmeny
            </button>
            <button
              style={secondaryDarkButtonStyle}
              onClick={() => {
                resetEditOrderForm()
                setOpenEditOrder(false)
              }}
            >
              Zrušiť
            </button>
          </div>
        </Modal>

        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 18 }}>
            Načítavam dáta...
          </div>
        )}
      </div>
    </div>
  )
}