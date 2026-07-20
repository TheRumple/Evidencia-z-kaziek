'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BrandLogo } from '@/components/BrandLogo'
import { DashboardStyles } from '@/components/dashboard/DashboardStyles'
import { CalendarView } from '@/components/dashboard/CalendarView'
import { CustomersView } from '@/components/dashboard/CustomersView'
import { OrdersView } from '@/components/dashboard/OrdersView'
import { DashboardModals } from '@/components/dashboard/DashboardModals'
import type { CalendarPlan, Customer, Employee, Notice, Order, OrderSubtask, WorkLog } from '@/lib/dashboard-types'
import {
  AKTIVNE_STATUSY,
  STATUSY,
  calculateHoursFromTimes,
  downloadCsv,
  formatDate,
  formatTimeShort,
  getStatusBadgeStyle,
  getStatusCardBorder,
  getStatusLabel,
  getTodayDate,
  isoToLocalInputValue,
  loadFirstAvailableImage,
  parseHoursInput,
  pdfSafeText,
} from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
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
  const [calendarPlans, setCalendarPlans] = useState<CalendarPlan[]>([])
  const [subtasks, setSubtasks] = useState<OrderSubtask[]>([])
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({})

  const [activeTab, setActiveTab] = useState<'zakazky' | 'kalendar' | 'zakaznici'>('zakazky')
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
  const [selectedCustomerId, setSelectedCustomerId] = useState('vsetci')

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
        loadCalendarPlans(currentUserId),
        loadSubtasks(),
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

  async function loadCalendarPlans(currentUserId: string) {
    const { data, error } = await supabase
      .from('calendar_plans')
      .select('*')
      .eq('user_id', currentUserId)
      .order('plan_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      if (error.code === '42P01') {
        setCalendarPlans([])
        setNotice({
          type: 'error',
          text: 'Chýba tabuľka calendar_plans. Spusť SQL skript scripts/supabase-calendar-plans.sql v Supabase.',
        })
        return
      }

      setNotice({ type: 'error', text: `Kalendár: ${error.message}` })
      return
    }

    setCalendarPlans((data || []) as CalendarPlan[])
  }

  async function addCalendarPlan(input: {
    orderId: string
    planDate: string
    startTime: string
    endTime: string
    note: string
  }) {
    if (!userId) return
    if (!input.orderId || !input.planDate) {
      setNotice({ type: 'error', text: 'Vyber zákazku a dátum plánu.' })
      return
    }

    const { data, error } = await supabase
      .from('calendar_plans')
      .insert([
        {
          user_id: userId,
          order_id: input.orderId,
          plan_date: input.planDate,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note.trim() || null,
        },
      ])
      .select()
      .single()

    if (error) {
      setNotice({ type: 'error', text: `Plán sa neuložil: ${error.message}` })
      return
    }

    setCalendarPlans((current) =>
      [...current, data as CalendarPlan].sort((a, b) =>
        `${a.plan_date} ${a.start_time || ''}`.localeCompare(`${b.plan_date} ${b.start_time || ''}`)
      )
    )
    setNotice({ type: 'success', text: 'Plán bol uložený do kalendára.' })
  }

  async function deleteCalendarPlan(planId: string) {
    if (!window.confirm('Zmazať túto položku z pracovného plánu?')) return

    const previous = calendarPlans
    setCalendarPlans((current) => current.filter((plan) => plan.id !== planId))

    const { error } = await supabase.from('calendar_plans').delete().eq('id', planId).eq('user_id', userId)
    if (error) {
      setCalendarPlans(previous)
      setNotice({ type: 'error', text: `Plán sa nezmazal: ${error.message}` })
      return
    }

    setNotice({ type: 'success', text: 'Položka bola zmazaná z kalendára.' })
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


  async function loadSubtasks() {
    const { data, error } = await supabase
      .from('order_subtasks')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setNotice({ type: 'error', text: `Subtasks: ${error.message}` })
      return
    }

    setSubtasks((data || []) as OrderSubtask[])
  }

  async function addSubtask(orderId: string) {
    const textValue = (newSubtaskText[orderId] || '').trim()

    if (!textValue) return

    const { data, error } = await supabase
      .from('order_subtasks')
      .insert([
        {
          order_id: orderId,
          nazov: textValue,
          completed: false,
        },
      ])
      .select()
      .single()

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    if (data) {
      setSubtasks((curr) => [...curr, data as OrderSubtask])
      setNewSubtaskText((curr) => ({
        ...curr,
        [orderId]: '',
      }))
    }
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    const previous = subtasks

    setSubtasks((curr) =>
      curr.map((s) =>
        s.id === subtaskId ? { ...s, completed } : s
      )
    )

    const { error } = await supabase
      .from('order_subtasks')
      .update({ completed })
      .eq('id', subtaskId)

    if (error) {
      setSubtasks(previous)
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function deleteSubtask(subtaskId: string) {
    const previous = subtasks

    setSubtasks((curr) => curr.filter((s) => s.id !== subtaskId))

    const { error } = await supabase
      .from('order_subtasks')
      .delete()
      .eq('id', subtaskId)

    if (error) {
      setSubtasks(previous)
      setNotice({ type: 'error', text: error.message })
    }
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

  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'vsetci') return null
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  const customerSummaries = useMemo(() => {
    return customers
      .map((customer) => {
        const customerOrders = activeOrders.filter((o) => o.customer_id === customer.id)
        const openOrders = customerOrders.filter((o) => o.stav !== 'hotova')
        const overdueOrders = customerOrders.filter((o) => isOverdue(o))
        const hours = customerOrders.reduce((sum, order) => sum + getOrderHours(order.id), 0)
        const lastLogDate = customerOrders
          .flatMap((order) => workLogsByOrder[order.id] || [])
          .map((log) => log.datum || log.created_at || '')
          .sort()
          .at(-1)

        return {
          customer,
          total: customerOrders.length,
          open: openOrders.length,
          overdue: overdueOrders.length,
          hours,
          lastLogDate,
        }
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => {
        if (b.overdue !== a.overdue) return b.overdue - a.overdue
        if (b.open !== a.open) return b.open - a.open
        return a.customer.nazov.localeCompare(b.customer.nazov, 'sk')
      })
  }, [activeOrders, customers, workLogsByOrder, totalHoursByOrder])

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

      const matchesCustomer = selectedCustomerId === 'vsetci' ? true : o.customer_id === selectedCustomerId
      const matchesStatus = statusFilter === 'vsetky' ? true : o.stav === statusFilter
      return matchesSearch && matchesCustomer && matchesStatus
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
  }, [activeOrders, search, selectedCustomerId, statusFilter, sortBy, workLogsByOrder])

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


  async function copyPublicRequestLink() {
    const link = 'https://app.itspot.sk/ziadost'

    try {
      await navigator.clipboard.writeText(link)
      setNotice({
        type: 'success',
        text: 'Verejný formulár požiadaviek bol skopírovaný.',
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
      <div className="layoutWrap" style={{ maxWidth: 1380, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div>
          <div
            style={{
              ...boxStyle,
              marginBottom: 12,
              padding: 18,
              background: 'linear-gradient(135deg, #0f172a 0%, #243447 100%)',
              color: '#fff',
              border: 'none',
            }}
          >
            <div className="headerCompact">
              <div>
                <BrandLogo size="sm" tone="dark" style={{ marginBottom: 10 }} />
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
                  {selectedCustomer ? selectedCustomer.nazov : 'Servisné zákazky'}
                </h1>
                <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.78)', fontSize: 14 }}>
                  {selectedCustomer
                    ? 'Zákazky, poznámky a výkazy vybraného zákazníka.'
                    : 'Zoznam zákaziek, výkazy a poznámky.'}
                </div>
              </div>

              <div className="headerCompactActions">
                <Link
                  href="/admin/requests"
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: pendingRequestsCount > 0 ? '#ffedd5' : 'rgba(255,255,255,0.08)',
                    border: pendingRequestsCount > 0 ? '1px solid #fdba74' : '1px solid rgba(255,255,255,0.22)',
                    color: pendingRequestsCount > 0 ? '#9a3412' : '#fff',
                    padding: '9px 13px',
                    borderRadius: 12,
                    fontWeight: 900,
                  }}
                >
                  Žiadosti z portálu
                  <span
                    style={{
                      background: pendingRequestsCount > 0 ? '#ea580c' : 'rgba(255,255,255,0.18)',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 12,
                    }}
                  >
                    {pendingRequestsCount}
                  </span>
                </Link>

                <button
                  type="button"
                  style={{ ...primaryButtonStyle, minWidth: 150 }}
                  onClick={() => {
                    resetAddOrderForm()
                    setOpenAddOrder(true)
                  }}
                >
                  + Nová zákazka
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

        {activeTab === 'zakazky' && (
          <OrdersView
            boxStyle={boxStyle}
            buttonStyle={buttonStyle}
            customers={customers}
            dangerButtonStyle={dangerButtonStyle}
            deleteOrder={deleteOrder}
            expandedOrderIds={expandedOrderIds}
            exportOrderWorkLogs={exportOrderWorkLogs}
            filteredOrders={filteredOrders}
            getCustomerName={getCustomerName}
            getOrderKilometres={getOrderKilometres}
            greenButtonStyle={greenButtonStyle}
            groupedOrders={groupedOrders}
            inputStyle={inputStyle}
            isOverdue={isOverdue}
            isPinnedOrder={isPinnedOrder}
            labelStyle={labelStyle}
            openWorkLogModal={openWorkLogModal}
            search={search}
            selectedCustomerId={selectedCustomerId}
            setSearch={setSearch}
            setSelectedCustomerId={setSelectedCustomerId}
            setSortBy={setSortBy}
            setStatusFilter={setStatusFilter}
            sortBy={sortBy}
            startEditOrder={startEditOrder}
            statusFilter={statusFilter}
            toggleExpandedOrder={toggleExpandedOrder}
            togglePinnedOrder={togglePinnedOrder}
            updateOrderStatus={updateOrderStatus}
            workLogsByOrder={workLogsByOrder}
          />
        )}

        {activeTab === 'zakaznici' && (
          <CustomersView
            customers={customers}
            boxStyle={boxStyle}
            buttonStyle={buttonStyle}
            dangerButtonStyle={dangerButtonStyle}
            deleteCustomer={deleteCustomer}
            startEditCustomer={startEditCustomer}
          />
        )}

        {activeTab === 'kalendar' && (
          <CalendarView
            addCalendarPlan={addCalendarPlan}
            boxStyle={boxStyle}
            buttonStyle={buttonStyle}
            calendarPlans={calendarPlans}
            deleteCalendarPlan={deleteCalendarPlan}
            getCustomerName={getCustomerName}
            orders={orders}
            startEditOrder={startEditOrder}
          />
        )}

        <div
          style={{
            ...boxStyle,
            marginTop: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 800, marginBottom: 4 }}>
              Ostatné nastavenia
            </div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Navigácia a správa databázy</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={copyPublicRequestLink}>
              Skopírovať verejný formulár
            </button>

            <button type="button" style={tabButton(activeTab === 'zakazky')} onClick={() => setActiveTab('zakazky')}>
              Zákazky
            </button>

            <button type="button" style={tabButton(activeTab === 'kalendar')} onClick={() => setActiveTab('kalendar')}>
              Kalendár
            </button>

            <button type="button" style={tabButton(activeTab === 'zakaznici')} onClick={() => setActiveTab('zakaznici')}>
              Zákazníci / portál
            </button>

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
              + Nový zákazník
            </button>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => {
                resetEmployeeForm()
                setOpenAddEmployee(true)
              }}
            >
              + Nový zamestnanec
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
        </div>

        <DashboardModals
            addCustomer={addCustomer}
            addEmployee={addEmployee}
            addOrder={addOrder}
            addWorkLog={addWorkLog}
            buttonStyle={buttonStyle}
            calculateHoursFromTimes={calculateHoursFromTimes}
            closeAddCustomerModal={closeAddCustomerModal}
            closeAddEmployeeModal={closeAddEmployeeModal}
            closeAddOrderModal={closeAddOrderModal}
            closeEditCustomerModal={closeEditCustomerModal}
            closeEditEmployeeModal={closeEditEmployeeModal}
            closeEditOrderModal={closeEditOrderModal}
            closeWorkLogModal={closeWorkLogModal}
            currentOrder={currentOrder}
            currentOrderWorkLogs={currentOrderWorkLogs}
            customerId={customerId}
            customerMode={customerMode}
            customers={customers}
            dangerButtonStyle={dangerButtonStyle}
            deleteWorkLog={deleteWorkLog}
            editCustomerEmail={editCustomerEmail}
            editCustomerKontakt={editCustomerKontakt}
            editCustomerNazov={editCustomerNazov}
            editCustomerTelefon={editCustomerTelefon}
            editEmployeeCanDelete={editEmployeeCanDelete}
            editEmployeeEmail={editEmployeeEmail}
            editEmployeeName={editEmployeeName}
            editEmployeeTelefon={editEmployeeTelefon}
            editOrderCustomerId={editOrderCustomerId}
            editOrderNazov={editOrderNazov}
            editOrderPopis={editOrderPopis}
            editOrderPrijatieZakazky={editOrderPrijatieZakazky}
            editOrderTermin={editOrderTermin}
            editingWorkLogId={editingWorkLogId}
            email={email}
            employeeCanDelete={employeeCanDelete}
            employeeEmail={employeeEmail}
            employeeName={employeeName}
            employeeTelefon={employeeTelefon}
            employees={employees}
            exportOrderWorkLogsPdf={exportOrderWorkLogsPdf}
            formatDate={formatDate}
            formatTimeShort={formatTimeShort}
            getCustomerName={getCustomerName}
            getOrderHours={getOrderHours}
            getOrderKilometres={getOrderKilometres}
            greenButtonStyle={greenButtonStyle}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            kontakt={kontakt}
            nazov={nazov}
            newCustomerEmail={newCustomerEmail}
            newCustomerKontakt={newCustomerKontakt}
            newCustomerNazov={newCustomerNazov}
            newCustomerTelefon={newCustomerTelefon}
            openAddCustomer={openAddCustomer}
            openAddEmployee={openAddEmployee}
            openAddOrder={openAddOrder}
            openEditCustomer={openEditCustomer}
            openEditEmployee={openEditEmployee}
            openEditOrder={openEditOrder}
            openWorkLog={openWorkLog}
            orderNazov={orderNazov}
            orderPopis={orderPopis}
            orderPrijatieZakazky={orderPrijatieZakazky}
            orderTermin={orderTermin}
            primaryButtonStyle={primaryButtonStyle}
            resetWorkLogForm={resetWorkLogForm}
            saveCustomerEdit={saveCustomerEdit}
            saveEmployeeEdit={saveEmployeeEdit}
            saveOrderEdit={saveOrderEdit}
            savingCustomer={savingCustomer}
            savingEditCustomer={savingEditCustomer}
            savingEditEmployee={savingEditEmployee}
            savingEditOrder={savingEditOrder}
            savingEmployee={savingEmployee}
            savingOrder={savingOrder}
            savingWorkLog={savingWorkLog}
            secondaryDarkButtonStyle={secondaryDarkButtonStyle}
            setCustomerId={setCustomerId}
            setCustomerMode={setCustomerMode}
            setEditCustomerEmail={setEditCustomerEmail}
            setEditCustomerKontakt={setEditCustomerKontakt}
            setEditCustomerNazov={setEditCustomerNazov}
            setEditCustomerTelefon={setEditCustomerTelefon}
            setEditEmployeeCanDelete={setEditEmployeeCanDelete}
            setEditEmployeeEmail={setEditEmployeeEmail}
            setEditEmployeeName={setEditEmployeeName}
            setEditEmployeeTelefon={setEditEmployeeTelefon}
            setEditOrderCustomerId={setEditOrderCustomerId}
            setEditOrderNazov={setEditOrderNazov}
            setEditOrderPopis={setEditOrderPopis}
            setEditOrderPrijatieZakazky={setEditOrderPrijatieZakazky}
            setEditOrderTermin={setEditOrderTermin}
            setEmail={setEmail}
            setEmployeeCanDelete={setEmployeeCanDelete}
            setEmployeeEmail={setEmployeeEmail}
            setEmployeeName={setEmployeeName}
            setEmployeeTelefon={setEmployeeTelefon}
            setKontakt={setKontakt}
            setNazov={setNazov}
            setNewCustomerEmail={setNewCustomerEmail}
            setNewCustomerKontakt={setNewCustomerKontakt}
            setNewCustomerNazov={setNewCustomerNazov}
            setNewCustomerTelefon={setNewCustomerTelefon}
            setOrderNazov={setOrderNazov}
            setOrderPopis={setOrderPopis}
            setOrderPrijatieZakazky={setOrderPrijatieZakazky}
            setOrderTermin={setOrderTermin}
            setTelefon={setTelefon}
            setWorkLogDate={setWorkLogDate}
            setWorkLogEnd={setWorkLogEnd}
            setWorkLogHours={setWorkLogHours}
            setWorkLogKm={setWorkLogKm}
            setWorkLogStart={setWorkLogStart}
            setWorkLogText={setWorkLogText}
            setWorkLogTitle={setWorkLogTitle}
            startEditWorkLog={startEditWorkLog}
            STATUSY={STATUSY}
            telefon={telefon}
            toggleWorkLogEmployee={toggleWorkLogEmployee}
            workLogDate={workLogDate}
            workLogEmployees={workLogEmployees}
            workLogEnd={workLogEnd}
            workLogHours={workLogHours}
            workLogKm={workLogKm}
            workLogStart={workLogStart}
            workLogText={workLogText}
            workLogTitle={workLogTitle}
            workLogsByOrder={workLogsByOrder}
        />

        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 18 }}>
            Načítavam dáta...
          </div>
        )}
        </div>
      </div>

      <DashboardStyles />

    </div>
  )
}
