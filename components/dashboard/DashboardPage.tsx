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
import type { CalendarPlan, Customer, CustomerContact, CustomerContactCustomer, CustomerUpdate, Employee, Notice, Order, OrderSubtask, WorkLog } from '@/lib/dashboard-types'
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

function getRequesterFromDescription(description: string | null | undefined) {
  return description?.match(/^Žiadateľ:\s*(.+)$/im)?.[1]?.trim() || ''
}

function stripRequesterFromDescription(description: string | null | undefined) {
  return (description || '')
    .split('\n')
    .filter((line) => !/^Žiadateľ:/i.test(line.trim()))
    .join('\n')
    .trim()
}

function composeOrderDescription(requester: string, description: string) {
  return [requester.trim() ? `Žiadateľ: ${requester.trim()}` : '', description.trim()]
    .filter(Boolean)
    .join('\n')
}

function getPortalCodeErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return ''
  const message = error.message || ''
  if (error.code === '23505' && /email/i.test(message)) {
    return 'Kontakt s týmto emailom už existuje.'
  }
  if (error.code === '23505' || /portal_code|duplicate key|already exists|heslo už existuje|pin už existuje/i.test(message)) {
    return 'PIN už existuje. Zadaj iný 4-miestny PIN.'
  }
  return message
}

type DeliveryProtocolItem = {
  id: string
  name: string
  serialNumber: string
  quantity: string
  note: string
}

function createDeliveryProtocolItem(): DeliveryProtocolItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    serialNumber: '',
    quantity: '1',
    note: '',
  }
}

