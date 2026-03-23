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
const PRACE = ['Montáž', 'Servis', 'Vlastné'] as const
type PracaType = (typeof PRACE)[number]

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

function resolvePraca(type: PracaType, custom: string) {
  return type === 'Vlastné' ? custom.trim() : type
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
  const [editOrderPracaType, setEditOrderPracaType] = useState<PracaType>('Servis')
  const [editOrderPracaCustom, setEditOrderPracaCustom] = useState('')
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
    setOrderPracaType('Servis')
    setOrderPracaCustom('')
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
    setEditOrderPracaType('Servis')
    setEditOrderPracaCustom('')
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
        setNotice({ type: 'error', text: newCustomerError?.message || 'Nepodarilo sa vytvoriť zákazníka.' })
        return
      }

      finalCustomerId = newCustomer.id
      createdCustomerId = newCustomer.id
      setCustomers((curr) => [newCustomer as Customer, ...curr])
    }

    const finalPraca = resolvePraca(orderPracaType, orderPracaCustom)

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

    if (o.praca === 'Montáž' || o.praca === 'Servis') {
      setEditOrderPracaType(o.praca)
      setEditOrderPracaCustom('')
    } else {
      setEditOrderPracaType('Vlastné')
      setEditOrderPracaCustom(o.praca || '')
    }

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

    const finalPraca = resolvePraca(editOrderPracaType, editOrderPracaCustom)
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

  async function addWorkLog() {
    if (!userId || !activeWorkLogOrderId) return

    if (!workLogDate) {
      setNotice({ type: 'error', text: 'Zadaj dátum.' })
      return
    }

    if (!workLogText.trim()) {
      setNotice({ type: 'error', text: 'Zadaj popis vykonanej práce.' })
      return
    }

    const hours = Number(workLogHours)
    if (!hours || hours <= 0) {
      setNotice({ type: 'error', text: 'Zadaj počet hodín.' })
      return
    }

    setSavingWorkLog(true)

    const { data, error } = await supabase
      .from('work_logs')
      .insert([
        {
          user_id: userId,
          order_id: activeWorkLogOrderId,
          datum: workLogDate,
          praca_popis: workLogText.trim(),
          hodiny: hours,
          zamestnanci: workLogEmployees.length ? workLogEmployees : [],
        },
      ])
      .select()
      .single()

    setSavingWorkLog(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    if (data) {
      setWorkLogs((curr) => [data as WorkLog, ...curr])
    }

    setNotice({ type: 'success', text: 'Výkaz práce bol uložený.' })
    resetWorkLogForm()
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
      [
        'Zákazka',
        'Zákazník',
        'Prijatie zákazky',
        'Termín',
        'Dátum výkazu',
        'Hodiny',
        'Zamestnanci',
        'Práca',
      ],
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
        : [o.nazov, o.praca || '', o.popis || '', customerName, workLogTextCombined]
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
    minHeight: 50,
    padding: '13px 20px',
    fontSize: 15,
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
    padding: '10px 14px',
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
        padding: 16,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1380, margin: '0 auto' }}>
        <div
          style={{
            ...boxStyle,
            marginBottom: 18,
            padding: 24,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div className="headerWrap">
            <div>
              <div style={{ fontSize: 24, opacity: 0.84, marginBottom: 8, letterSpacing: 0.8 }}>ITspot s.r.o.</div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Evidencia zákaziek</h1>
              <div style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.82)' }}>
                Zákazky, zákazníci, zamestnanci a výkazy práce
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

                <button
                  style={{
                    ...buttonStyle,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    minHeight: 44,
                  }}
                  onClick={() => {
                    resetEmployeeForm()
                    setOpenAddEmployee(true)
                  }}
                >
                  Nový zamestnanec
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
          <button style={tabButton(activeTab === 'zamestnanci')} onClick={() => setActiveTab('zamestnanci')}>
            Zamestnanci
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
                    placeholder="Zákazka, zákazník, popis, výkaz práce..."
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
                    <option value="accepted">Prijatie - od najstarších</option>
                    <option value="accepted_desc">Prijatie - od najnovších</option>
                    <option value="deadline">Termín - od najbližších</option>
                    <option value="deadline_desc">Termín - od najvzdialenejších</option>
                    <option value="hours">Podľa hodín</option>
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
                        <th style={{ padding: '12px 10px' }}>Prijatie</th>
                        <th style={{ padding: '12px 10px' }}>Termín</th>
                        <th style={{ padding: '12px 10px' }}>Hodiny</th>
                        <th style={{ padding: '12px 10px' }}>Stav</th>
                        <th style={{ padding: '12px 10px' }}>Akcie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 800 }}>{o.nazov}</div>
                              {isOverdue(o) && (
                                <span
                                  style={{
                                    background: '#fff1f2',
                                    color: '#be123c',
                                    border: '1px solid #fecdd3',
                                    borderRadius: 999,
                                    padding: '3px 8px',
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  Po termíne
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{o.popis || '-'}</div>
                            <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                              <strong>Práca:</strong> {o.praca || '-'} | <strong>Výkazy:</strong>{' '}
                              {(workLogsByOrder[o.id] || []).length}
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px' }}>{getCustomerName(o.customer_id)}</td>
                          <td style={{ padding: '12px 10px' }}>{formatDate(o.prijatie_zakazky)}</td>
                          <td style={{ padding: '12px 10px' }}>{formatDate(o.termin)}</td>
                          <td style={{ padding: '12px 10px', fontWeight: 800 }}>{getOrderHours(o.id).toFixed(1)} h</td>
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
                              <button style={greenButtonStyle} onClick={() => openWorkLogModal(o.id)}>
                                Výkaz práce
                              </button>
                              <button style={buttonStyle} onClick={() => exportOrderWorkLogs(o.id)}>
                                Export CSV
                              </button>
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
                          <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
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

                {filteredOrders.map((o) => {
                  const expanded = expandedOrderIds.includes(o.id)
                  const orderLogs = workLogsByOrder[o.id] || []
                  const lastLog = orderLogs[0]

                  return (
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
                      <button
                        type="button"
                        onClick={() => toggleExpandedOrder(o.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>{o.nazov}</div>
                            <div style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>{getCustomerName(o.customer_id)}</div>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                          <div
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 12,
                              padding: 10,
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Prijatie</div>
                            <div style={{ fontWeight: 800 }}>{formatDate(o.prijatie_zakazky)}</div>
                          </div>

                          <div
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 12,
                              padding: 10,
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Termín</div>
                            <div style={{ fontWeight: 800, color: isOverdue(o) ? '#be123c' : '#0f172a' }}>
                              {formatDate(o.termin)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                          <div
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 12,
                              padding: 10,
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Hodiny</div>
                            <div style={{ fontWeight: 800 }}>{getOrderHours(o.id).toFixed(1)} h</div>
                          </div>

                          <div
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 12,
                              padding: 10,
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Výkazy</div>
                            <div style={{ fontWeight: 800 }}>{orderLogs.length}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          {lastLog && (
                            <div
                              style={{
                                background: '#eef2ff',
                                border: '1px solid #c7d2fe',
                                color: '#3730a3',
                                borderRadius: 999,
                                padding: '5px 10px',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              Posledný výkaz: {formatDate(lastLog.datum)}
                            </div>
                          )}

                          {isOverdue(o) && (
                            <div
                              style={{
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                color: '#be123c',
                                borderRadius: 999,
                                padding: '5px 10px',
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Po termíne
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 10, color: '#0f172a', fontSize: 13, fontWeight: 700 }}>
                          {expanded ? 'Skryť detail ▲' : 'Zobraziť detail ▼'}
                        </div>
                      </button>

                      {expanded && (
                        <div
                          style={{
                            marginTop: 14,
                            borderTop: '1px solid #e2e8f0',
                            paddingTop: 14,
                          }}
                        >
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div><strong>Popis:</strong> {o.popis || '-'}</div>
                            <div><strong>Typ práce:</strong> {o.praca || '-'}</div>
                            <div><strong>Prijatie zákazky:</strong> {formatDate(o.prijatie_zakazky)}</div>
                            <div><strong>Termín:</strong> {formatDate(o.termin)}</div>
                            <div><strong>Počet výkazov:</strong> {orderLogs.length}</div>
                            {lastLog && (
                              <div><strong>Posledný záznam:</strong> {formatDate(lastLog.datum)} / {lastLog.hodiny} h</div>
                            )}
                          </div>

                          <div style={{ marginTop: 12 }}>
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

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 14 }}>
                            <button style={greenButtonStyle} onClick={() => openWorkLogModal(o.id)}>
                              Výkaz práce
                            </button>
                            <button style={buttonStyle} onClick={() => exportOrderWorkLogs(o.id)}>
                              Export CSV
                            </button>
                            <button style={buttonStyle} onClick={() => startEditOrder(o)}>
                              Upraviť
                            </button>
                            <button style={dangerButtonStyle} onClick={() => deleteOrder(o.id)}>
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
              <div style={{ fontWeight: 800, fontSize: 18 }}>Zoznam zamestnancov</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: '#475569', fontWeight: 700 }}>Spolu: {employees.length}</div>
                <button
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
                            <button style={buttonStyle} onClick={() => startEditEmployee(emp)}>
                              Upraviť
                            </button>
                            <button style={dangerButtonStyle} onClick={() => deleteEmployee(emp.id)}>
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
                    borderRadius: 18,
                    padding: 14,
                    marginBottom: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{emp.name}</div>

                  <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    <div><strong>Telefón:</strong> {emp.telefon || '-'}</div>
                    <div><strong>Email:</strong> {emp.email || '-'}</div>
                    <div><strong>Mazanie:</strong> {emp.can_delete === false ? 'Zakázané' : 'Povolené'}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    <button style={buttonStyle} onClick={() => startEditEmployee(emp)}>
                      Upraviť
                    </button>
                    <button style={dangerButtonStyle} onClick={() => deleteEmployee(emp.id)}>
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
          <div style={{ display: 'grid', gap: 18 }}>
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
                  {getCustomerName(currentOrder.customer_id)} | {currentOrder.praca || '-'}
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
                <button style={buttonStyle} onClick={() => exportOrderWorkLogs(currentOrder.id)}>
                  Exportovať výkazy do CSV
                </button>
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
                    type="number"
                    step="0.25"
                    min="0"
                    style={inputStyle}
                    placeholder="Napr. 2.5"
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
                        borderRadius: 14,
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
                        borderRadius: 14,
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
                  {savingWorkLog ? 'Ukladám...' : 'Uložiť výkaz práce'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={resetWorkLogForm}>
                  Vyčistiť formulár
                </button>
              </div>
            </form>

            <div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Doterajšie výkazy</div>

              {currentOrderWorkLogs.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: 14,
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

                        <button style={dangerButtonStyle} onClick={() => deleteWorkLog(log.id)}>
                          Zmazať
                        </button>
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

        .workLogGrid {
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

        @media (max-width: 1150px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .filtersGrid,
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