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
  prijatie_zakazky: string | null
  hodiny?: number | null
  created_at?: string
}

type Employee = {
  id: string
  user_id: string
  name: string
  telefon: string | null
  email: string | null
  active?: boolean | null
  can_delete?: boolean
  created_at?: string
}

type WorkLog = {
  id: string
  user_id: string
  order_id: string
  datum: string
  praca_popis: string
  hodiny: number
  zamestnanci: string[] | null
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

type Notice =
  | {
      type: 'success' | 'error'
      text: string
    }
  | null

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const dateOnly = date.slice(0, 10)
  const parts = dateOnly.split('-')
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

function escapeCsvValue(value: string | number | null | undefined) {
  const safe = String(value ?? '')
  if (safe.includes('"') || safe.includes(';') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function parseHoursInput(value: string) {
  const normalized = value.replace(',', '.').trim()
  const num = Number(normalized)
  if (!Number.isFinite(num)) return NaN
  return num
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
        background: 'rgba(15, 23, 42, 0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
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
  const [savingEmployee, setSavingEmployee] = useState(false)
  const [savingEditEmployee, setSavingEditEmployee] = useState(false)
  const [savingWorkLog, setSavingWorkLog] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [notice, setNotice] = useState<Notice>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])

  const [activeTab, setActiveTab] = useState<'zakazky' | 'zakaznici' | 'zamestnanci'>('zakazky')
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([])
  const [pinnedOrderIds, setPinnedOrderIds] = useState<string[]>([])

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
  const [orderPopis, setOrderPopis] = useState('')
  const [orderTermin, setOrderTermin] = useState(getTodayDate())
  const [orderPrijatieZakazky, setOrderPrijatieZakazky] = useState(getTodayDate())

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
  const [editOrderPopis, setEditOrderPopis] = useState('')
  const [editOrderTermin, setEditOrderTermin] = useState('')
  const [editOrderPrijatieZakazky, setEditOrderPrijatieZakazky] = useState('')

  const [employeeName, setEmployeeName] = useState('')
  const [employeeTelefon, setEmployeeTelefon] = useState('')
  const [employeeEmail, setEmployeeEmail] = useState('')
  const [employeeCanDelete, setEmployeeCanDelete] = useState(true)

  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editEmployeeName, setEditEmployeeName] = useState('')
  const [editEmployeeTelefon, setEditEmployeeTelefon] = useState('')
  const [editEmployeeEmail, setEditEmployeeEmail] = useState('')
  const [editEmployeeCanDelete, setEditEmployeeCanDelete] = useState(true)

  const [activeWorkLogOrderId, setActiveWorkLogOrderId] = useState('')
  const [editingWorkLogId, setEditingWorkLogId] = useState('')
  const [workLogDate, setWorkLogDate] = useState(getTodayDate())
  const [workLogText, setWorkLogText] = useState('')
  const [workLogHours, setWorkLogHours] = useState('')
  const [workLogEmployees, setWorkLogEmployees] = useState<string[]>([])

  const [openAddCustomer, setOpenAddCustomer] = useState(false)
  const [openAddOrder, setOpenAddOrder] = useState(false)
  const [openEditCustomer, setOpenEditCustomer] = useState(false)
  const [openEditOrder, setOpenEditOrder] = useState(false)
  const [openAddEmployee, setOpenAddEmployee] = useState(false)
  const [openEditEmployee, setOpenEditEmployee] = useState(false)
  const [openWorkLog, setOpenWorkLog] = useState(false)

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

    void initAuth()

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
    if (!userId) return
    void loadInitialData(userId)
  }, [userId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storedPins = window.localStorage.getItem('orders-pinned-v1')
      if (storedPins) {
        const parsed = JSON.parse(storedPins)
        if (Array.isArray(parsed)) {
          setPinnedOrderIds(parsed.filter((item): item is string => typeof item === 'string'))
        }
      }
    } catch {
      // ignore localStorage read errors
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('orders-pinned-v1', JSON.stringify(pinnedOrderIds))
  }, [pinnedOrderIds])

  async function loadInitialData(currentUserId: string) {
    setLoading(true)
    try {
      await Promise.all([
        loadCustomers(currentUserId),
        loadOrders(currentUserId),
        loadEmployees(currentUserId),
        loadWorkLogs(currentUserId),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadCustomers(currentUserId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) {
      setNotice({ type: 'error', text: `Customers: ${error.message}` })
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
      setNotice({ type: 'error', text: `Orders: ${error.message}` })
      return
    }

    setOrders((data || []) as Order[])
  }

  async function loadEmployees(currentUserId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) {
      setNotice({ type: 'error', text: `Employees: ${error.message}` })
      return
    }

    setEmployees((data || []) as Employee[])
  }

  async function loadWorkLogs(currentUserId: string) {
    const { data, error } = await supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', currentUserId)
      .order('datum', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      setNotice({ type: 'error', text: `Work logs: ${error.message}` })
      return
    }

    setWorkLogs((data || []) as WorkLog[])
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
    setOrderPopis('')
    setOrderTermin(getTodayDate())
    setOrderPrijatieZakazky(getTodayDate())
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
    setEditOrderPopis('')
    setEditOrderTermin('')
    setEditOrderPrijatieZakazky('')
  }

  function resetEmployeeForm() {
    setEmployeeName('')
    setEmployeeTelefon('')
    setEmployeeEmail('')
    setEmployeeCanDelete(true)
  }

  function resetEditEmployeeForm() {
    setEditEmployeeId('')
    setEditEmployeeName('')
    setEditEmployeeTelefon('')
    setEditEmployeeEmail('')
    setEditEmployeeCanDelete(true)
  }

  function resetWorkLogForm() {
    setEditingWorkLogId('')
    setWorkLogDate(getTodayDate())
    setWorkLogText('')
    setWorkLogHours('')
    setWorkLogEmployees([])
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

  function closeAddEmployeeModal() {
    resetEmployeeForm()
    setOpenAddEmployee(false)
  }

  function closeEditEmployeeModal() {
    resetEditEmployeeForm()
    setOpenEditEmployee(false)
  }

  function closeWorkLogModal() {
    setActiveWorkLogOrderId('')
    resetWorkLogForm()
    setOpenWorkLog(false)
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
        setNotice({
          type: 'error',
          text: newCustomerError?.message || 'Nepodarilo sa vytvoriť zákazníka.',
        })
        return
      }

      finalCustomerId = newCustomer.id
      createdCustomerId = newCustomer.id
      setCustomers((curr) => [newCustomer as Customer, ...curr])
    }

    const { data: insertedOrder, error } = await supabase
      .from('orders')
      .insert([
        {
          user_id: userId,
          nazov: orderNazov.trim(),
          customer_id: finalCustomerId,
          stav: 'nova',
          praca: null,
          popis: orderPopis.trim() || null,
          termin: orderTermin || null,
          prijatie_zakazky: orderPrijatieZakazky || null,
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

    const previous = orders
    setOrders((curr) => curr.map((o) => (o.id === orderId ? { ...o, stav } : o)))

    const { error } = await supabase
      .from('orders')
      .update({ stav })
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) {
      setOrders(previous)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Stav zákazky bol aktualizovaný.' })
  }

  async function deleteOrder(orderId: string) {
    if (!userId) return
    if (!window.confirm('Naozaj chceš zmazať túto zákazku?')) return

    const relatedLogs = workLogs.filter((w) => w.order_id === orderId)
    if (relatedLogs.length > 0) {
      const { error: logError } = await supabase
        .from('work_logs')
        .delete()
        .eq('order_id', orderId)
        .eq('user_id', userId)

      if (logError) {
        setNotice({ type: 'error', text: logError.message })
        return
      }

      setWorkLogs((curr) => curr.filter((w) => w.order_id !== orderId))
    }

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
    setEditOrderPopis(o.popis || '')
    setEditOrderTermin(o.termin || '')
    setEditOrderPrijatieZakazky(o.prijatie_zakazky || '')
    setOpenEditOrder(true)
  }

  async function saveOrderEdit() {
    if (!editOrderId || !editOrderNazov.trim() || !editOrderCustomerId || !userId) {
      setNotice({ type: 'error', text: 'Vyplň povinné údaje zákazky.' })
      return
    }

    setSavingEditOrder(true)

    const payload = {
      nazov: editOrderNazov.trim(),
      customer_id: editOrderCustomerId,
      popis: editOrderPopis.trim() || null,
      termin: editOrderTermin || null,
      prijatie_zakazky: editOrderPrijatieZakazky || null,
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

  async function addEmployee() {
    if (!employeeName.trim() || !userId) {
      setNotice({ type: 'error', text: 'Zadaj meno zamestnanca.' })
      return
    }

    setSavingEmployee(true)

    const { data, error } = await supabase
      .from('employees')
      .insert([
        {
          user_id: userId,
          name: employeeName.trim(),
          telefon: employeeTelefon.trim() || null,
          email: employeeEmail.trim() || null,
          active: true,
          can_delete: employeeCanDelete,
        },
      ])
      .select()
      .single()

    setSavingEmployee(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    if (data) {
      setEmployees((curr) => [data as Employee, ...curr])
    }

    setNotice({ type: 'success', text: 'Zamestnanec bol pridaný.' })
    closeAddEmployeeModal()
  }

  function startEditEmployee(emp: Employee) {
    setEditEmployeeId(emp.id)
    setEditEmployeeName(emp.name || '')
    setEditEmployeeTelefon(emp.telefon || '')
    setEditEmployeeEmail(emp.email || '')
    setEditEmployeeCanDelete(emp.can_delete ?? true)
    setOpenEditEmployee(true)
  }

  async function saveEmployeeEdit() {
    if (!editEmployeeId || !editEmployeeName.trim() || !userId) {
      setNotice({ type: 'error', text: 'Zadaj meno zamestnanca.' })
      return
    }

    setSavingEditEmployee(true)

    const payload = {
      name: editEmployeeName.trim(),
      telefon: editEmployeeTelefon.trim() || null,
      email: editEmployeeEmail.trim() || null,
      can_delete: editEmployeeCanDelete,
    }

    const previousEmployees = employees
    setEmployees((curr) => curr.map((e) => (e.id === editEmployeeId ? { ...e, ...payload } : e)))

    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', editEmployeeId)
      .eq('user_id', userId)

    setSavingEditEmployee(false)

    if (error) {
      setEmployees(previousEmployees)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Zamestnanec bol upravený.' })
    closeEditEmployeeModal()
  }

  async function deleteEmployee(employeeIdToDelete: string) {
    if (!userId) return

    const employee = employees.find((e) => e.id === employeeIdToDelete)

    if (employee && employee.can_delete === false) {
      setNotice({
        type: 'error',
        text: 'Tento používateľ nemá povolené mazanie.',
      })
      return
    }

    const employeeNameToDelete = employee?.name || ''

    const usedInLogs = workLogs.some((w) => (w.zamestnanci || []).includes(employeeNameToDelete))
    if (usedInLogs) {
      if (
        !window.confirm(
          'Tento zamestnanec je použitý vo výkazoch práce. Zmazať ho zo zoznamu aj tak? Staré výkazy zostanú uložené s menom.'
        )
      ) {
        return
      }
    } else if (!window.confirm('Naozaj chceš zmazať tohto zamestnanca?')) {
      return
    }

    const previousEmployees = employees
    setEmployees((curr) => curr.filter((e) => e.id !== employeeIdToDelete))

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeIdToDelete)
      .eq('user_id', userId)

    if (error) {
      setEmployees(previousEmployees)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Zamestnanec bol zmazaný.' })
  }

  function openWorkLogModal(orderId: string) {
    setActiveWorkLogOrderId(orderId)
    resetWorkLogForm()
    setOpenWorkLog(true)
  }

  function toggleWorkLogEmployee(name: string) {
    setWorkLogEmployees((curr) =>
      curr.includes(name) ? curr.filter((n) => n !== name) : [...curr, name]
    )
  }

  function startEditWorkLog(log: WorkLog) {
    setEditingWorkLogId(log.id)
    setWorkLogDate(log.datum || getTodayDate())
    setWorkLogText(log.praca_popis || '')
    setWorkLogHours(String(log.hodiny ?? ''))
    setWorkLogEmployees(log.zamestnanci || [])
    setOpenWorkLog(true)
    setActiveWorkLogOrderId(log.order_id)
  }

  function exportOrderWorkLogsPdf(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    const logs = workLogsByOrder[orderId] || []

    if (!order) {
      setNotice({ type: 'error', text: 'Zákazka nebola nájdená.' })
      return
    }

    if (logs.length === 0) {
      setNotice({ type: 'error', text: 'Táto zákazka zatiaľ nemá žiadny výkaz práce.' })
      return
    }

    const customerName = getCustomerName(order.customer_id)
    const totalHours = getOrderHours(order.id).toFixed(1)

    const rowsHtml = logs
      .map(
        (log, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDate(log.datum)}</td>
            <td>${Number(log.hodiny || 0).toFixed(2)} h</td>
            <td>${(log.zamestnanci || []).join(', ') || '-'}</td>
            <td>${String(log.praca_popis || '').replace(/\n/g, '<br />')}</td>
          </tr>
        `
      )
      .join('')

    const printWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!printWindow) {
      setNotice({ type: 'error', text: 'Nepodarilo sa otvoriť PDF náhľad.' })
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Servisný výkaz - ${order.nazov}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 28px; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
            .headerTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 8px; }
            .logo { width: 58px; height: auto; }
            .company { font-size: 11px; line-height: 1.35; text-align: right; color: #475569; }
            .company strong { font-size: 14px; color: #0f172a; }
            h1 { margin: 6px 0 10px 0; font-size: 22px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; font-size: 13px; margin-bottom: 12px; }
            .summary { margin: 14px 0 12px 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; font-size: 13px; text-align: left; }
            th { background: #eff6ff; }
            .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 34px; }
            .signBlock { flex: 1; text-align: center; }
            .signTitle { font-weight: 700; margin-bottom: 8px; font-size: 13px; }
            .stamp { height: 64px; width: auto; margin: 6px auto 6px auto; display: block; }
            .signLine { border-top: 1px solid #0f172a; margin-top: 12px; }
            .signLabel { font-size: 12px; margin-top: 4px; color: #475569; }
            .footer { margin-top: 24px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="headerTop">
              <img class="logo" src="data:image/png;base64,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pLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAAAIBECjsAAAAAAABIpLADAAAAAACARAo7AAAAAAAASKSwAwAAAAAAgEQKOwAAAAAAAEiksAMAAAAA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AAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAAAJBIYQcAAAAAAACJFHYAAAAAAACQSGEHAAAAAAAAiRR2AAAAAAAAkEhhBwAAAAAAAIkUdgAAAAAA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" />
              <div class="company">
                <strong>ITspot s. r. o.</strong><br />
                Hájles 1703/6, 968 01 Nová Baňa<br />
                IČO: 56430388 &nbsp;&nbsp; DIČ: 2122307462<br />
                IČ DPH: SK2122307462
              </div>
            </div>

            <h1>Servisný výkaz</h1>

            <div class="meta">
              <div><strong>Zákazka:</strong> ${order.nazov}</div>
              <div><strong>Zákazník:</strong> ${customerName}</div>
              <div><strong>Prijatie zákazky:</strong> ${formatDate(order.prijatie_zakazky)}</div>
            </div>
          </div>

          <div class="summary">
            <strong>Počet záznamov:</strong> ${logs.length} &nbsp;&nbsp; | &nbsp;&nbsp;
            <strong>Hodiny spolu:</strong> ${totalHours} h
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Dátum zásahu</th>
                <th>Odpracovaný čas</th>
                <th>Technik</th>
                <th>Popis vykonanej práce</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="signatures">
            <div class="signBlock">
              <div class="signTitle">Vykonal</div>
              <img class="stamp" src="data:image/jpeg;base64,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" />
              <div class="signLine"></div>
              <div class="signLabel">ITspot s.r.o.</div>
            </div>

            <div class="signBlock">
              <div class="signTitle">Prevzal zákazník</div>
              <div style="height: 70px;"></div>
              <div class="signLine"></div>
              <div class="signLabel">Meno / podpis</div>
            </div>
          </div>

          <div class="footer">
            Vygenerované z aplikácie ITspot
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  async function addWorkLog() {
    if (!userId || !activeWorkLogOrderId) {
      setNotice({ type: 'error', text: 'Chýba používateľ alebo zákazka.' })
      return
    }

    if (!workLogDate) {
      setNotice({ type: 'error', text: 'Zadaj dátum.' })
      return
    }

    if (!workLogText.trim()) {
      setNotice({ type: 'error', text: 'Zadaj popis vykonanej práce.' })
      return
    }

    const normalizedHours = String(workLogHours || '').replace(',', '.').trim()
    const hours = Number(normalizedHours)

    if (!Number.isFinite(hours) || hours <= 0) {
      setNotice({ type: 'error', text: 'Zadaj platný počet hodín.' })
      return
    }

    setSavingWorkLog(true)

    try {
      const payload = {
        user_id: userId,
        order_id: activeWorkLogOrderId,
        datum: workLogDate,
        praca_popis: workLogText.trim(),
        hodiny: hours,
        zamestnanci: workLogEmployees.length > 0 ? workLogEmployees : [],
      }

      if (editingWorkLogId) {
        const { error } = await supabase
          .from('work_logs')
          .update(payload)
          .eq('id', editingWorkLogId)
          .eq('user_id', userId)

        if (error) {
          console.error('SUPABASE WORKLOG UPDATE ERROR:', error)
          setNotice({ type: 'error', text: `Výkaz sa neupravil: ${error.message}` })
          return
        }

        setNotice({ type: 'success', text: 'Výkaz práce bol upravený.' })
      } else {
        const { error } = await supabase.from('work_logs').insert([payload])

        if (error) {
          console.error('SUPABASE WORKLOG INSERT ERROR:', error)
          setNotice({ type: 'error', text: `Výkaz sa neuložil: ${error.message}` })
          return
        }

        setNotice({ type: 'success', text: 'Výkaz práce bol uložený.' })
      }

      const currentUserId = userId
      resetWorkLogForm()
      await loadWorkLogs(currentUserId)
      await loadOrders(currentUserId)
    } catch (err) {
      console.error('ADD/EDIT WORKLOG ERROR:', err)
      const message = err instanceof Error ? err.message : 'Neznáma chyba pri ukladaní výkazu.'
      setNotice({ type: 'error', text: message })
    } finally {
      setSavingWorkLog(false)
    }
  }

  async function deleteWorkLog(workLogId: string) {
    if (!userId) return
    if (!window.confirm('Naozaj chceš zmazať tento výkaz práce?')) return

    const previous = workLogs
    setWorkLogs((curr) => curr.filter((w) => w.id !== workLogId))

    const { error } = await supabase
      .from('work_logs')
      .delete()
      .eq('id', workLogId)
      .eq('user_id', userId)

    if (error) {
      setWorkLogs(previous)
      setNotice({ type: 'error', text: error.message })
      return
    }

    await loadOrders(userId)
    setNotice({ type: 'success', text: 'Výkaz práce bol zmazaný.' })
  }

  async function logout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    setLoggingOut(false)
    router.replace('/login')
  }

  const customerMap = useMemo(() => {
    return Object.fromEntries(customers.map((c) => [c.id, c]))
  }, [customers])

  function getCustomerName(id: string) {
    return customerMap[id]?.nazov || 'Neznámy zákazník'
  }

  const workLogsByOrder = useMemo(() => {
    const grouped: Record<string, WorkLog[]> = {}

    for (const log of workLogs) {
      if (!grouped[log.order_id]) grouped[log.order_id] = []
      grouped[log.order_id].push(log)
    }

    for (const orderId of Object.keys(grouped)) {
      grouped[orderId].sort((a, b) => {
        const dateA = `${a.datum || ''}-${a.created_at || ''}`
        const dateB = `${b.datum || ''}-${b.created_at || ''}`
        return dateB.localeCompare(dateA)
      })
    }

    return grouped
  }, [workLogs])

  const totalHoursByOrder = useMemo(() => {
    const totals: Record<string, number> = {}

    for (const log of workLogs) {
      const value = Number(log.hodiny || 0)
      totals[log.order_id] = (totals[log.order_id] || 0) + value
    }

    return totals
  }, [workLogs])

  function getOrderHours(orderId: string) {
    return Number(totalHoursByOrder[orderId] || 0)
  }

  function exportOrderWorkLogs(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    const logs = workLogsByOrder[orderId] || []

    if (!order) {
      setNotice({ type: 'error', text: 'Zákazka nebola nájdená.' })
      return
    }

    if (logs.length === 0) {
      setNotice({ type: 'error', text: 'Táto zákazka zatiaľ nemá žiadny výkaz práce.' })
      return
    }

    const rows = [
      ['Zákazka', 'Zákazník', 'Prijatie zákazky', 'Termín', 'Dátum výkazu', 'Hodiny', 'Zamestnanci', 'Práca'],
      ...logs.map((log) => [
        order.nazov,
        getCustomerName(order.customer_id),
        formatDate(order.prijatie_zakazky),
        formatDate(order.termin),
        formatDate(log.datum),
        String(log.hodiny),
        (log.zamestnanci || []).join(', '),
        log.praca_popis,
      ]),
    ]

    const safeName = order.nazov.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'zakazka'
    downloadCsv(`vykaz-prace-${safeName}.csv`, rows)
    setNotice({ type: 'success', text: 'Výkaz práce bol exportovaný do CSV.' })
  }

  function togglePinnedOrder(orderId: string) {
    setPinnedOrderIds((curr) =>
      curr.includes(orderId) ? curr.filter((id) => id !== orderId) : [orderId, ...curr]
    )
  }

  function isPinnedOrder(orderId: string) {
    return pinnedOrderIds.includes(orderId)
  }


  const activeOrders = useMemo(() => {
    return orders.filter((o) => AKTIVNE_STATUSY.includes(o.stav))
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()

    const result = activeOrders.filter((o) => {
      const customerName = getCustomerName(o.customer_id).toLowerCase()
      const workLogTextCombined = (workLogsByOrder[o.id] || [])
        .map((w) => [w.praca_popis, ...(w.zamestnanci || [])].join(' '))
        .join(' ')
        .toLowerCase()

      const matchesSearch = !q
        ? true
        : [o.nazov, o.popis || '', customerName, workLogTextCombined]
            .join(' ')
            .toLowerCase()
            .includes(q)

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
      const prijatieA = a.prijatie_zakazky || '9999-12-31'
      const prijatieB = b.prijatie_zakazky || '9999-12-31'
      const createdA = a.created_at || ''
      const createdB = b.created_at || ''
      const hoursA = getOrderHours(a.id)
      const hoursB = getOrderHours(b.id)

      switch (sortBy) {
        case 'customer':
          return customerA.localeCompare(customerB, 'sk')
        case 'status':
          return statusA.localeCompare(statusB, 'sk')
        case 'name':
          return nazovA.localeCompare(nazovB, 'sk')
        case 'deadline':
          return terminA.localeCompare(terminB)
        case 'deadline_desc':
          return terminB.localeCompare(terminA)
        case 'accepted':
          return prijatieA.localeCompare(prijatieB)
        case 'accepted_desc':
          return prijatieB.localeCompare(prijatieA)
        case 'hours':
          return hoursB - hoursA
        case 'oldest':
          return createdA.localeCompare(createdB)
        case 'newest':
        default:
          return createdB.localeCompare(createdA)
      }
    })

    return result
  }, [activeOrders, search, statusFilter, sortBy, workLogsByOrder])

  const groupedOrders = useMemo(() => {
    const pinned = filteredOrders.filter((o) => pinnedOrderIds.includes(o.id))
    const rest = filteredOrders.filter((o) => !pinnedOrderIds.includes(o.id))

    const sections = [
      {
        key: 'pinned',
        title: 'Pripnuté',
        description: 'Tvoje najdôležitejšie zákazky navrchu.',
        items: pinned,
      },
      {
        key: 'overdue',
        title: 'Po termíne',
        description: 'Zákazky, ktoré potrebujú pozornosť hneď.',
        items: rest.filter((o) => isOverdue(o)),
      },
      {
        key: 'rozpracovana',
        title: 'Rozpracované',
        description: 'Na týchto zákazkách sa aktuálne pracuje.',
        items: rest.filter((o) => o.stav === 'rozpracovana' && !isOverdue(o)),
      },
      {
        key: 'caka',
        title: 'Čaká na materiál',
        description: 'Dočasne pozastavené alebo čakajúce zákazky.',
        items: rest.filter((o) => o.stav === 'caka' && !isOverdue(o)),
      },
      {
        key: 'nova',
        title: 'Nové',
        description: 'Nové zákazky pripravené na začatie.',
        items: rest.filter((o) => o.stav === 'nova' && !isOverdue(o)),
      },
      {
        key: 'hotova',
        title: 'Dokončené',
        description: 'Hotové zákazky pred fakturáciou alebo odovzdaním.',
        items: rest.filter((o) => o.stav === 'hotova'),
      },
    ]

    return sections.filter((section) => section.items.length > 0)
  }, [filteredOrders, pinnedOrderIds])

  const currentOrderWorkLogs = useMemo(() => {
    if (!activeWorkLogOrderId) return []
    return workLogsByOrder[activeWorkLogOrderId] || []
  }, [activeWorkLogOrderId, workLogsByOrder])

  const currentOrder = useMemo(() => {
    return orders.find((o) => o.id === activeWorkLogOrderId) || null
  }, [orders, activeWorkLogOrderId])

  const boxStyle: CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '9px 10px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    outline: 'none',
    background: '#fff',
    fontSize: 12,
  }

  const labelStyle: CSSProperties = {
    fontSize: 12,
    color: '#475569',
    fontWeight: 700,
    marginBottom: 6,
    display: 'block',
  }

  const buttonStyle: CSSProperties = {
    padding: '7px 10px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  }

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: '1px solid #1d4ed8',
    minHeight: 40,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 900,
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.35)',
  }

  const greenButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#065f46',
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
    padding: '7px 10px',
    borderRadius: 12,
    border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#0f172a',
    cursor: 'pointer',
    fontWeight: 700,
  })

  const summaryCard = (label: string, value: string | number, color: CSSProperties): ReactNode => (
    <div
      style={{
        ...boxStyle,
        minWidth: 160,
        padding: 14,
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
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
    </div>
  )

  function toggleExpandedOrder(orderId: string) {
    setExpandedOrderIds((curr) =>
      curr.includes(orderId) ? curr.filter((id) => id !== orderId) : [...curr, orderId]
    )
  }

  function isOverdue(order: Order) {
    if (!order.termin) return false
    if (order.stav === 'hotova' || order.stav === 'odovzdana' || order.stav === 'stornovana') return false
    return order.termin < getTodayDate()
  }

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)',
        padding: 14,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1380, margin: '0 auto' }}>
        <div
          style={{
            ...boxStyle,
            marginBottom: 8,
            padding: 12,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div className="headerCompact">
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, letterSpacing: 0.4 }}>ITspot s.r.o.</div>
              <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Evidencia zákaziek</h1>
            </div>

            <div className="headerCompactActions">
              <button
                type="button"
                style={{ ...primaryButtonStyle, minHeight: 44, padding: '10px 16px', fontSize: 14, boxShadow: '0 8px 18px rgba(37, 99, 235, 0.28)' }}
                onClick={() => {
                  resetAddOrderForm()
                  setOpenAddOrder(true)
                }}
              >
                + Nová zákazka
              </button>

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  minHeight: 34,
                  padding: '6px 9px',
                }}
                onClick={() => {
                  resetAddCustomerForm()
                  setOpenAddCustomer(true)
                }}
              >
                Nový zákazník
              </button>

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  minHeight: 34,
                  padding: '6px 9px',
                }}
                onClick={() => {
                  resetEmployeeForm()
                  setOpenAddEmployee(true)
                }}
              >
                Nový zamestnanec
              </button>

              <Link
                href="/dochadzka"
                style={{
                  ...buttonStyle,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  minHeight: 34,
                  padding: '6px 9px',
                  fontSize: 12,
                }}
              >
                Dochádzka
              </Link>

              <Link
                href="/fakturovane"
                style={{
                  ...buttonStyle,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  minHeight: 34,
                  padding: '6px 9px',
                  fontSize: 12,
                }}
              >
                Fakturované / Stornované
              </Link>

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  minHeight: 34,
                  padding: '6px 9px',
                }}
                onClick={logout}
                disabled={loggingOut}
              >
                {loggingOut ? 'Odhlasujem...' : 'Odhlásiť'}
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            style={{
              ...boxStyle,
              marginBottom: 18,
              padding: '14px 16px',
              border: notice.type === 'success' ? '1px solid #86efac' : '1px solid #fecaca',
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

        <div
          className="summaryStrip"
          style={{
            ...boxStyle,
            marginBottom: 12,
            padding: '8px 10px',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: 999, fontWeight: 800 }}>
            Aktívne {activeOrders.length}
          </div>
          <div style={{ ...getStatusBadgeStyle('nova'), padding: '6px 10px', borderRadius: 999, fontWeight: 800 }}>
            Nové {activeOrders.filter((o) => o.stav === 'nova').length}
          </div>
          <div style={{ ...getStatusBadgeStyle('rozpracovana'), padding: '6px 10px', borderRadius: 999, fontWeight: 800 }}>
            Rozpracované {activeOrders.filter((o) => o.stav === 'rozpracovana').length}
          </div>
          <div style={{ ...getStatusBadgeStyle('caka'), padding: '6px 10px', borderRadius: 999, fontWeight: 800 }}>
            Čakajú {activeOrders.filter((o) => o.stav === 'caka').length}
          </div>
          <div style={{ ...getStatusBadgeStyle('hotova'), padding: '6px 10px', borderRadius: 999, fontWeight: 800 }}>
            Dokončené {activeOrders.filter((o) => o.stav === 'hotova').length}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" style={tabButton(activeTab === 'zakazky')} onClick={() => setActiveTab('zakazky')}>
            Zákazky
          </button>
          <button type="button" style={tabButton(activeTab === 'zakaznici')} onClick={() => setActiveTab('zakaznici')}>
            Zákazníci
          </button>
          <button type="button" style={tabButton(activeTab === 'zamestnanci')} onClick={() => setActiveTab('zamestnanci')}>
            Zamestnanci
          </button>
        </div>

        {activeTab === 'zakazky' && (
          <>
            <div style={{ ...boxStyle, marginBottom: 8, padding: 12 }}>
              <div className="filtersGrid filtersGridOrders">
                <div>
                  <label style={labelStyle} htmlFor="search-orders">
                    Hľadať
                  </label>
                  <input
                    id="search-orders"
                    style={inputStyle}
                    placeholder="Názov zákazky, zákazník, popis, zamestnanec..."
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
                    <option value="deadline">Termín - od najbližších</option>
                    <option value="deadline_desc">Termín - od najvzdialenejších</option>
                    <option value="customer">Podľa zákazníka</option>
                    <option value="status">Podľa stavu</option>
                    <option value="name">Podľa názvu</option>
                    <option value="hours">Podľa hodín</option>
                    <option value="accepted">Prijatie - od najstarších</option>
                    <option value="accepted_desc">Prijatie - od najnovších</option>
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
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>Aktívne zákazky</div>
                <div style={{ color: '#475569', fontWeight: 700 }}>Zobrazené: {filteredOrders.length}</div>
              </div>

              {filteredOrders.length === 0 && (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    border: '1px dashed #cbd5e1',
                    background: '#f8fafc',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  Žiadne zákazky na zobrazenie.
                </div>
              )}

              <div style={{ display: 'grid', gap: 10 }}>
                {groupedOrders.map((section) => (
                  <div key={section.key}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        marginBottom: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900 }}>{section.title}</div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{section.description}</div>
                      </div>
                      <div
                        style={{
                          minWidth: 28,
                          height: 28,
                          borderRadius: 999,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          color: '#334155',
                        }}
                      >
                        {section.items.length}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {section.items.map((o) => {
                        const expanded = expandedOrderIds.includes(o.id)
                        const orderLogs = workLogsByOrder[o.id] || []
                        const lastLog = orderLogs[0]
                        const isPinned = isPinnedOrder(o.id)

                        return (
                          <div
                            key={o.id}
                            style={{
                              borderRadius: 12,
                              border: isOverdue(o) ? '1px solid #fecdd3' : '1px solid #e2e8f0',
                              background: isOverdue(o) ? '#fff7f7' : '#ffffff',
                              overflow: 'hidden',
                              boxShadow: expanded ? '0 12px 26px rgba(15, 23, 42, 0.08)' : '0 4px 12px rgba(15, 23, 42, 0.04)',
                              ...getStatusCardBorder(o.stav),
                            }}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleExpandedOrder(o.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  toggleExpandedOrder(o.id)
                                }
                              }}
                              style={{
                                width: '100%',
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              aria-expanded={expanded}
                            >
                              <div className="orderRowSummary">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      togglePinnedOrder(o.id)
                                    }}
                                    aria-label={isPinned ? 'Odopnúť zákazku' : 'Pripnúť zákazku'}
                                    title={isPinned ? 'Odopnúť zákazku' : 'Pripnúť zákazku'}
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      background: isPinned ? '#fff7ed' : '#fff',
                                      color: isPinned ? '#c2410c' : '#64748b',
                                      width: 30,
                                      height: 30,
                                      minWidth: 30,
                                      borderRadius: 9,
                                      cursor: 'pointer',
                                      fontSize: 16,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {isPinned ? '★' : '☆'}
                                  </button>

                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.1 }}>{o.nazov}</div>
                                      {isOverdue(o) && (
                                        <span
                                          style={{
                                            background: '#fff1f2',
                                            color: '#be123c',
                                            border: '1px solid #fecdd3',
                                            borderRadius: 999,
                                            padding: '2px 7px',
                                            fontSize: 10,
                                            fontWeight: 800,
                                          }}
                                        >
                                          Po termíne
                                        </span>
                                      )}
                                      {isPinned && (
                                        <span
                                          style={{
                                            background: '#fff7ed',
                                            color: '#c2410c',
                                            border: '1px solid #fdba74',
                                            borderRadius: 999,
                                            padding: '2px 7px',
                                            fontSize: 10,
                                            fontWeight: 800,
                                          }}
                                        >
                                          Pripnuté
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ marginTop: 3, color: '#475569', fontSize: 13 }}>
                                      {getCustomerName(o.customer_id)}
                                    </div>
                                  </div>
                                </div>

                                <div className="orderRowMeta">
                                  <div className="orderMetaChip">
                                    <span className="orderMetaLabel">Termín</span>
                                    <strong style={{ color: isOverdue(o) ? '#be123c' : '#0f172a' }}>{formatDate(o.termin)}</strong>
                                  </div>


                                  <div
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: 9,
                                      border: '1px solid #cbd5e1',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 16,
                                      fontWeight: 700,
                                      color: '#475569',
                                      background: '#fff',
                                    }}
                                  >
                                    {expanded ? '−' : '+'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {expanded && (
                              <div
                                style={{
                                  padding: 10,
                                  borderTop: '1px solid #e2e8f0',
                                  background: '#f8fafc',
                                }}
                              >
                                <div className="orderDetailGrid">
                                  <div style={{ ...boxStyle, padding: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>
                                      Základné informácie
                                    </div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                      <div><strong>Zákazník:</strong> {getCustomerName(o.customer_id)}</div>
                                      <div><strong>Prijatie:</strong> {formatDate(o.prijatie_zakazky)}</div>
                                      <div><strong>Termín:</strong> {formatDate(o.termin)}</div>
                                      <div><strong>Výkazy:</strong> {orderLogs.length}</div>
                                      <div><strong>Popis:</strong> {o.popis || '-'}</div>
                                    </div>
                                  </div>

                                  <div style={{ ...boxStyle, padding: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>
                                      História výkazov
                                    </div>
                                    {orderLogs.length > 0 ? (
                                      <div style={{ display: 'grid', gap: 8 }}>
                                        {orderLogs.slice(0, 3).map((log) => (
                                          <div
                                            key={log.id}
                                            style={{
                                              border: '1px solid #e2e8f0',
                                              borderRadius: 10,
                                              padding: 10,
                                              background: '#fff',
                                            }}
                                          >
                                            <div style={{ fontWeight: 800, fontSize: 13 }}>
                                              {formatDate(log.datum)} · {Number(log.hodiny || 0).toFixed(1)} h
                                            </div>
                                            <div style={{ marginTop: 4, color: '#334155', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                              {log.praca_popis}
                                            </div>
                                          </div>
                                        ))}
                                        {orderLogs.length > 3 && (
                                          <div style={{ color: '#64748b', fontSize: 12 }}>
                                            Ďalšie záznamy nájdeš po kliknutí na Výkaz práce.
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ color: '#64748b' }}>Zatiaľ bez výkazu práce.</div>
                                    )}
                                  </div>
                                </div>

                                <div style={{ marginTop: 14 }}>
                                  <label style={labelStyle} htmlFor={`status-${o.id}`}>
                                    Stav zákazky
                                  </label>
                                  <select
                                    id={`status-${o.id}`}
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

                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                                  <button type="button" style={greenButtonStyle} onClick={() => openWorkLogModal(o.id)}>
                                    Výkaz práce
                                  </button>
                                  <button type="button" style={buttonStyle} onClick={() => startEditOrder(o)}>
                                    Upraviť
                                  </button>
                                  <button type="button" style={buttonStyle} onClick={() => exportOrderWorkLogs(o.id)}>
                                    Export CSV
                                  </button>
                                  <button type="button" style={dangerButtonStyle} onClick={() => deleteOrder(o.id)}>
                                    Zmazať
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
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
              <div style={{ fontWeight: 800, fontSize: 16 }}>Zoznam zákazníkov</div>
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
                            <button type="button" style={buttonStyle} onClick={() => startEditCustomer(c)}>
                              Upraviť
                            </button>
                            <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomer(c.id)}>
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
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{c.nazov}</div>

                  <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13 }}>
                    <div><strong>Kontakt:</strong> {c.kontakt || '-'}</div>
                    <div><strong>Telefón:</strong> {c.telefon || '-'}</div>
                    <div><strong>Email:</strong> {c.email || '-'}</div>
                  </div>

                  <div className="mobileActionRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button type="button" style={buttonStyle} onClick={() => startEditCustomer(c)}>
                      Upraviť
                    </button>
                    <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomer(c.id)}>
                      Zmazať
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'zamestnanci' && (
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
              <div style={{ fontWeight: 800, fontSize: 16 }}>Zoznam zamestnancov</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: '#475569', fontWeight: 700 }}>Spolu: {employees.length}</div>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => {
                    resetEmployeeForm()
                    setOpenAddEmployee(true)
                  }}
                >
                  + Nový zamestnanec
                </button>
              </div>
            </div>

            <div className="desktopTable">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 10px' }}>Meno</th>
                      <th style={{ padding: '12px 10px' }}>Telefón</th>
                      <th style={{ padding: '12px 10px' }}>Email</th>
                      <th style={{ padding: '12px 10px' }}>Mazanie</th>
                      <th style={{ padding: '12px 10px' }}>Akcie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 800 }}>{emp.name}</td>
                        <td style={{ padding: '12px 10px' }}>{emp.telefon || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{emp.email || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>
                          {emp.can_delete === false ? 'Zakázané' : 'Povolené'}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" style={buttonStyle} onClick={() => startEditEmployee(emp)}>
                              Upraviť
                            </button>
                            <button type="button" style={dangerButtonStyle} onClick={() => deleteEmployee(emp.id)}>
                              Zmazať
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                          Zatiaľ nemáš žiadnych zamestnancov
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mobileCards">
              {employees.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                  Zatiaľ nemáš žiadnych zamestnancov
                </div>
              )}

              {employees.map((emp) => (
                <div
                  key={emp.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{emp.name}</div>

                  <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13 }}>
                    <div><strong>Telefón:</strong> {emp.telefon || '-'}</div>
                    <div><strong>Email:</strong> {emp.email || '-'}</div>
                    <div><strong>Mazanie:</strong> {emp.can_delete === false ? 'Zakázané' : 'Povolené'}</div>
                  </div>

                  <div className="mobileActionRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button type="button" style={buttonStyle} onClick={() => startEditEmployee(emp)}>
                      Upraviť
                    </button>
                    <button type="button" style={dangerButtonStyle} onClick={() => deleteEmployee(emp.id)}>
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

              <div>
                <label style={labelStyle} htmlFor="order-accepted-date">
                  Prijatie zákazky
                </label>
                <input
                  id="order-accepted-date"
                  style={inputStyle}
                  type="date"
                  value={orderPrijatieZakazky}
                  onChange={(e) => setOrderPrijatieZakazky(e.target.value)}
                />
              </div>

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
                <label style={labelStyle} htmlFor="edit-order-accepted-date">
                  Prijatie zákazky
                </label>
                <input
                  id="edit-order-accepted-date"
                  style={inputStyle}
                  type="date"
                  value={editOrderPrijatieZakazky}
                  onChange={(e) => setEditOrderPrijatieZakazky(e.target.value)}
                />
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

        <Modal open={openAddEmployee} title="Pridať zamestnanca" onClose={closeAddEmployeeModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addEmployee()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="employee-name">
                  Meno
                </label>
                <input
                  id="employee-name"
                  style={inputStyle}
                  placeholder="Meno zamestnanca"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="employee-phone">
                  Telefón
                </label>
                <input
                  id="employee-phone"
                  style={inputStyle}
                  placeholder="Telefón"
                  value={employeeTelefon}
                  onChange={(e) => setEmployeeTelefon(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="employee-email">
                  Email
                </label>
                <input
                  id="employee-email"
                  type="email"
                  style={inputStyle}
                  placeholder="Email"
                  value={employeeEmail}
                  onChange={(e) => setEmployeeEmail(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={employeeCanDelete}
                  onChange={(e) => setEmployeeCanDelete(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Môže mazať</span>
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingEmployee}>
                  {savingEmployee ? 'Ukladám...' : 'Uložiť zamestnanca'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeAddEmployeeModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal open={openEditEmployee} title="Upraviť zamestnanca" onClose={closeEditEmployeeModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveEmployeeEdit()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="edit-employee-name">
                  Meno
                </label>
                <input
                  id="edit-employee-name"
                  style={inputStyle}
                  placeholder="Meno zamestnanca"
                  value={editEmployeeName}
                  onChange={(e) => setEditEmployeeName(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-employee-phone">
                  Telefón
                </label>
                <input
                  id="edit-employee-phone"
                  style={inputStyle}
                  placeholder="Telefón"
                  value={editEmployeeTelefon}
                  onChange={(e) => setEditEmployeeTelefon(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-employee-email">
                  Email
                </label>
                <input
                  id="edit-employee-email"
                  type="email"
                  style={inputStyle}
                  placeholder="Email"
                  value={editEmployeeEmail}
                  onChange={(e) => setEditEmployeeEmail(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={editEmployeeCanDelete}
                  onChange={(e) => setEditEmployeeCanDelete(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Môže mazať</span>
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingEditEmployee}>
                  {savingEditEmployee ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeEditEmployeeModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal
          open={openWorkLog}
          title={currentOrder ? `Výkaz práce: ${currentOrder.nazov}` : 'Výkaz práce'}
          onClose={closeWorkLogModal}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {currentOrder && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800 }}>{currentOrder.nazov}</div>
                <div style={{ color: '#475569', marginTop: 6 }}>
                  {getCustomerName(currentOrder.customer_id)}
                </div>
                <div style={{ color: '#475569', marginTop: 6 }}>
                  Prijatie: {formatDate(currentOrder.prijatie_zakazky)} | Termín: {formatDate(currentOrder.termin)}
                </div>
                <div style={{ marginTop: 8, fontWeight: 800 }}>
                  Hodiny spolu: {getOrderHours(currentOrder.id).toFixed(1)} h
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {currentOrder && (
                <>
                  <button type="button" style={buttonStyle} onClick={() => exportOrderWorkLogs(currentOrder.id)}>
                    Exportovať výkazy do CSV
                  </button>
                  <button type="button" style={buttonStyle} onClick={() => exportOrderWorkLogsPdf(currentOrder.id)}>
                    PDF pre zákazníka
                  </button>
                </>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void addWorkLog()
              }}
            >
              <div className="workLogGrid">
                <div>
                  <label style={labelStyle} htmlFor="worklog-date">
                    Dátum
                  </label>
                  <input
                    id="worklog-date"
                    type="date"
                    style={inputStyle}
                    value={workLogDate}
                    onChange={(e) => setWorkLogDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-hours">
                    Čas / hodiny
                  </label>
                  <input
                    id="worklog-hours"
                    type="text"
                    inputMode="decimal"
                    style={inputStyle}
                    placeholder="Napr. 2.5 alebo 2,5"
                    value={workLogHours}
                    onChange={(e) => setWorkLogHours(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle} htmlFor="worklog-text">
                    Čo sa urobilo
                  </label>
                  <textarea
                    id="worklog-text"
                    style={{
                      ...inputStyle,
                      minHeight: 110,
                      resize: 'vertical',
                      fontFamily: 'Arial, Helvetica, sans-serif',
                    }}
                    placeholder="Popíš čo sa v ten deň robilo..."
                    value={workLogText}
                    onChange={(e) => setWorkLogText(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Zamestnanci</label>

                  {employees.length === 0 ? (
                    <div
                      style={{
                        border: '1px dashed #cbd5e1',
                        borderRadius: 12,
                        padding: 14,
                        color: '#64748b',
                        background: '#f8fafc',
                      }}
                    >
                      Nemáš vytvorených zamestnancov. Najprv si ich pridaj v karte Zamestnanci.
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: 12,
                        padding: 12,
                        maxHeight: 220,
                        overflowY: 'auto',
                        background: '#fff',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 8 }}>
                        {employees.map((emp) => {
                          const checked = workLogEmployees.includes(emp.name)

                          return (
                            <label
                              key={emp.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: 10,
                                borderRadius: 12,
                                background: checked ? '#eff6ff' : '#f8fafc',
                                border: checked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleWorkLogEmployee(emp.name)}
                              />
                              <span style={{ fontWeight: 700 }}>{emp.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingWorkLog}>
                  {savingWorkLog ? 'Ukladám...' : editingWorkLogId ? 'Uložiť úpravu výkazu' : 'Uložiť výkaz práce'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={resetWorkLogForm}>
                  {editingWorkLogId ? 'Zrušiť úpravu' : 'Vyčistiť formulár'}
                </button>
              </div>
            </form>

            <div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Doterajšie výkazy</div>

              {currentOrderWorkLogs.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: 12,
                    padding: 14,
                    color: '#64748b',
                    background: '#f8fafc',
                  }}
                >
                  Zatiaľ nie je pridaný žiadny výkaz práce.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {currentOrderWorkLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 16,
                        padding: 14,
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>
                            {formatDate(log.datum)} · {Number(log.hodiny || 0).toFixed(2)} h
                          </div>
                          <div style={{ marginTop: 6, color: '#334155', whiteSpace: 'pre-wrap' }}>
                            {log.praca_popis}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                            {(log.zamestnanci || []).length > 0 ? (
                              (log.zamestnanci || []).map((name) => (
                                <span
                                  key={`${log.id}-${name}`}
                                  style={{
                                    background: '#eef2ff',
                                    color: '#3730a3',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: 999,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span
                                style={{
                                  background: '#f8fafc',
                                  color: '#475569',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 999,
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                Bez zamestnancov
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={buttonStyle} onClick={() => startEditWorkLog(log)}>
                            Upraviť
                          </button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteWorkLog(log.id)}>
                            Zmazať
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>

        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 18 }}>
            Načítavam dáta...
          </div>
        )}
      </div>

      <style jsx>{`
        .headerCompact {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .headerCompactActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .desktopTable {
          display: block;
        }

        .mobileCards {
          display: none;
        }
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

        .filtersGridOrders {
          grid-template-columns: 2fr 1fr 1.2fr;
        }

        .modalGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .workLogGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .orderRowSummary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          flex-wrap: wrap;
        }

        .orderRowMeta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .orderMetaChip {
          min-height: 38px;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          display: inline-flex;
          align-items: flex-start;
          justify-content: center;
          flex-direction: column;
          gap: 2px;
        }

        .orderMetaLabel {
          font-size: 11px;
          line-height: 1;
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .orderDetailGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 1150px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .orderDetailGrid {
            grid-template-columns: 1fr;
          }

          .orderRowSummary {
            align-items: stretch;
          }

          .orderRowMeta {
            justify-content: flex-start;
          }
        }

        @media (max-width: 768px) {
          .filtersGrid,
          .filtersGridOrders,
          .modalGrid,
          .summaryGrid,
          .workLogGrid {
            grid-template-columns: 1fr;
          }

          .desktopTable {
            display: none;
          }

          .mobileCards {
            display: block;
          }

          .headerCompact {
            align-items: flex-start;
            gap: 10px;
          }

          .headerCompactActions {
            width: 100%;
            justify-content: flex-start;
            gap: 5px;
          }

          .headerCompactActions :global(a),
          .headerCompactActions button {
            width: auto;
            min-width: 0;
            flex: 0 0 auto;
            font-size: 11px;
          }

          .summaryStrip {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 8px 10px !important;
          }

          .orderRowSummary {
            padding: 7px;
            gap: 5px;
          }

          .orderRowMeta {
            width: 100%;
            gap: 6px;
          }

          .orderMetaChip {
            flex: 0 1 auto;
            min-width: 84px;
            min-height: 28px;
            padding: 4px 6px;
            border-radius: 8px;
          }

          .orderMetaLabel {
            font-size: 10px;
          }

          .mobileListCard {
            border-radius: 14px;
            padding: 12px;
            margin-bottom: 10px;
          }

          .mobileActionRow {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
        }

        @media (max-width: 520px) {
          .headerCompactActions {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 2px;
          }

          .headerCompactActions :global(a),
          .headerCompactActions button {
            white-space: nowrap;
          }

          .orderMetaChip {
            flex: 1 1 calc(50% - 6px);
          }
        }
      `}</style>
    </div>
  )
}