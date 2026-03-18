'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

const AKTIVNE_STATUSY = ['nova', 'rozpracovana', 'caka', 'hotova']
const PRACE = ['Montáž', 'Servis', 'Vlastné'] as const
type PracaType = (typeof PRACE)[number]

type Notice = {
  type: 'success' | 'error'
  text: string
} | null

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
    nova: { borderLeft: '6px solid #60a5fa' },
    rozpracovana: { borderLeft: '6px solid #fbbf24' },
    caka: { borderLeft: '6px solid #fb923c' },
    hotova: { borderLeft: '6px solid #22d3ee' },
    odovzdana: { borderLeft: '6px solid #34d399' },
    stornovana: { borderLeft: '6px solid #f87171' },
  }
  return map[stav] || {}
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

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
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavrieť okno"
            style={{
              border: '1px solid #cbd5e1',
              background: '#fff',
              width: 38,
              height: 38,
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              color: '#0f172a',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Page() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [savingEditCustomer, setSavingEditCustomer] = useState(false)
  const [savingEditOrder, setSavingEditOrder] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

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
    let mounted = true

    async function initAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.user) {
        router.replace('/login')
        return
      }

      setUserId(session.user.id)
      setCheckingAuth(false)
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session?.user) {
        router.replace('/login')
        return
      }

      setUserId(session.user.id)
      setCheckingAuth(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (userId) {
      void loadInitialData(userId)
    }
  }, [userId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

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
      setNotice({ type: 'error', text: error.message })
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
      setNotice({ type: 'error', text: error.message })
      return
    }

    setOrders((data || []) as Order[])
  }

  function closeAddCustomerModal() {
    resetAddCustomerForm()
    setOpenAddCustomer(false)
  }

  function closeAddOrderModal() {
    resetAddOrderForm()
    setOpenAddOrder(false)
  }

  function closeEditCustomerModal() {
    resetEditCustomerForm()
    setOpenEditCustomer(false)
  }

  function closeEditOrderModal() {
    resetEditOrderForm()
    setOpenEditOrder(false)
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
    if (!nazov.trim() || !userId) {
      setNotice({ type: 'error', text: 'Zadaj názov zákazníka.' })
      return
    }

    setSavingCustomer(true)

    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          user_id: userId,
          nazov: nazov.trim(),
          kontakt: kontakt.trim() || null,
          telefon: telefon.trim() || null,
          email: email.trim() || null,
        },
      ])
      .select()
      .single()

    setSavingCustomer(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    if (data) {
      setCustomers((curr) => [data as Customer, ...curr])
    }

    setNotice({ type: 'success', text: 'Zákazník bol vytvorený.' })
    closeAddCustomerModal()
  }

  async function addOrder() {
    if (!orderNazov.trim() || !userId) {
      setNotice({ type: 'error', text: 'Zadaj názov zákazky.' })
      return
    }

    let finalCustomerId = customerId
    let createdCustomerId: string | null = null

    if (customerMode === 'existing' && !customerId) {
      setNotice({ type: 'error', text: 'Vyber zákazníka.' })
      return
    }

    setSavingOrder(true)

    if (customerMode === 'new') {
      if (!newCustomerNazov.trim()) {
        setSavingOrder(false)
        setNotice({ type: 'error', text: 'Zadaj názov zákazníka alebo meno osoby.' })
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
        setSavingOrder(false)
        setNotice({ type: 'error', text: newCustomerError?.message || 'Nepodarilo sa vytvoriť zákazníka.' })
        return
      }

      finalCustomerId = newCustomer.id
      createdCustomerId = newCustomer.id
      setCustomers((curr) => [newCustomer as Customer, ...curr])
    }

    const finalPraca = orderPracaType === 'Vlastné' ? orderPracaCustom.trim() : orderPracaType

    if (!finalPraca) {
      setSavingOrder(false)
      setNotice({ type: 'error', text: 'Zadaj typ práce.' })
      return
    }

    const { data: insertedOrder, error } = await supabase
      .from('orders')
      .insert([
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
      .select()
      .single()

    if (error) {
      if (createdCustomerId) {
        await supabase.from('customers').delete().eq('id', createdCustomerId).eq('user_id', userId)
        setCustomers((curr) => curr.filter((c) => c.id !== createdCustomerId))
      }

      setSavingOrder(false)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setSavingOrder(false)
    if (insertedOrder) {
      setOrders((curr) => [insertedOrder as Order, ...curr])
    }

    setNotice({ type: 'success', text: 'Zákazka bola vytvorená.' })
    closeAddOrderModal()
  }

  async function updateOrderStatus(orderId: string, stav: string) {
    if (!userId) return

    const previousOrders = orders
    setOrders((curr) => curr.map((o) => (o.id === orderId ? { ...o, stav } : o)))

    const { error } = await supabase
      .from('orders')
      .update({ stav })
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) {
      setOrders(previousOrders)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Stav zákazky bol aktualizovaný.' })
  }

  async function deleteOrder(orderId: string) {
    if (!userId) return
    if (!window.confirm('Naozaj chceš zmazať túto zákazku?')) return

    const previousOrders = orders
    setOrders((curr) => curr.filter((o) => o.id !== orderId))

    const { error } = await supabase.from('orders').delete().eq('id', orderId).eq('user_id', userId)

    if (error) {
      setOrders(previousOrders)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Zákazka bola zmazaná.' })
  }

  async function deleteCustomer(customerIdToDelete: string) {
    if (!userId) return

    const hasOrders = orders.some((o) => o.customer_id === customerIdToDelete)
    if (hasOrders) {
      setNotice({
        type: 'error',
        text: 'Tento zákazník má naviazané zákazky. Najprv zmeň alebo zmaž zákazky.',
      })
      return
    }

    if (!window.confirm('Naozaj chceš zmazať tohto zákazníka?')) return

    const previousCustomers = customers
    setCustomers((curr) => curr.filter((c) => c.id !== customerIdToDelete))

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerIdToDelete)
      .eq('user_id', userId)

    if (error) {
      setCustomers(previousCustomers)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Zákazník bol zmazaný.' })
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
    if (!editCustomerId || !editCustomerNazov.trim() || !userId) {
      setNotice({ type: 'error', text: 'Zadaj názov zákazníka.' })
      return
    }

    setSavingEditCustomer(true)

    const payload = {
      nazov: editCustomerNazov.trim(),
      kontakt: editCustomerKontakt.trim() || null,
      telefon: editCustomerTelefon.trim() || null,
      email: editCustomerEmail.trim() || null,
    }

    const previousCustomers = customers
    setCustomers((curr) => curr.map((c) => (c.id === editCustomerId ? { ...c, ...payload } : c)))

    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', editCustomerId)
      .eq('user_id', userId)

    setSavingEditCustomer(false)

    if (error) {
      setCustomers(previousCustomers)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Zákazník bol upravený.' })
    closeEditCustomerModal()
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
    if (!editOrderId || !editOrderNazov.trim() || !editOrderCustomerId || !userId) {
      setNotice({ type: 'error', text: 'Vyplň povinné údaje zákazky.' })
      return
    }

    const finalPraca = editOrderPracaType === 'Vlastné' ? editOrderPracaCustom.trim() : editOrderPracaType
    if (!finalPraca) {
      setNotice({ type: 'error', text: 'Zadaj typ práce.' })
      return
    }

    setSavingEditOrder(true)

    const payload = {
      nazov: editOrderNazov.trim(),
      customer_id: editOrderCustomerId,
      praca: finalPraca,
      popis: editOrderPopis.trim() || null,
      termin: editOrderTermin || null,
    }

    const previousOrders = orders
    setOrders((curr) => curr.map((o) => (o.id === editOrderId ? { ...o, ...payload } : o)))

    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', editOrderId)
      .eq('user_id', userId)

    setSavingEditOrder(false)

    if (error) {
      setOrders(previousOrders)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Zákazka bola upravená.' })
    closeEditOrderModal()
  }

  async function logout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    setLoggingOut(false)
    router.replace('/login')
  }

  const customerMap = useMemo(() => {
    return Object.fromEntries(customers.map((c) => [c.id, c.nazov]))
  }, [customers])

  function getCustomerName(id: string) {
    return customerMap[id] || 'Neznámy zákazník'
  }

  const activeOrders = useMemo(() => {
    return orders.filter((o) => AKTIVNE_STATUSY.includes(o.stav))
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()

    const result = activeOrders.filter((o) => {
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
  }, [activeOrders, search, statusFilter, sortBy, customerMap])

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

  const labelStyle: CSSProperties = {
    fontSize: 13,
    color: '#475569',
    fontWeight: 700,
    marginBottom: 6,
    display: 'block',
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
    transition: 'all 0.2s ease',
  }

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #0f172a',
    minHeight: 48,
    padding: '12px 18px',
    fontSize: 15,
    fontWeight: 800,
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
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div className="headerWrap">
            <div>
              <div style={{ fontSize: 25, opacity: 0.8, marginBottom: 8, letterSpacing: 1 }}>ITspot s.r.o.</div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Evidencia zákaziek</h1>
              <div style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.82)' }}>
                Aktívne zákazky, zákazníci, stavy a termíny
              </div>
            </div>

            <div className="headerButtonsWrap">
              <button
                style={primaryButtonStyle}
                onClick={() => {
                  resetAddOrderForm()
                  setOpenAddOrder(true)
                }}
              >
                + Nová zákazka
              </button>

              <div className="secondaryActionsRow">
                <button
                  style={{
                    ...buttonStyle,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    minHeight: 44,
                  }}
                  onClick={() => {
                    resetAddCustomerForm()
                    setOpenAddCustomer(true)
                  }}
                >
                  Nový zákazník
                </button>

                <Link
                  href="/fakturovane"
                  style={{
                    ...buttonStyle,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    minHeight: 44,
                  }}
                >
                  Fakturované / Stornované
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 18,
          }}
        >
          <button
            style={{
              ...buttonStyle,
              background: '#fff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              minHeight: 44,
            }}
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Odhlasujem...' : 'Odhlásiť'}
          </button>
        </div>

        {notice && (
          <div
            style={{
              ...boxStyle,
              marginBottom: 18,
              padding: '14px 16px',
              border:
                notice.type === 'success' ? '1px solid #86efac' : '1px solid #fecaca',
              background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: notice.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{notice.text}</div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: 'inherit',
                }}
                aria-label="Zavrieť správu"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="summaryGrid" style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
          {summaryCard('Aktívne zákazky', activeOrders.length, {
            background: '#e2e8f0',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
          })}
          {summaryCard('Nové', activeOrders.filter((o) => o.stav === 'nova').length, getStatusBadgeStyle('nova'))}
          {summaryCard(
            'Rozpracované',
            activeOrders.filter((o) => o.stav === 'rozpracovana').length,
            getStatusBadgeStyle('rozpracovana'),
          )}
          {summaryCard('Čakajú', activeOrders.filter((o) => o.stav === 'caka').length, getStatusBadgeStyle('caka'))}
          {summaryCard('Dokončené', activeOrders.filter((o) => o.stav === 'hotova').length, getStatusBadgeStyle('hotova'))}
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
              <div className="filtersGrid">
                <div>
                  <label style={labelStyle} htmlFor="search-orders">
                    Hľadať
                  </label>
                  <input
                    id="search-orders"
                    style={inputStyle}
                    placeholder="Hľadať zákazku, popis, prácu alebo zákazníka"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="status-filter">
                    Filter
                  </label>
                  <select id="status-filter" style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="vsetky">Všetky stavy</option>
                    {STATUSY.filter((s) => AKTIVNE_STATUSY.includes(s.value)).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle} htmlFor="sort-by">
                    Radenie
                  </label>
                  <select id="sort-by" style={inputStyle} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
                <div style={{ fontWeight: 800, fontSize: 18 }}>Aktívne zákazky</div>
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

              <div className="mobileCards">
                {filteredOrders.length === 0 && (
                  <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                    Žiadne zákazky na zobrazenie
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
                      <label style={labelStyle}>Stav</label>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                      <button style={buttonStyle} onClick={() => startEditOrder(o)}>
                        Upraviť
                      </button>
                      <button style={dangerButtonStyle} onClick={() => deleteOrder(o.id)}>
                        Zmazať
                      </button>
                    </div>
                  </div>
                ))}
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

            <div className="desktopTable">
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

            <div className="mobileCards">
              {customers.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                  Zatiaľ nemáš žiadnych zákazníkov
                </div>
              )}

              {customers.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 18,
                    padding: 14,
                    marginBottom: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{c.nazov}</div>

                  <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    <div><strong>Kontakt:</strong> {c.kontakt || '-'}</div>
                    <div><strong>Telefón:</strong> {c.telefon || '-'}</div>
                    <div><strong>Email:</strong> {c.email || '-'}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    <button style={buttonStyle} onClick={() => startEditCustomer(c)}>
                      Upraviť
                    </button>
                    <button style={dangerButtonStyle} onClick={() => deleteCustomer(c.id)}>
                      Zmazať
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Modal open={openAddCustomer} title="Pridať zákazníka" onClose={closeAddCustomerModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addCustomer()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="add-customer-name">
                  Názov firmy alebo meno
                </label>
                <input
                  id="add-customer-name"
                  style={inputStyle}
                  placeholder="Názov firmy alebo meno"
                  value={nazov}
                  onChange={(e) => setNazov(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="add-customer-contact">
                  Kontaktná osoba
                </label>
                <input
                  id="add-customer-contact"
                  style={inputStyle}
                  placeholder="Kontaktná osoba"
                  value={kontakt}
                  onChange={(e) => setKontakt(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="add-customer-phone">
                  Telefón
                </label>
                <input
                  id="add-customer-phone"
                  type="tel"
                  style={inputStyle}
                  placeholder="Telefón"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="add-customer-email">
                  Email
                </label>
                <input
                  id="add-customer-email"
                  type="email"
                  style={inputStyle}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingCustomer}>
                  {savingCustomer ? 'Ukladám...' : 'Uložiť zákazníka'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeAddCustomerModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal open={openAddOrder} title="Pridať zákazku" onClose={closeAddOrderModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addOrder()
            }}
          >
            <div className="modalGrid">
              <div>
                <label style={labelStyle} htmlFor="add-order-name">
                  Názov zákazky
                </label>
                <input
                  id="add-order-name"
                  style={inputStyle}
                  placeholder="Názov zákazky"
                  value={orderNazov}
                  onChange={(e) => setOrderNazov(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="customer-mode">
                  Zákazník
                </label>
                <select
                  id="customer-mode"
                  style={inputStyle}
                  value={customerMode}
                  onChange={(e) => setCustomerMode(e.target.value as 'existing' | 'new')}
                >
                  <option value="existing">Vybrať existujúceho zákazníka</option>
                  <option value="new">Vytvoriť nového zákazníka</option>
                </select>
              </div>

              {customerMode === 'existing' ? (
                <div>
                  <label style={labelStyle} htmlFor="existing-customer">
                    Existujúci zákazník
                  </label>
                  <select id="existing-customer" style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Vyber zákazníka</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nazov}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={labelStyle} htmlFor="new-customer-name">
                    Názov firmy alebo meno osoby
                  </label>
                  <input
                    id="new-customer-name"
                    style={inputStyle}
                    placeholder="Názov firmy alebo meno osoby"
                    value={newCustomerNazov}
                    onChange={(e) => setNewCustomerNazov(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle} htmlFor="order-work-type">
                  Typ práce
                </label>
                <select
                  id="order-work-type"
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
                  <div>
                    <label style={labelStyle} htmlFor="new-customer-contact">
                      Kontaktná osoba
                    </label>
                    <input
                      id="new-customer-contact"
                      style={inputStyle}
                      placeholder="Kontaktná osoba"
                      value={newCustomerKontakt}
                      onChange={(e) => setNewCustomerKontakt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="new-customer-phone">
                      Telefón
                    </label>
                    <input
                      id="new-customer-phone"
                      type="tel"
                      style={inputStyle}
                      placeholder="Telefón"
                      value={newCustomerTelefon}
                      onChange={(e) => setNewCustomerTelefon(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="new-customer-email">
                      Email
                    </label>
                    <input
                      id="new-customer-email"
                      type="email"
                      style={inputStyle}
                      placeholder="Email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                    />
                  </div>
                </>
              )}

              {orderPracaType === 'Vlastné' && (
                <div>
                  <label style={labelStyle} htmlFor="order-custom-work">
                    Vlastný typ práce
                  </label>
                  <input
                    id="order-custom-work"
                    style={inputStyle}
                    placeholder="Zadaj vlastný typ práce"
                    value={orderPracaCustom}
                    onChange={(e) => setOrderPracaCustom(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle} htmlFor="order-date">
                  Termín
                </label>
                <input
                  id="order-date"
                  style={inputStyle}
                  type="date"
                  value={orderTermin}
                  onChange={(e) => setOrderTermin(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="order-description">
                  Popis
                </label>
                <input
                  id="order-description"
                  style={inputStyle}
                  placeholder="Popis"
                  value={orderPopis}
                  onChange={(e) => setOrderPopis(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="submit" style={primaryButtonStyle} disabled={savingOrder}>
                {savingOrder ? 'Ukladám...' : 'Uložiť zákazku'}
              </button>
              <button type="button" style={secondaryDarkButtonStyle} onClick={closeAddOrderModal}>
                Zrušiť
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={openEditCustomer} title="Upraviť zákazníka" onClose={closeEditCustomerModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveCustomerEdit()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-name">
                  Názov firmy
                </label>
                <input
                  id="edit-customer-name"
                  style={inputStyle}
                  value={editCustomerNazov}
                  onChange={(e) => setEditCustomerNazov(e.target.value)}
                  placeholder="Názov firmy"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-contact">
                  Kontaktná osoba
                </label>
                <input
                  id="edit-customer-contact"
                  style={inputStyle}
                  value={editCustomerKontakt}
                  onChange={(e) => setEditCustomerKontakt(e.target.value)}
                  placeholder="Kontaktná osoba"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-phone">
                  Telefón
                </label>
                <input
                  id="edit-customer-phone"
                  type="tel"
                  style={inputStyle}
                  value={editCustomerTelefon}
                  onChange={(e) => setEditCustomerTelefon(e.target.value)}
                  placeholder="Telefón"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-email">
                  Email
                </label>
                <input
                  id="edit-customer-email"
                  type="email"
                  style={inputStyle}
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingEditCustomer}>
                  {savingEditCustomer ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeEditCustomerModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal open={openEditOrder} title="Upraviť zákazku" onClose={closeEditOrderModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveOrderEdit()
            }}
          >
            <div className="modalGrid">
              <div>
                <label style={labelStyle} htmlFor="edit-order-name">
                  Názov zákazky
                </label>
                <input
                  id="edit-order-name"
                  style={inputStyle}
                  placeholder="Názov zákazky"
                  value={editOrderNazov}
                  onChange={(e) => setEditOrderNazov(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-order-customer">
                  Zákazník
                </label>
                <select
                  id="edit-order-customer"
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
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-order-work-type">
                  Typ práce
                </label>
                <select
                  id="edit-order-work-type"
                  style={inputStyle}
                  value={editOrderPracaType}
                  onChange={(e) => setEditOrderPracaType(e.target.value as PracaType)}
                >
                  <option value="Montáž">Montáž</option>
                  <option value="Servis">Servis</option>
                  <option value="Vlastné">Vlastné</option>
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-order-date">
                  Termín
                </label>
                <input
                  id="edit-order-date"
                  style={inputStyle}
                  type="date"
                  value={editOrderTermin}
                  onChange={(e) => setEditOrderTermin(e.target.value)}
                />
              </div>

              {editOrderPracaType === 'Vlastné' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle} htmlFor="edit-order-custom-work">
                    Vlastný typ práce
                  </label>
                  <input
                    id="edit-order-custom-work"
                    style={inputStyle}
                    placeholder="Zadaj vlastný typ práce"
                    value={editOrderPracaCustom}
                    onChange={(e) => setEditOrderPracaCustom(e.target.value)}
                  />
                </div>
              )}

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="edit-order-description">
                  Popis
                </label>
                <input
                  id="edit-order-description"
                  style={inputStyle}
                  placeholder="Popis"
                  value={editOrderPopis}
                  onChange={(e) => setEditOrderPopis(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="submit" style={primaryButtonStyle} disabled={savingEditOrder}>
                {savingEditOrder ? 'Ukladám...' : 'Uložiť zmeny'}
              </button>
              <button type="button" style={secondaryDarkButtonStyle} onClick={closeEditOrderModal}>
                Zrušiť
              </button>
            </div>
          </form>
        </Modal>

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

        .headerButtonsWrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
        }

        .secondaryActionsRow {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .summaryGrid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .filtersGrid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
        }

        .modalGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .mobileCards {
          display: none;
        }

        .desktopTable {
          display: block;
        }

        @media (max-width: 1024px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .filtersGrid,
          .modalGrid,
          .summaryGrid {
            grid-template-columns: 1fr;
          }

          .desktopTable {
            display: none;
          }

          .mobileCards {
            display: block;
          }

          .headerButtonsWrap,
          .secondaryActionsRow {
            width: 100%;
            align-items: stretch;
            justify-content: stretch;
          }

          .secondaryActionsRow {
            flex-direction: column;
          }

          .secondaryActionsRow :global(a),
          .secondaryActionsRow button,
          .headerButtonsWrap > button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