function createDeliveryProtocolItems(count = 8) {
  return Array.from({ length: count }, () => createDeliveryProtocolItem())
}

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
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [customerUpdates, setCustomerUpdates] = useState<CustomerUpdate[]>([])
  const [calendarPlans, setCalendarPlans] = useState<CalendarPlan[]>([])
  const [subtasks, setSubtasks] = useState<OrderSubtask[]>([])
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({})

  const [activeTab, setActiveTab] = useState<'zakazky' | 'kalendar' | 'zakaznici'>('zakazky')
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([])
  const [pinnedOrderIds, setPinnedOrderIds] = useState<string[]>([])
  const [seenCustomerUpdateIds, setSeenCustomerUpdateIds] = useState<string[]>([])

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
  const [orderRequester, setOrderRequester] = useState('')
  const [orderRequesterEmail, setOrderRequesterEmail] = useState('')
  const [orderPopis, setOrderPopis] = useState('')
  const [orderPublicMessage, setOrderPublicMessage] = useState('')
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
  const [contactCustomerIds, setContactCustomerIds] = useState<string[]>([])
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactPortalCode, setContactPortalCode] = useState('')
  const [contactRole, setContactRole] = useState<'owner' | 'user'>('user')
  const [savingContact, setSavingContact] = useState(false)

  const [editOrderId, setEditOrderId] = useState('')
  const [editOrderNazov, setEditOrderNazov] = useState('')
  const [editOrderCustomerId, setEditOrderCustomerId] = useState('')
  const [editOrderRequester, setEditOrderRequester] = useState('')
  const [editOrderRequesterEmail, setEditOrderRequesterEmail] = useState('')
  const [editOrderPopis, setEditOrderPopis] = useState('')
  const [editOrderPublicMessage, setEditOrderPublicMessage] = useState('')
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

  const [deliveryProtocolNumber, setDeliveryProtocolNumber] = useState('')
  const [deliveryProtocolDate, setDeliveryProtocolDate] = useState(getTodayDate())
  const [deliveryProtocolCustomer, setDeliveryProtocolCustomer] = useState('')
  const [deliveryProtocolDeliveredBy, setDeliveryProtocolDeliveredBy] = useState('')
  const [deliveryProtocolReceivedBy, setDeliveryProtocolReceivedBy] = useState('')
  const [deliveryProtocolTested, setDeliveryProtocolTested] = useState(true)
  const [deliveryProtocolBriefed, setDeliveryProtocolBriefed] = useState(true)
  const [deliveryProtocolItems, setDeliveryProtocolItems] = useState<DeliveryProtocolItem[]>(() => createDeliveryProtocolItems())

  const [openAddCustomer, setOpenAddCustomer] = useState(false)
  const [openAddOrder, setOpenAddOrder] = useState(false)
  const [openEditCustomer, setOpenEditCustomer] = useState(false)
  const [openEditOrder, setOpenEditOrder] = useState(false)
  const [openAddEmployee, setOpenAddEmployee] = useState(false)
  const [openEditEmployee, setOpenEditEmployee] = useState(false)
  const [openWorkLog, setOpenWorkLog] = useState(false)
  const [openDeliveryProtocol, setOpenDeliveryProtocol] = useState(false)

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
    if (!userId) return

    const timer = window.setInterval(() => {
      void refreshLiveData(userId)
    }, 20000)

    return () => window.clearInterval(timer)
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
    try {
      const storedSeen = window.localStorage.getItem('customer-updates-seen-v1')
      if (storedSeen) {
        const parsed = JSON.parse(storedSeen)
        if (Array.isArray(parsed)) {
          setSeenCustomerUpdateIds(parsed.filter((item): item is string => typeof item === 'string'))
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('customer-updates-seen-v1', JSON.stringify(seenCustomerUpdateIds))
  }, [seenCustomerUpdateIds])

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
        loadCustomerContacts(currentUserId),
      ])

      await Promise.allSettled([
        loadOrders(currentUserId),
        loadEmployees(currentUserId),
        loadWorkLogs(currentUserId),
        loadCustomerUpdates(currentUserId),
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

  async function loadCustomerContacts(currentUserId: string) {
    const { data: contactsData, error: contactsError } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('user_id', currentUserId)
      .order('name', { ascending: true })

    if (contactsError) {
      if (contactsError.code === '42P01') {
        setCustomerContacts([])
        return
      }
      setNotice({ type: 'error', text: `Kontakty zákazníkov: ${contactsError.message}` })
      return
    }

    const contacts = (contactsData || []) as CustomerContact[]
    const contactIds = contacts.map((contact) => contact.id)
    if (contactIds.length === 0) {
      setCustomerContacts([])
      return
    }

    const { data: linkData, error: linkError } = await supabase
      .from('customer_contact_customers')
      .select('id, contact_id, customer_id, role, created_at')
      .in('contact_id', contactIds)

    if (linkError) {
      setNotice({ type: 'error', text: `Priradené firmy ku kontaktom: ${linkError.message}` })
      setCustomerContacts(contacts.map((contact) => ({ ...contact, customers: [] })))
      return
    }

    setCustomerContacts(
      contacts.map((contact) => ({
        ...contact,
        customers: (linkData || []).filter((link) => link.contact_id === contact.id),
      }))
    )
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

  async function loadCustomerUpdates(currentUserId: string) {
    const { data, error } = await supabase
      .from('customer_order_updates')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code !== '42P01') {
        setNotice({ type: 'error', text: `Doplnenia zákazníkov: ${error.message}` })
      }
      return
    }

    setCustomerUpdates((data || []) as CustomerUpdate[])
  }

  async function refreshLiveData(currentUserId: string) {
    try {
      await Promise.allSettled([
        loadCustomers(currentUserId),
        loadCustomerContacts(currentUserId),
        loadOrders(currentUserId),
        loadWorkLogs(currentUserId),
        loadCustomerUpdates(currentUserId),
        loadCalendarPlans(currentUserId),
        loadPendingCount(),
      ])
    } catch (error) {
      console.error('Live refresh error:', error)
    }
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
    orderId?: string
    title?: string
    planDate: string
    startTime: string
    endTime: string
    note: string
  }) {
    if (!userId) return
    if (!input.planDate) {
      setNotice({ type: 'error', text: 'Vyber dátum plánu.' })
      return
    }

    if (!input.orderId && !input.title?.trim()) {
      setNotice({ type: 'error', text: 'Vyber zákazku alebo zadaj názov úlohy.' })
      return
    }

    const { data, error } = await supabase
      .from('calendar_plans')
      .insert([
        {
          user_id: userId,
          order_id: input.orderId || null,
          title: input.title?.trim() || null,
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

  async function updateCalendarPlan(planId: string, changes: Partial<Pick<CalendarPlan, 'plan_date' | 'start_time' | 'end_time' | 'note' | 'title'>>) {
    const previous = calendarPlans
    setCalendarPlans((current) =>
      current
        .map((plan) => (plan.id === planId ? { ...plan, ...changes } : plan))
        .sort((a, b) => `${a.plan_date} ${a.start_time || ''}`.localeCompare(`${b.plan_date} ${b.start_time || ''}`))
    )

    const { error } = await supabase
      .from('calendar_plans')
      .update({
        plan_date: changes.plan_date,
        start_time: changes.start_time,
        end_time: changes.end_time,
        note: changes.note,
        title: changes.title,
      })
      .eq('id', planId)
      .eq('user_id', userId)

    if (error) {
      setCalendarPlans(previous)
      setNotice({ type: 'error', text: `Plán sa neupravil: ${error.message}` })
      return
    }

    setNotice({ type: 'success', text: 'Plán bol upravený.' })
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
    setOrderRequester('')
    setOrderRequesterEmail('')
    setOrderPopis('')
    setOrderPublicMessage('')
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
    setEditOrderRequester('')
    setEditOrderRequesterEmail('')
    setEditOrderPopis('')
    setEditOrderPublicMessage('')
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

  function resetDeliveryProtocolForm() {
    setDeliveryProtocolNumber('')
    setDeliveryProtocolDate(getTodayDate())
    setDeliveryProtocolCustomer('')
    setDeliveryProtocolDeliveredBy('')
    setDeliveryProtocolReceivedBy('')
    setDeliveryProtocolTested(true)
    setDeliveryProtocolBriefed(true)
    setDeliveryProtocolItems(createDeliveryProtocolItems())
  }

  function closeDeliveryProtocolModal() {
    resetDeliveryProtocolForm()
    setOpenDeliveryProtocol(false)
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

  function resetContactForm(customerIdValue = '') {
    setContactCustomerIds(customerIdValue ? [customerIdValue] : [])
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setContactPortalCode('')
    setContactRole('user')
  }

  async function addCustomerContact(targetCustomerIds = contactCustomerIds) {
    const uniqueCustomerIds = Array.from(new Set(targetCustomerIds.filter(Boolean)))
    if (!userId || uniqueCustomerIds.length === 0) {
      setNotice({ type: 'error', text: 'Vyber aspoň jednu firmu pre kontakt.' })
      return
    }

    if (!contactName.trim()) {
      setNotice({ type: 'error', text: 'Zadaj meno kontaktu.' })
      return
    }

    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      setNotice({ type: 'error', text: 'Zadaj platný email kontaktu. Pod týmto emailom sa bude prihlasovať.' })
      return
    }

    const cleanPortalCode = contactPortalCode.replace(/\D/g, '')
    if (cleanPortalCode && cleanPortalCode.length !== 4) {
      setNotice({ type: 'error', text: 'PIN kontaktu musí mať presne 4 číslice.' })
      return
    }

    setSavingContact(true)

    const { data: contact, error: contactError } = await supabase
      .from('customer_contacts')
      .insert([
        {
          user_id: userId,
          name: contactName.trim(),
          email: contactEmail.trim() || null,
          phone: contactPhone.trim() || null,
          portal_code: cleanPortalCode || null,
        },
      ])
      .select()
      .single()

    if (contactError || !contact) {
      setSavingContact(false)
      setNotice({ type: 'error', text: getPortalCodeErrorMessage(contactError) || 'Nepodarilo sa vytvoriť kontakt.' })
      return
    }

    const { error: linkError } = await supabase
      .from('customer_contact_customers')
      .insert(uniqueCustomerIds.map((customerIdValue) => ({
        contact_id: contact.id,
        customer_id: customerIdValue,
        role: contactRole,
      })))

    setSavingContact(false)

    if (linkError) {
      await supabase.from('customer_contacts').delete().eq('id', contact.id).eq('user_id', userId)
      setNotice({ type: 'error', text: linkError.message })
      return
    }

    await loadCustomerContacts(userId)
    resetContactForm()
    setNotice({ type: 'success', text: 'Kontakt bol pridaný k zákazníkovi.' })
  }

  async function deleteCustomerContact(contactId: string) {
    if (!userId) return
    if (!window.confirm('Naozaj chceš zmazať tento kontakt?')) return

    const previousContacts = customerContacts
    setCustomerContacts((current) => current.filter((contact) => contact.id !== contactId))

    const { error } = await supabase
      .from('customer_contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId)

    if (error) {
      setCustomerContacts(previousContacts)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Kontakt bol zmazaný.' })
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
          popis: composeOrderDescription(orderRequester, orderPopis) || null,
          requester_email: orderRequesterEmail.trim().toLowerCase() || null,
          public_message: orderPublicMessage.trim() || null,
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

    const progressChange = stav === 'hotova' ? { progress_percent: 100 } : {}
    const previous = orders
    setOrders((curr) => curr.map((o) => (o.id === orderId ? { ...o, stav, ...progressChange } : o)))

    const { error } = await supabase
      .from('orders')
      .update({ stav, ...progressChange })
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) {
      setOrders(previous)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Stav zákazky bol aktualizovaný.' })
  }

  async function updateOrderProgress(orderId: string, progressPercent: number) {
    if (!userId) return

    const normalizedProgress = Math.max(0, Math.min(100, Math.round(progressPercent / 10) * 10))
    const previous = orders
    setOrders((curr) => curr.map((o) => (o.id === orderId ? { ...o, progress_percent: normalizedProgress } : o)))

    const { error } = await supabase
      .from('orders')
      .update({ progress_percent: normalizedProgress })
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) {
      setOrders(previous)
      setNotice({ type: 'error', text: error.message })
      return
    }
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

  async function deleteCustomerUpdate(updateId: string) {
    if (!userId) return
    if (!window.confirm('Zmazať túto poznámku od zákazníka?')) return

    const previousUpdates = customerUpdates
    setCustomerUpdates((current) => current.filter((update) => update.id !== updateId))
    setSeenCustomerUpdateIds((current) => current.filter((id) => id !== updateId))

    const { error } = await supabase
      .from('customer_order_updates')
      .delete()
      .eq('id', updateId)
      .eq('user_id', userId)

    if (error) {
      setCustomerUpdates(previousUpdates)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Poznámka od zákazníka bola zmazaná.' })
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
      setNotice({ type: 'error', text: getPortalCodeErrorMessage(error) || error.message })
      return
    }

    await loadCustomers(userId)
    setNotice({ type: 'success', text: 'Zákazník bol upravený.' })
    closeEditCustomerModal()
  }

  function startEditOrder(o: Order) {
    setEditOrderId(o.id)
    setEditOrderNazov(o.nazov || '')
    setEditOrderCustomerId(o.customer_id || '')
    setEditOrderRequester(getRequesterFromDescription(o.popis))
    setEditOrderRequesterEmail(o.requester_email || o.popis?.match(/^Email:\s*(.+)$/im)?.[1]?.trim() || '')
    setEditOrderPopis(stripRequesterFromDescription(o.popis))
    setEditOrderPublicMessage(o.public_message || '')
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
      popis: composeOrderDescription(editOrderRequester, editOrderPopis) || null,
      requester_email: editOrderRequesterEmail.trim().toLowerCase() || null,
      public_message: editOrderPublicMessage.trim() || null,
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

  function openDeliveryProtocolModal() {
    const today = getTodayDate()
    setDeliveryProtocolNumber(`OP-${today.replaceAll('-', '')}`)
    setDeliveryProtocolDate(today)
    setDeliveryProtocolCustomer('')
    setDeliveryProtocolDeliveredBy(employees[0]?.name || '')
    setDeliveryProtocolReceivedBy('')
    setDeliveryProtocolTested(true)
    setDeliveryProtocolBriefed(true)
    setDeliveryProtocolItems(createDeliveryProtocolItems())
    setOpenDeliveryProtocol(true)
  }

  function updateDeliveryProtocolItem(index: number, field: keyof Omit<DeliveryProtocolItem, 'id'>, value: string) {
    setDeliveryProtocolItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    )
  }

  function addDeliveryProtocolItem() {
    setDeliveryProtocolItems((current) => [...current, createDeliveryProtocolItem()])
  }

  function removeDeliveryProtocolItem(index: number) {
    setDeliveryProtocolItems((current) => (current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))
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

  async function exportDeliveryProtocolPdf() {
    const filledItems = deliveryProtocolItems.filter(
      (item) => item.name.trim() || item.serialNumber.trim() || item.quantity.trim() || item.note.trim()
    )

    if (filledItems.length === 0) {
      setNotice({ type: 'error', text: 'Doplň aspoň jednu odovzdávanú položku.' })
      return
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 14
      const protocolNumber = pdfSafeText(deliveryProtocolNumber || `OP-${deliveryProtocolDate.replaceAll('-', '')}`)
      const customerName = pdfSafeText(deliveryProtocolCustomer)
      const deliveryDate = formatDate(deliveryProtocolDate)
      const deliveredBy = pdfSafeText(deliveryProtocolDeliveredBy)
      const receivedBy = pdfSafeText(deliveryProtocolReceivedBy)

      function drawItspotLogo(x: number, y: number) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(35)
        doc.setTextColor(0, 0, 0)
        doc.text('ITspot', x, y)
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.8)
        doc.line(margin, y + 14, pageWidth - margin, y + 14)
      }

      function drawHeader(pageNumber: number) {
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'normal')
        doc.setCharSpace(0)

        if (pageNumber === 1) {
          drawItspotLogo(margin, 29)

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text('ITspot s. r. o.', pageWidth - margin, 16, { align: 'right' })
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.text('Hajles 1703/6, 968 01 Nova Bana', pageWidth - margin, 20.5, { align: 'right' })
          doc.text('ICO: 56430388', pageWidth - margin, 25, { align: 'right' })
          doc.text('IC DPH: SK2122307462', pageWidth - margin, 29.5, { align: 'right' })
        }
      }

      function drawFooter(pageNumber: number, totalPages: number) {
        doc.setTextColor(100, 116, 139)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text('info@itspot.sk | +421 908 806 691 | www.itspot.sk', margin, pageHeight - 5)
        doc.text('Vygenerovane z aplikacie ITspot', pageWidth / 2, pageHeight - 5, { align: 'center' })
        doc.text(`Strana ${pageNumber} z ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
      }

      drawHeader(1)

      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('ODOVZDAVACI PROTOKOL', margin, 52)

      doc.setFontSize(10)
      doc.text('Cislo protokolu:', margin, 61)
      doc.setFont('helvetica', 'normal')
      doc.text(protocolNumber || '-', margin + 33, 61)

      doc.setFont('helvetica', 'bold')
      doc.text('Zakaznik:', margin, 72)
      doc.text('Datum odovzdania:', 112, 72)
      doc.setFont('helvetica', 'normal')
      doc.text(customerName, margin, 78)
      doc.text(deliveryDate || '-', 112, 78)

      doc.setDrawColor(15, 23, 42)
      doc.setLineWidth(0.4)
      doc.line(margin, 86, pageWidth - margin, 86)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('ZOZNAM ODOVZDANEJ TECHNIKY A PRISLUSENSTVA', margin, 95)

      autoTable(doc, {
        startY: 100,
        margin: { left: margin, right: margin, bottom: 54 },
        head: [['P. c.', 'Zariadenie / polozka', 'Seriove cislo (S/N)', 'Ks', 'Poznamka']],
        body: filledItems.map((item, index) => [
          String(index + 1),
          pdfSafeText(item.name || '-'),
          pdfSafeText(item.serialNumber || '-'),
          pdfSafeText(item.quantity || '1'),
          pdfSafeText(item.note || ''),
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
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 63 },
          2: { cellWidth: 42 },
          3: { cellWidth: 13, halign: 'center' },
          4: { cellWidth: 42 },
        },
      })

      const finalTableY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 130
      const confirmationY = Math.min(finalTableY + 12, pageHeight - 76)

      if (confirmationY > pageHeight - 86) {
        doc.addPage()
      }

      const footerStartY = doc.getCurrentPageInfo().pageNumber === 1 ? confirmationY : 28
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('POTVRDENIE', margin, footerStartY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`${deliveryProtocolTested ? '[x]' : '[ ]'} Zariadenie bolo odskusane a je funkcne.`, margin, footerStartY + 8)
      doc.text(`${deliveryProtocolBriefed ? '[x]' : '[ ]'} Zakaznik bol oboznameny so zakladnou obsluhou.`, margin, footerStartY + 15)

      const signatureY = footerStartY + 34
      doc.setFont('helvetica', 'bold')
      doc.text('ODOVZDAL', margin, signatureY)
      doc.text('PREVZAL', 112, signatureY)
      doc.setFont('helvetica', 'normal')
      doc.text(`Meno: ${deliveredBy}`, margin, signatureY + 10)
      doc.text(`Meno: ${receivedBy}`, 112, signatureY + 10)
      doc.line(margin, signatureY + 28, 88, signatureY + 28)
      doc.line(112, signatureY + 28, pageWidth - margin, signatureY + 28)
      doc.setFontSize(8)
      doc.text('Podpis', margin, signatureY + 33)
      doc.text('Podpis', 112, signatureY + 33)

      const totalPages = doc.getNumberOfPages()
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page)
        drawHeader(page)
        drawFooter(page, totalPages)
      }

      const safeName = pdfSafeText(`${protocolNumber}-${customerName}`).replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() || 'odovzdavaci-protokol'
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')

      if (!win) {
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeName}.pdf`
        a.click()
      }

      setNotice({ type: 'success', text: 'Odovzdávací protokol bol otvorený.' })
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Neznáma chyba.'
      setNotice({ type: 'error', text: `Protokol sa nepodarilo vytvoriť: ${message}` })
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

  const customerUpdatesByOrder = useMemo(() => {
    const grouped: Record<string, CustomerUpdate[]> = {}

    for (const update of customerUpdates) {
      if (!grouped[update.order_id]) grouped[update.order_id] = []
      grouped[update.order_id].push(update)
    }

    return grouped
  }, [customerUpdates])

  const unseenCustomerUpdateIds = useMemo(() => {
    const seen = new Set(seenCustomerUpdateIds)
    return customerUpdates.filter((update) => !update.seen_at && !seen.has(update.id)).map((update) => update.id)
  }, [customerUpdates, seenCustomerUpdateIds])

  const unseenCustomerUpdatesByOrder = useMemo(() => {
    const unseen = new Set(unseenCustomerUpdateIds)
    const grouped: Record<string, number> = {}

    for (const update of customerUpdates) {
      if (unseen.has(update.id)) grouped[update.order_id] = (grouped[update.order_id] || 0) + 1
    }

    return grouped
  }, [customerUpdates, unseenCustomerUpdateIds])

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
        : [o.nazov, o.popis || '', o.public_message || '', customerName, workLogTextCombined]
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
        key: 'cenova_ponuka',
        title: 'Cenová ponuka',
        description: 'Zákazky, kde sa pripravuje alebo čaká cenová ponuka.',
        items: rest.filter((o) => o.stav === 'cenova_ponuka' && !isOverdue(o)),
      },
      {
        key: 'obhliadka',
        title: 'Obhliadka',
        description: 'Zákazky, kde je potrebná obhliadka u zákazníka.',
        items: rest.filter((o) => o.stav === 'obhliadka' && !isOverdue(o)),
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
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid rgba(226,232,240,0.86)',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 16px 42px rgba(15, 23, 42, 0.10)',
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
    borderRadius: 11,
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
    background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
    color: '#111827',
    border: '1px solid #65a30d',
    minHeight: 40,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 900,
    boxShadow: '0 12px 26px rgba(132, 204, 22, 0.28)',
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

  const sideNavButton = (active = false): CSSProperties => ({
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: active ? '1px solid rgba(132, 204, 22, 0.7)' : '1px solid transparent',
    background: active ? 'rgba(132, 204, 22, 0.16)' : 'transparent',
    color: active ? '#ecfccb' : 'rgba(226,232,240,0.86)',
    cursor: 'pointer',
    fontWeight: 900,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '9px 10px',
    textAlign: 'left',
    fontSize: 13,
  })

  const sideUtilityButton: CSSProperties = {
    ...sideNavButton(false),
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(148,163,184,0.18)',
    color: '#f8fafc',
  }

  async function markCustomerUpdatesSeen(orderId: string) {
    const updatesForOrder = (customerUpdatesByOrder[orderId] || []).filter((update) => !update.seen_at)
    const updateIdsForOrder = updatesForOrder.map((update) => update.id)
    if (updateIdsForOrder.length === 0) return

    const seenAt = new Date().toISOString()
    setSeenCustomerUpdateIds((current) => Array.from(new Set([...current, ...updateIdsForOrder])))
    setCustomerUpdates((current) =>
      current.map((update) => (updateIdsForOrder.includes(update.id) ? { ...update, seen_at: seenAt } : update))
    )

    const { error } = await supabase
      .from('customer_order_updates')
      .update({ seen_at: seenAt })
      .in('id', updateIdsForOrder)
      .eq('user_id', userId)

    if (error) {
      console.error('CUSTOMER UPDATE SEEN ERROR:', error)
      setNotice({
        type: 'error',
        text: error.code === '42703'
          ? 'Chýba stĺpec seen_at. Spusť SQL skript scripts/supabase-customer-updates-seen.sql v Supabase.'
          : `Úprava sa neoznačila ako videná: ${error.message}`,
      })
    }
  }

  function toggleExpandedOrder(orderId: string) {
    setExpandedOrderIds((curr) => {
      const willOpen = !curr.includes(orderId)
      if (willOpen) void markCustomerUpdatesSeen(orderId)
      return willOpen ? [orderId] : []
    })
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
        background:
          'radial-gradient(circle at 74% -10%, rgba(132,204,22,0.18), transparent 30%), linear-gradient(180deg, #060a12 0%, #111827 280px, #eef4ff 281px, #f8fafc 100%)',
        padding: 12,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div className="layoutWrap appShell" style={{ maxWidth: 1480, margin: '0 auto', display: 'grid', gridTemplateColumns: '230px minmax(0, 1fr)', gap: 14 }}>
        <aside className="sideMenu">
          <div>
            <BrandLogo size="md" tone="dark" style={{ marginBottom: 12 }} />
            <div className="sideMenuTitle">Servisné centrum</div>
            <div className="sideMenuSubTitle">ITspot evidencia</div>
          </div>

          <Link
            className={pendingRequestsCount > 0 ? 'portalRequestShortcut portalRequestShortcutAlert' : 'portalRequestShortcut'}
            href="/admin/requests"
          >
            <span>Žiadosti z portálu</span>
            <span className={pendingRequestsCount > 0 ? 'sideMenuBadge sideMenuBadgeAlert' : 'sideMenuBadge'}>
              {pendingRequestsCount}
            </span>
          </Link>

          <nav className="sideMenuNav" aria-label="Hlavná navigácia">
            <button type="button" style={sideNavButton(activeTab === 'zakazky')} onClick={() => setActiveTab('zakazky')}>
              <span>Zákazky</span>
              <span className="sideMenuBadge">{orders.filter((order) => AKTIVNE_STATUSY.includes(order.stav)).length}</span>
            </button>

            <button type="button" style={sideNavButton(unseenCustomerUpdateIds.length > 0)} onClick={() => setActiveTab('zakazky')}>
              <span>Úpravy od zákazníkov</span>
              <span className={unseenCustomerUpdateIds.length > 0 ? 'sideMenuBadge sideMenuBadgeAlert' : 'sideMenuBadge'}>
                {unseenCustomerUpdateIds.length}
              </span>
            </button>

            <Link href="/admin/requests" style={sideNavButton(pendingRequestsCount > 0)}>
              <span>Žiadosti</span>
              <span className={pendingRequestsCount > 0 ? 'sideMenuBadge sideMenuBadgeAlert' : 'sideMenuBadge'}>
                {pendingRequestsCount}
              </span>
            </Link>

            <button type="button" style={sideNavButton(activeTab === 'kalendar')} onClick={() => setActiveTab('kalendar')}>
              <span>Kalendár</span>
              <span className="sideMenuIcon">›</span>
            </button>

            <Link href="/mesacny-vykaz" style={sideNavButton(false)}>
              <span>Mesačný výkaz</span>
              <span className="sideMenuIcon">›</span>
            </Link>

            <Link href="/revizie" style={sideNavButton(false)}>
              <span>Revízie</span>
              <span className="sideMenuIcon">›</span>
            </Link>

            <button type="button" style={sideNavButton(false)} onClick={openDeliveryProtocolModal}>
              <span>Odovzdávací protokol</span>
              <span className="sideMenuIcon">›</span>
            </button>

            <Link href="/kancelaria" style={sideNavButton(false)}>
              <span>Kancelária</span>
              <span className="sideMenuIcon">›</span>
            </Link>

            <button type="button" style={sideNavButton(activeTab === 'zakaznici')} onClick={() => setActiveTab('zakaznici')}>
              <span>Zákazníci</span>
              <span className="sideMenuIcon">›</span>
            </button>

            <Link href="/fakturovane" style={sideNavButton(false)}>
              <span>Fakturované</span>
              <span className="sideMenuIcon">›</span>
            </Link>
          </nav>

          <div className="sideMenuFooter">
            <button
              type="button"
              style={{ ...primaryButtonStyle, width: '100%', justifyContent: 'center' }}
              onClick={() => {
                resetAddOrderForm()
                setOpenAddOrder(true)
              }}
            >
              + Nová zákazka
            </button>

            <button
              type="button"
              style={sideUtilityButton}
              onClick={() => {
                resetAddCustomerForm()
                setOpenAddCustomer(true)
              }}
            >
              <span>Nový zákazník</span>
              <span className="sideMenuIcon">+</span>
            </button>

            <button
              type="button"
              style={sideUtilityButton}
              onClick={() => {
                resetEmployeeForm()
                setOpenAddEmployee(true)
              }}
            >
              <span>Nový zamestnanec</span>
              <span className="sideMenuIcon">+</span>
            </button>

            <button
              type="button"
              style={sideUtilityButton}
              onClick={logout}
              disabled={loggingOut}
            >
              <span>{loggingOut ? 'Odhlasujem...' : 'Odhlásiť'}</span>
              <span className="sideMenuIcon">×</span>
            </button>
          </div>
        </aside>

        <main className="mainPanel">
          <div
            style={{
              ...boxStyle,
              marginBottom: 12,
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #0b1120 0%, #1f2937 74%, #365314 100%)',
              color: '#fff',
              border: 'none',
            }}
          >
            <div className="headerCompact">
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                  {selectedCustomer ? selectedCustomer.nazov : 'Servisné zákazky'}
                </h1>
                <div style={{ marginTop: 3, color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: 700 }}>
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
                    padding: '7px 11px',
                    borderRadius: 10,
                    fontWeight: 900,
                    fontSize: 13,
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
                  style={{ ...primaryButtonStyle, minWidth: 138, padding: '8px 12px', borderRadius: 10 }}
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
            deleteCustomerUpdate={deleteCustomerUpdate}
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
            updateOrderProgress={updateOrderProgress}
            workLogsByOrder={workLogsByOrder}
            customerUpdatesByOrder={customerUpdatesByOrder}
            unseenCustomerUpdatesByOrder={unseenCustomerUpdatesByOrder}
          />
        )}

        {activeTab === 'zakaznici' && (
          <CustomersView
            customers={customers}
            customerContacts={customerContacts}
            contactCustomerIds={contactCustomerIds}
            contactEmail={contactEmail}
            contactName={contactName}
            contactPhone={contactPhone}
            contactPortalCode={contactPortalCode}
            contactRole={contactRole}
            boxStyle={boxStyle}
            buttonStyle={buttonStyle}
            dangerButtonStyle={dangerButtonStyle}
            addCustomerContact={addCustomerContact}
            deleteCustomer={deleteCustomer}
            deleteCustomerContact={deleteCustomerContact}
            resetContactForm={resetContactForm}
            savingContact={savingContact}
            setContactCustomerIds={setContactCustomerIds}
            setContactEmail={setContactEmail}
            setContactName={setContactName}
            setContactPhone={setContactPhone}
            setContactPortalCode={setContactPortalCode}
            setContactRole={setContactRole}
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
            onBackToOrders={() => setActiveTab('zakazky')}
            orders={orders}
            startEditOrder={startEditOrder}
            updateCalendarPlan={updateCalendarPlan}
          />
        )}

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
            closeDeliveryProtocolModal={closeDeliveryProtocolModal}
            closeWorkLogModal={closeWorkLogModal}
            currentOrder={currentOrder}
            currentOrderWorkLogs={currentOrderWorkLogs}
            customerId={customerId}
            customerMode={customerMode}
            customers={customers}
            dangerButtonStyle={dangerButtonStyle}
            deleteWorkLog={deleteWorkLog}
            deliveryProtocolCustomer={deliveryProtocolCustomer}
            deliveryProtocolDate={deliveryProtocolDate}
            deliveryProtocolDeliveredBy={deliveryProtocolDeliveredBy}
            deliveryProtocolItems={deliveryProtocolItems}
            deliveryProtocolNumber={deliveryProtocolNumber}
            deliveryProtocolReceivedBy={deliveryProtocolReceivedBy}
            deliveryProtocolTested={deliveryProtocolTested}
            deliveryProtocolBriefed={deliveryProtocolBriefed}
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
            editOrderPublicMessage={editOrderPublicMessage}
            editOrderPrijatieZakazky={editOrderPrijatieZakazky}
            editOrderRequester={editOrderRequester}
            editOrderRequesterEmail={editOrderRequesterEmail}
            editOrderTermin={editOrderTermin}
            editingWorkLogId={editingWorkLogId}
            email={email}
            employeeCanDelete={employeeCanDelete}
            employeeEmail={employeeEmail}
            employeeName={employeeName}
            employeeTelefon={employeeTelefon}
            employees={employees}
            exportDeliveryProtocolPdf={exportDeliveryProtocolPdf}
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
            openDeliveryProtocol={openDeliveryProtocol}
            openEditCustomer={openEditCustomer}
            openEditEmployee={openEditEmployee}
            openEditOrder={openEditOrder}
            openWorkLog={openWorkLog}
            orderNazov={orderNazov}
            orderPopis={orderPopis}
            orderPublicMessage={orderPublicMessage}
            orderPrijatieZakazky={orderPrijatieZakazky}
            orderRequester={orderRequester}
            orderRequesterEmail={orderRequesterEmail}
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
            setEditOrderPublicMessage={setEditOrderPublicMessage}
            setEditOrderPrijatieZakazky={setEditOrderPrijatieZakazky}
            setEditOrderRequester={setEditOrderRequester}
            setEditOrderRequesterEmail={setEditOrderRequesterEmail}
            setEditOrderTermin={setEditOrderTermin}
            setEmail={setEmail}
            setEmployeeCanDelete={setEmployeeCanDelete}
            setEmployeeEmail={setEmployeeEmail}
            setEmployeeName={setEmployeeName}
            setEmployeeTelefon={setEmployeeTelefon}
            setDeliveryProtocolCustomer={setDeliveryProtocolCustomer}
            setDeliveryProtocolDate={setDeliveryProtocolDate}
            setDeliveryProtocolDeliveredBy={setDeliveryProtocolDeliveredBy}
            setDeliveryProtocolNumber={setDeliveryProtocolNumber}
            setDeliveryProtocolReceivedBy={setDeliveryProtocolReceivedBy}
            setDeliveryProtocolTested={setDeliveryProtocolTested}
            setDeliveryProtocolBriefed={setDeliveryProtocolBriefed}
            setKontakt={setKontakt}
            setNazov={setNazov}
            setNewCustomerEmail={setNewCustomerEmail}
            setNewCustomerKontakt={setNewCustomerKontakt}
            setNewCustomerNazov={setNewCustomerNazov}
            setNewCustomerTelefon={setNewCustomerTelefon}
            setOrderNazov={setOrderNazov}
            setOrderPopis={setOrderPopis}
            setOrderPublicMessage={setOrderPublicMessage}
            setOrderPrijatieZakazky={setOrderPrijatieZakazky}
            setOrderRequester={setOrderRequester}
            setOrderRequesterEmail={setOrderRequesterEmail}
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
            addDeliveryProtocolItem={addDeliveryProtocolItem}
            removeDeliveryProtocolItem={removeDeliveryProtocolItem}
            toggleWorkLogEmployee={toggleWorkLogEmployee}
            updateDeliveryProtocolItem={updateDeliveryProtocolItem}
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
        </main>
      </div>

      <DashboardStyles />

    </div>
  )
}
