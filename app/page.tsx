'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  nazov_vykazu?: string | null
  start_time?: string | null
  end_time?: string | null
  praca_popis: string
  hodiny: number
  kilometre?: number | null
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

type ActiveIntervention = {
  orderId: string
  title: string
  startedAt: string
}

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

function formatTimeShort(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getNowLocalInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function isoToLocalInputValue(isoValue: string | null | undefined) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function calculateHoursFromTimes(startValue: string, endValue: string) {
  if (!startValue || !endValue) return NaN
  const start = new Date(startValue).getTime()
  const end = new Date(endValue).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return NaN
  return (end - start) / 1000 / 60 / 60
}

function formatRunningDuration(startedAt: string, nowMs: number) {
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return '00:00:00'
  const totalSeconds = Math.max(0, Math.floor((nowMs - start) / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function pdfSafeText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function loadImageAsDataUrl(src: string) {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Nepodarilo sa načítať obrázok: ${src}`)
  }
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error(`Nepodarilo sa spracovať obrázok: ${src}`))
    }
    reader.onerror = () => reject(new Error(`Nepodarilo sa načítať obrázok: ${src}`))
    reader.readAsDataURL(blob)
  })
}

async function loadFirstAvailableImage(paths: string[]) {
  for (const path of paths) {
    try {
      return await loadImageAsDataUrl(path)
    } catch {
      // skus dalsiu moznost
    }
  }
  return null
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
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0)

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
  const [workLogTitle, setWorkLogTitle] = useState('')
  const [workLogStart, setWorkLogStart] = useState('')
  const [workLogEnd, setWorkLogEnd] = useState('')
  const [workLogText, setWorkLogText] = useState('')
  const [workLogHours, setWorkLogHours] = useState('')
  const [workLogKm, setWorkLogKm] = useState('')
  const [workLogEmployees, setWorkLogEmployees] = useState<string[]>([])

  const [openAddCustomer, setOpenAddCustomer] = useState(false)
  const [openAddOrder, setOpenAddOrder] = useState(false)
  const [openEditCustomer, setOpenEditCustomer] = useState(false)
  const [openEditOrder, setOpenEditOrder] = useState(false)
  const [openAddEmployee, setOpenAddEmployee] = useState(false)
  const [openEditEmployee, setOpenEditEmployee] = useState(false)
  const [openWorkLog, setOpenWorkLog] = useState(false)
  const [openQuickStart, setOpenQuickStart] = useState(false)

  const [quickStartOrderId, setQuickStartOrderId] = useState('')
  const [quickStartTitle, setQuickStartTitle] = useState('')

  const [activeIntervention, setActiveIntervention] = useState<ActiveIntervention | null>(null)
  const [runningNowMs, setRunningNowMs] = useState(Date.now())

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
      const raw = window.localStorage.getItem('itspot-active-intervention')
      if (!raw) return
      const parsed = JSON.parse(raw) as ActiveIntervention
      if (parsed?.orderId && parsed?.startedAt) {
        setActiveIntervention(parsed)
        setRunningNowMs(Date.now())
      }
    } catch {
      // ignore localStorage read errors
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!activeIntervention) {
      window.localStorage.removeItem('itspot-active-intervention')
      return
    }
    window.localStorage.setItem('itspot-active-intervention', JSON.stringify(activeIntervention))
  }, [activeIntervention])

  useEffect(() => {
    if (!activeIntervention) return
    setRunningNowMs(Date.now())
    const interval = window.setInterval(() => {
      setRunningNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [activeIntervention])

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

  async function loadPendingCount() {
    try {
      const { count, error } = await supabase
        .from('customer_requests')
        .select('*', { count: 'exact', head: true })
        .eq('stav', 'na_schvalenie')
      if (!error && count !== null) {
        setPendingRequestsCount(count)
      }
    } catch (err) {
      console.error('Chyba pri načítaní počtu požiadaviek:', err)
    }
  }

  async function loadInitialData(currentUserId: string) {
    setLoading(true)
    try {
      await Promise.all([
        loadCustomers(currentUserId),
        loadOrders(currentUserId),
        loadEmployees(currentUserId),
        loadWorkLogs(currentUserId),
        loadPendingCount(),
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
    setWorkLogTitle('')
    setWorkLogStart('')
    setWorkLogEnd('')
    setWorkLogText('')
    setWorkLogHours('')
    setWorkLogKm('')
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

    if (activeIntervention && activeIntervention.orderId === orderId) {
      const startLocal = isoToLocalInputValue(activeIntervention.startedAt)
      setWorkLogDate(startLocal.slice(0, 10) || getTodayDate())
      setWorkLogTitle(activeIntervention.title)
      setWorkLogStart(startLocal)
      const calculated = calculateHoursFromTimes(startLocal, getNowLocalInputValue())
      if (Number.isFinite(calculated) && calculated > 0) {
        setWorkLogHours(calculated.toFixed(2))
      }
    }

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
    setWorkLogTitle(log.nazov_vykazu || '')
    setWorkLogStart(isoToLocalInputValue(log.start_time))
    setWorkLogEnd(isoToLocalInputValue(log.end_time))
    setWorkLogText(log.praca_popis || '')
    setWorkLogHours(String(log.hodiny ?? ''))
    setWorkLogKm(String(log.kilometre ?? ''))
    setWorkLogEmployees(log.zamestnanci || [])
    setOpenWorkLog(true)
    setActiveWorkLogOrderId(log.order_id)
  }

  function setWorkLogStartNow() {
    const value = getNowLocalInputValue()
    setWorkLogStart(value)
    const dateOnly = value.slice(0, 10)
    if (dateOnly) setWorkLogDate(dateOnly)

    if (workLogEnd) {
      const calculated = calculateHoursFromTimes(value, workLogEnd)
      if (Number.isFinite(calculated) && calculated > 0) {
        setWorkLogHours(calculated.toFixed(2))
      }
    }
  }

  function setWorkLogEndNow() {
    const value = getNowLocalInputValue()
    setWorkLogEnd(value)
    const dateOnly = value.slice(0, 10)
    if (dateOnly && !workLogDate) setWorkLogDate(dateOnly)

    if (workLogStart) {
      const calculated = calculateHoursFromTimes(workLogStart, value)
      if (Number.isFinite(calculated) && calculated > 0) {
        setWorkLogHours(calculated.toFixed(2))
      }
    }
  }

  async function exportOrderWorkLogsPdf(orderId: string) {
  const order = orders.find((o) => o.id === orderId)
  const logs = workLogsByOrder[orderId] || []

  if (!order) {
    setNotice({ type: 'error', text: 'Zákazka nebola nájdená.' })
    return
  }

  if (logs.length === 0) {
    setNotice({
      type: 'error',
      text: 'Táto zákazka zatiaľ nemá žiadny výkaz práce.',
    })
    return
  }

  try {
    const [logoDataUrl, stampDataUrl] = await Promise.all([
      loadFirstAvailableImage([
        '/logo.png',
        '/logo.jpg',
        '/logo.jpeg',
        '/logo.webp',
      ]),
      loadFirstAvailableImage([
        '/stamp.png',
        '/stamp.jpg',
        '/stamp.jpeg',
        '/stamp.webp',
      ]),
    ])

    if (!logoDataUrl) {
      setNotice({
        type: 'error',
        text: 'Chýba logo v public/logo.png (alebo .jpg/.jpeg/.webp).',
      })
      return
    }

    const customerName = pdfSafeText(getCustomerName(order.customer_id))
    const totalHours = getOrderHours(order.id).toFixed(1)
    const totalKm = getOrderKilometres(order.id).toFixed(0)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const safeOrderName = pdfSafeText(order.nazov || '-')

    autoTable(doc, {
      startY: 72,

      margin: {
        left: margin,
        right: margin,
        bottom: 50,
      },

      head: [[
        '#',
        'Dátum',
        'Názov zásahu',
        'Štart',
        'Stop',
        'Čas',
        'Km',
        'Technik',
        'Popis vykonanej práce',
      ]],

      body: logs.map((log, index) => [
        String(index + 1),
        formatDate(log.datum),
        pdfSafeText(log.nazov_vykazu || '-'),
        formatTimeShort(log.start_time),
        formatTimeShort(log.end_time),
        `${Number(log.hodiny || 0).toFixed(2)} h`,
        `${Number(log.kilometre || 0).toFixed(0)} km`,
        pdfSafeText((log.zamestnanci || []).join(', ') || '-'),
        pdfSafeText(log.praca_popis || ''),
      ]),

      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.2,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.25,
        valign: 'top',
        overflow: 'linebreak',
      },

      headStyles: {
        fillColor: [239, 246, 255],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },

      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 19 },
        2: { cellWidth: 29 },
        3: { cellWidth: 13 },
        4: { cellWidth: 13 },
        5: { cellWidth: 14 },
        6: { cellWidth: 13 },
        7: { cellWidth: 21 },
        8: { cellWidth: 50 },
      },

      didDrawPage: () => {
        const pageNum = doc.getCurrentPageInfo().pageNumber
        const totalPages = doc.getNumberOfPages()
        const isLastPage = pageNum === totalPages

        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'normal')
        doc.setCharSpace(0)

        // =====================================================
        // HLAVIČKA LEN NA PRVEJ STRANE
        // =====================================================

        if (pageNum === 1) {
          try {
            doc.addImage(logoDataUrl, 'PNG', margin, 12, 18, 18)
          } catch {}

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10.5)

          doc.text('ITspot s. r. o.', pageWidth - margin, 16, {
            align: 'right',
          })

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)

          doc.text(
            'Hajles 1703/6, 968 01 Nova Bana',
            pageWidth - margin,
            20.5,
            { align: 'right' }
          )

          doc.text(
            'ICO: 56430388   DIC: 2122307462',
            pageWidth - margin,
            24.8,
            { align: 'right' }
          )

          doc.text(
            'IC DPH: SK2122307462',
            pageWidth - margin,
            29.1,
            { align: 'right' }
          )

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(18)

          doc.text('Servisny vykaz', margin, 38)

          doc.setFontSize(11)

          doc.text('Zakazka:', margin, 44)

          doc.setFont('helvetica', 'normal')

          doc.text(safeOrderName, margin + 20, 44)

          doc.setFont('helvetica', 'bold')

          doc.text('Zakaznik:', 105, 44)

          doc.setFont('helvetica', 'normal')

          doc.text(customerName || '-', 128, 44)

          doc.setFont('helvetica', 'bold')

          doc.text('Prijatie zakazky:', margin, 51)

          doc.setFont('helvetica', 'normal')

          doc.text(formatDate(order.prijatie_zakazky), margin + 33, 51)

          doc.setDrawColor(15, 23, 42)
          doc.setLineWidth(0.6)

          doc.line(margin, 57, pageWidth - margin, 57)

          doc.setDrawColor(203, 213, 225)

          doc.roundedRect(
            margin,
            61,
            pageWidth - margin * 2,
            10,
            2,
            2
          )

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)

          doc.text(`Pocet zaznamov: ${logs.length}`, margin + 4, 67.5)

          doc.text('|', 56, 67.5)

          doc.text(`Hodiny spolu: ${totalHours} h`, 62, 67.5)

          doc.text('|', 108, 67.5)

          doc.text(`Kilometre spolu: ${totalKm} km`, 114, 67.5)
        }

        // =====================================================
        // PODPIS + PEČIATKA LEN NA POSLEDNEJ STRANE
        // =====================================================

        if (isLastPage) {
          const signTitleY = pageHeight - 40
          const stampY = pageHeight - 33
          const lineY = pageHeight - 16

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)

          doc.text('Vystavil:', 52, signTitleY, {
            align: 'center',
          })

          doc.text('Prevzal zakaznik:', pageWidth - 52, signTitleY, {
            align: 'center',
          })

          if (stampDataUrl) {
            try {
              const stampFormat = stampDataUrl.includes('image/jpeg')
                ? 'JPEG'
                : stampDataUrl.includes('image/webp')
                ? 'WEBP'
                : 'PNG'

              doc.addImage(
                stampDataUrl,
                stampFormat,
                33,
                stampY,
                38,
                16
              )
            } catch {}
          }

          doc.setDrawColor(15, 23, 42)
          doc.setLineWidth(0.45)

          doc.line(margin, lineY, 94, lineY)

          doc.line(
            pageWidth - 94,
            lineY,
            pageWidth - margin,
            lineY
          )
        }

        // =====================================================
        // FOOTER NA VŠETKÝCH STRANÁCH
        // =====================================================

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)

        doc.text(
          'Vygenerovane z aplikacie ITspot',
          margin,
          pageHeight - 4
        )

        doc.text(
          `${pageNum}/${totalPages}`,
          pageWidth - margin,
          pageHeight - 4,
          {
            align: 'right',
          }
        )
      },
    })

    const safeName =
      safeOrderName.replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() ||
      'servisny-vykaz'

    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)

    const win = window.open(url, '_blank')

    if (!win) {
      const a = document.createElement('a')
      a.href = url
      a.download = `servisny-vykaz-${safeName}.pdf`
      a.click()
    }

    setNotice({
      type: 'success',
      text: 'PDF nahlad bol otvoreny.',
    })
  } catch (error) {
    console.error(error)

    setNotice({
      type: 'error',
      text:
        'Nepodarilo sa vygenerovať PDF. Skontroluj súbory v public/logo.png a public/stamp.png.',
    })
  }
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

    if (!workLogTitle.trim()) {
      setNotice({ type: 'error', text: 'Zadaj názov výkazu / zásahu.' })
      return
    }

    let hours = parseHoursInput(workLogHours)
    if ((!Number.isFinite(hours) || hours <= 0) && workLogStart && workLogEnd) {
      hours = calculateHoursFromTimes(workLogStart, workLogEnd)
      if (Number.isFinite(hours) && hours > 0) {
        setWorkLogHours(hours.toFixed(2))
      }
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      setNotice({ type: 'error', text: 'Zadaj platný počet hodín alebo použi štart/stop.' })
      return
    }

    const kilometres = parseHoursInput(workLogKm || '0')
    if (!Number.isFinite(kilometres) || kilometres < 0) {
      setNotice({ type: 'error', text: 'Zadaj platný počet kilometrov.' })
      return
    }

    if (workLogStart && workLogEnd && calculateHoursFromTimes(workLogStart, workLogEnd) !== calculateHoursFromTimes(workLogStart, workLogEnd)) {
      setNotice({ type: 'error', text: 'Stop musí byť neskôr ako štart.' })
      return
    }

    setSavingWorkLog(true)

    try {
      const payload = {
        user_id: userId,
        order_id: activeWorkLogOrderId,
        datum: workLogDate,
        nazov_vykazu: workLogTitle.trim(),
        start_time: workLogStart ? new Date(workLogStart).toISOString() : null,
        end_time: workLogEnd ? new Date(workLogEnd).toISOString() : null,
        praca_popis: workLogText.trim() || workLogTitle.trim(),
        hodiny: hours,
        kilometre: kilometres,
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

  function closeQuickStartModal() {
    setQuickStartOrderId('')
    setQuickStartTitle('')
    setOpenQuickStart(false)
  }

  function startQuickIntervention() {
    if (!quickStartOrderId) {
      setNotice({ type: 'error', text: 'Vyber zákazku.' })
      return
    }
    if (!quickStartTitle.trim()) {
      setNotice({ type: 'error', text: 'Zadaj názov zásahu.' })
      return
    }

    setActiveIntervention({
      orderId: quickStartOrderId,
      title: quickStartTitle.trim(),
      startedAt: new Date().toISOString(),
    })
    setRunningNowMs(Date.now())
    closeQuickStartModal()
    setNotice({ type: 'success', text: 'Zásah bol spustený.' })
  }

  function stopQuickIntervention() {
    if (!activeIntervention) return

    const stopLocal = getNowLocalInputValue()
    const startLocal = isoToLocalInputValue(activeIntervention.startedAt)
    const hours = calculateHoursFromTimes(startLocal, stopLocal)

    setActiveWorkLogOrderId(activeIntervention.orderId)
    resetWorkLogForm()
    setWorkLogDate(startLocal.slice(0, 10) || getTodayDate())
    setWorkLogTitle(activeIntervention.title)
    setWorkLogStart(startLocal)
    setWorkLogEnd(stopLocal)
    setWorkLogHours(Number.isFinite(hours) && hours > 0 ? hours.toFixed(2) : '')
    setOpenWorkLog(true)
    setActiveIntervention(null)
    setNotice({ type: 'success', text: 'Zásah bol zastavený. Doplň detail a ulož výkaz.' })
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

  function getOrderName(id: string) {
    return orders.find((o) => o.id === id)?.nazov || 'Neznáma zákazka'
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

  const totalKilometresByOrder = useMemo(() => {
    const totals: Record<string, number> = {}

    for (const log of workLogs) {
      const value = Number(log.kilometre || 0)
      totals[log.order_id] = (totals[log.order_id] || 0) + value
    }

    return totals
  }, [workLogs])

  function getOrderHours(orderId: string) {
    return Number(totalHoursByOrder[orderId] || 0)
  }

  function getOrderKilometres(orderId: string) {
    return Number(totalKilometresByOrder[orderId] || 0)
  }

  function exportOrderWorkLogs(orderId: string) {
    void exportOrderWorkLogsPdf(orderId)
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


  async function copyCustomerPortalLink(customerId: string) {
    const link = `https://app.itspot.sk/customer-portal?customer_id=${customerId}`

    try {
      await navigator.clipboard.writeText(link)
      setNotice({
        type: 'success',
        text: 'Link do zákazníckeho portálu bol skopírovaný.',
      })
    } catch {
      setNotice({
        type: 'error',
        text: 'Nepodarilo sa skopírovať link.',
      })
    }
  }

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)',
        padding: 12,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div className="layoutWrap" style={{ maxWidth: 1480, margin: '0 auto', display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 12 }}>
        <aside
          className="sidebarNav"
          style={{
            ...boxStyle,
            padding: 12,
            position: 'sticky',
            top: 12,
            alignSelf: 'start',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800, marginBottom: 4 }}>ITspot s.r.o.</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>Servis</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.35 }}>Zákazky, výkazy a dochádzka</div>
          </div>

          {!activeIntervention ? (
            <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 16, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Rýchly štart zásahu</div>

              <div style={{ display: 'grid', gap: 8 }}>
                <select
                  style={{ ...inputStyle, fontSize: 13 }}
                  value={quickStartOrderId}
                  onChange={(e) => setQuickStartOrderId(e.target.value)}
                >
                  <option value="">Vyber zákazku</option>
                  {activeOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nazov} — {getCustomerName(o.customer_id)}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  style={{ ...inputStyle, fontSize: 13 }}
                  placeholder="Názov zásahu"
                  value={quickStartTitle}
                  onChange={(e) => setQuickStartTitle(e.target.value)}
                />

                <button
                  type="button"
                  style={{ ...primaryButtonStyle, width: '100%', minHeight: 42 }}
                  onClick={startQuickIntervention}
                >
                  ▶ Spustiť zásah
                </button>

                {activeOrders.length === 0 && (
                  <div style={{ fontSize: 12, color: '#991b1b' }}>
                    Najprv vytvor aktívnu zákazku.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ border: '1px solid #86efac', background: '#f0fdf4', borderRadius: 16, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>Beží zásah</div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{getOrderName(activeIntervention.orderId)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#334155' }}>{activeIntervention.title}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
                {formatRunningDuration(activeIntervention.startedAt, runningNowMs)}
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                <button type="button" style={greenButtonStyle} onClick={stopQuickIntervention}>
                  ■ STOP a uložiť
                </button>
                <button type="button" style={buttonStyle} onClick={() => openWorkLogModal(activeIntervention.orderId)}>
                  Otvoriť detail
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
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

          <div style={{ display: 'grid', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              style={{ ...primaryButtonStyle, width: '100%', order: 1 }}
              onClick={() => {
                resetAddOrderForm()
                setOpenAddOrder(true)
              }}
            >
              + Nová zákazka
            </button>

            <Link href="/dochadzka" style={buttonStyle}>
              Dochádzka
            </Link>

            <Link href="/fakturovane" style={buttonStyle}>
              Fakturované / Stornované
            </Link>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => {
                resetAddCustomerForm()
                setOpenAddCustomer(true)
              }}
            >
              Nový zákazník
            </button>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => {
                resetEmployeeForm()
                setOpenAddEmployee(true)
              }}
            >
              Nový zamestnanec
            </button>

            <button
              type="button"
              style={{ ...buttonStyle, color: '#0f172a', fontWeight: 800 }}
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Odhlasujem...' : 'Odhlásiť'}
            </button>
          </div>
        </aside>

        <div>
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
          {/* 📋 KARTIČKA: ČAKAJÚCE POŽIADAVKY OD KLIENTOV */}
          <Link 
            href="/admin/requests" 
            style={{ 
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: pendingRequestsCount > 0 ? '#ffedd5' : '#ffffff',
              border: pendingRequestsCount > 0 ? '2px solid #ea580c' : '1px solid #cbd5e1',
              color: pendingRequestsCount > 0 ? '#c2410c' : '#475569',
              padding: '4px 10px', 
              borderRadius: '999px', 
              fontSize: '11px',
              fontWeight: 800,
              boxShadow: pendingRequestsCount > 0 ? '0 0 10px rgba(234, 88, 12, 0.15)' : 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              marginRight: '4px'
            }}
          >
            📋 Čaká na schválenie: <span style={{ 
              background: pendingRequestsCount > 0 ? '#ea580c' : '#64748b', 
              color: '#fff', 
              padding: '1px 6px', 
              borderRadius: '999px',
              fontSize: '10px',
              marginLeft: '3px'
            }}>{pendingRequestsCount}</span>
            {pendingRequestsCount > 0 && " 🔥"}
          </Link>
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
                                      <div><strong>Kilometre spolu:</strong> {getOrderKilometres(o.id).toFixed(0)} km</div>
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
                                              {formatDate(log.datum)} · {log.nazov_vykazu || 'Bez názvu'} · {Number(log.hodiny || 0).toFixed(1)} h · {Number(log.kilometre || 0).toFixed(0)} km
                                            </div>
                                            <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                                              {formatTimeShort(log.start_time)} – {formatTimeShort(log.end_time)}
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
                                    Export PDF
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
                      <th style={{ padding: '12px 10px' }}>ID / Portál</th>
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
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#475569',
                                wordBreak: 'break-all',
                              }}
                            >
                              {c.id}
                            </div>

                            <button
                              type="button"
                              style={{
                                ...buttonStyle,
                                fontSize: 12,
                              }}
                              onClick={() => copyCustomerPortalLink(c.id)}
                            >
                              Skopírovať ID link
                            </button>
                          </div>
                        </td>

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
                        <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
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

                    <div>
                      <strong>ID:</strong>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: '#475569',
                          wordBreak: 'break-all',
                        }}
                      >
                        {c.id}
                      </div>

                      <button
                        type="button"
                        style={{
                          ...buttonStyle,
                          marginTop: 8,
                          width: '100%',
                          fontSize: 12,
                        }}
                        onClick={() => copyCustomerPortalLink(c.id)}
                      >
                        Skopírovať ID link
                      </button>
                    </div>
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
                <div style={{ marginTop: 8, fontWeight: 800, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>Hodiny spolu: {getOrderHours(currentOrder.id).toFixed(1)} h</span>
                  <span>Kilometre spolu: {getOrderKilometres(currentOrder.id).toFixed(0)} km</span>
                  <span>Počet zásahov: {(workLogsByOrder[currentOrder.id] || []).length}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {currentOrder && (
                <>
                  <button type="button" style={buttonStyle} onClick={() => exportOrderWorkLogsPdf(currentOrder.id)}>
                    Export PDF
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
                  <label style={labelStyle} htmlFor="worklog-title">
                    Názov výkazu / zásahu
                  </label>
                  <input
                    id="worklog-title"
                    type="text"
                    style={inputStyle}
                    placeholder="Napr. Vzdialená konfigurácia"
                    value={workLogTitle}
                    onChange={(e) => setWorkLogTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-start">
                    Štart
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="worklog-start"
                      type="datetime-local"
                      style={inputStyle}
                      value={workLogStart}
                      onChange={(e) => setWorkLogStart(e.target.value)}
                    />
                    <button type="button" style={buttonStyle} onClick={setWorkLogStartNow}>
                      START
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-end">
                    Stop
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="worklog-end"
                      type="datetime-local"
                      style={inputStyle}
                      value={workLogEnd}
                      onChange={(e) => setWorkLogEnd(e.target.value)}
                    />
                    <button type="button" style={buttonStyle} onClick={setWorkLogEndNow}>
                      STOP
                    </button>
                  </div>
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
                    placeholder="Auto zo štart/stop alebo ručne"
                    value={workLogHours}
                    onChange={(e) => setWorkLogHours(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-km">
                    Kilometre
                  </label>
                  <input
                    id="worklog-km"
                    type="text"
                    inputMode="decimal"
                    style={inputStyle}
                    placeholder="Napr. 25"
                    value={workLogKm}
                    onChange={(e) => setWorkLogKm(e.target.value)}
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
                            {log.nazov_vykazu || 'Bez názvu výkazu'}
                          </div>
                          <div style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
                            {formatDate(log.datum)} · {formatTimeShort(log.start_time)} – {formatTimeShort(log.end_time)} · {Number(log.hodiny || 0).toFixed(2)} h · {Number(log.kilometre || 0).toFixed(0)} km
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

        .sidebarNav a {
          text-align: center;
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

        @media (max-width: 1100px) {
          .layoutWrap {
            grid-template-columns: 1fr !important;
          }

          .sidebarNav {
            position: static !important;
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