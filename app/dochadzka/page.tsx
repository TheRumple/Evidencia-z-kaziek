'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

type AttendanceLog = {
  id: string
  user_id: string
  employee_id: string
  date: string
  arrival_time: string | null
  departure_time: string | null
  note: string | null
  created_at?: string
}

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

function getCurrentDateTimeLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const dateOnly = date.slice(0, 10)
  const parts = dateOnly.split('-')
  if (parts.length !== 3) return date
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

function getDurationHours(arrival: string | null, departure: string | null) {
  if (!arrival || !departure) return null
  const start = new Date(arrival).getTime()
  const end = new Date(departure).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return (end - start) / 1000 / 60 / 60
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
          maxWidth: 760,
          maxHeight: '92vh',
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
            gap: 12,
            alignItems: 'center',
            marginBottom: 16,
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
              width: 36,
              height: 36,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 18,
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
  const [saving, setSaving] = useState(false)

  const [notice, setNotice] = useState<Notice>(null)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])

  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [search, setSearch] = useState('')

  const [openEditLog, setOpenEditLog] = useState(false)
  const [editLogId, setEditLogId] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editDate, setEditDate] = useState(getTodayDate())
  const [editArrival, setEditArrival] = useState('')
  const [editDeparture, setEditDeparture] = useState('')
  const [editNote, setEditNote] = useState('')

  const [openAddManual, setOpenAddManual] = useState(false)
  const [manualEmployeeId, setManualEmployeeId] = useState('')
  const [manualDate, setManualDate] = useState(getTodayDate())
  const [manualArrival, setManualArrival] = useState('')
  const [manualDeparture, setManualDeparture] = useState('')
  const [manualNote, setManualNote] = useState('')

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
      await Promise.all([loadEmployees(currentUserId), loadAttendanceLogs(currentUserId)])
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployees(currentUserId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', currentUserId)
      .order('name', { ascending: true })

    if (error) {
      setNotice({ type: 'error', text: `Zamestnanci: ${error.message}` })
      return
    }

    setEmployees((data || []) as Employee[])
  }

  async function loadAttendanceLogs(currentUserId: string) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', currentUserId)
      .order('date', { ascending: false })
      .order('arrival_time', { ascending: false })

    if (error) {
      setNotice({ type: 'error', text: `Dochádzka: ${error.message}` })
      return
    }

    setAttendanceLogs((data || []) as AttendanceLog[])
  }

  function getEmployeeName(id: string) {
    return employees.find((e) => e.id === id)?.name || 'Neznámy zamestnanec'
  }

  function getOpenLogForEmployee(employeeId: string) {
    return attendanceLogs.find(
      (log) => log.employee_id === employeeId && log.date === getTodayDate() && !log.departure_time
    )
  }

  async function registerArrival(employeeId: string) {
    if (!userId) return

    const openLog = getOpenLogForEmployee(employeeId)
    if (openLog) {
      setNotice({ type: 'error', text: 'Tento zamestnanec už má dnes príchod bez odchodu.' })
      return
    }

    setSaving(true)

    const now = new Date().toISOString()
    const payload = {
      user_id: userId,
      employee_id: employeeId,
      date: getTodayDate(),
      arrival_time: now,
      departure_time: null,
      note: null,
    }

    const { data, error } = await supabase.from('attendance_logs').insert([payload]).select().single()

    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    if (data) {
      setAttendanceLogs((curr) => [data as AttendanceLog, ...curr])
    }

    setNotice({ type: 'success', text: 'Príchod bol zapísaný.' })
  }

  async function registerDeparture(employeeId: string) {
    if (!userId) return

    const openLog = getOpenLogForEmployee(employeeId)
    if (!openLog) {
      setNotice({ type: 'error', text: 'Tento zamestnanec nemá otvorený dnešný príchod.' })
      return
    }

    setSaving(true)

    const departure_time = new Date().toISOString()
    const { error } = await supabase
      .from('attendance_logs')
      .update({ departure_time })
      .eq('id', openLog.id)
      .eq('user_id', userId)

    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    setAttendanceLogs((curr) =>
      curr.map((log) => (log.id === openLog.id ? { ...log, departure_time } : log))
    )
    setNotice({ type: 'success', text: 'Odchod bol zapísaný.' })
  }

  function resetManualForm() {
    setManualEmployeeId('')
    setManualDate(getTodayDate())
    setManualArrival('')
    setManualDeparture('')
    setManualNote('')
  }

  function closeManualModal() {
    resetManualForm()
    setOpenAddManual(false)
  }

  function startEditLog(log: AttendanceLog) {
    setEditLogId(log.id)
    setEditEmployeeId(log.employee_id)
    setEditDate(log.date || getTodayDate())
    setEditArrival(log.arrival_time ? log.arrival_time.slice(0, 16) : '')
    setEditDeparture(log.departure_time ? log.departure_time.slice(0, 16) : '')
    setEditNote(log.note || '')
    setOpenEditLog(true)
  }

  function closeEditModal() {
    setEditLogId('')
    setEditEmployeeId('')
    setEditDate(getTodayDate())
    setEditArrival('')
    setEditDeparture('')
    setEditNote('')
    setOpenEditLog(false)
  }

  async function saveEditedLog() {
    if (!userId || !editLogId || !editEmployeeId || !editDate) {
      setNotice({ type: 'error', text: 'Vyplň povinné údaje.' })
      return
    }

    if (!editArrival) {
      setNotice({ type: 'error', text: 'Príchod je povinný.' })
      return
    }

    if (editDeparture && editDeparture < editArrival) {
      setNotice({ type: 'error', text: 'Odchod nemôže byť skôr ako príchod.' })
      return
    }

    setSaving(true)

    const payload = {
      employee_id: editEmployeeId,
      date: editDate,
      arrival_time: editArrival ? new Date(editArrival).toISOString() : null,
      departure_time: editDeparture ? new Date(editDeparture).toISOString() : null,
      note: editNote.trim() || null,
    }

    const { error } = await supabase
      .from('attendance_logs')
      .update(payload)
      .eq('id', editLogId)
      .eq('user_id', userId)

    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    setAttendanceLogs((curr) => curr.map((log) => (log.id === editLogId ? { ...log, ...payload } : log)))
    setNotice({ type: 'success', text: 'Dochádzka bola upravená.' })
    closeEditModal()
  }

  async function addManualLog() {
    if (!userId || !manualEmployeeId || !manualDate || !manualArrival) {
      setNotice({ type: 'error', text: 'Vyplň zamestnanca, dátum a príchod.' })
      return
    }

    if (manualDeparture && manualDeparture < manualArrival) {
      setNotice({ type: 'error', text: 'Odchod nemôže byť skôr ako príchod.' })
      return
    }

    setSaving(true)

    const payload = {
      user_id: userId,
      employee_id: manualEmployeeId,
      date: manualDate,
      arrival_time: new Date(manualArrival).toISOString(),
      departure_time: manualDeparture ? new Date(manualDeparture).toISOString() : null,
      note: manualNote.trim() || null,
    }

    const { data, error } = await supabase.from('attendance_logs').insert([payload]).select().single()

    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      return
    }

    if (data) {
      setAttendanceLogs((curr) => [data as AttendanceLog, ...curr])
    }

    setNotice({ type: 'success', text: 'Dochádzka bola pridaná ručne.' })
    closeManualModal()
  }

  async function deleteLog(logId: string) {
    if (!userId) return
    if (!window.confirm('Naozaj chceš zmazať tento záznam dochádzky?')) return

    const previous = attendanceLogs
    setAttendanceLogs((curr) => curr.filter((log) => log.id !== logId))

    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', userId)

    if (error) {
      setAttendanceLogs(previous)
      setNotice({ type: 'error', text: error.message })
      return
    }

    setNotice({ type: 'success', text: 'Záznam dochádzky bol zmazaný.' })
  }

  const activeEmployees = useMemo(() => {
    return employees.filter((emp) => emp.active !== false)
  }, [employees])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeEmployees
    return activeEmployees.filter((emp) => emp.name.toLowerCase().includes(q))
  }, [activeEmployees, search])

  const logsForSelectedDate = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attendanceLogs.filter((log) => {
      if (log.date !== selectedDate) return false
      const employeeName = getEmployeeName(log.employee_id).toLowerCase()
      const note = (log.note || '').toLowerCase()
      return !q || `${employeeName} ${note}`.includes(q)
    })
  }, [attendanceLogs, selectedDate, search, employees])

  const currentlyPresentCount = useMemo(() => {
    return activeEmployees.filter((emp) => !!getOpenLogForEmployee(emp.id)).length
  }, [activeEmployees, attendanceLogs])

  const todayCompletedCount = useMemo(() => {
    return attendanceLogs.filter((log) => log.date === getTodayDate() && !!log.departure_time).length
  }, [attendanceLogs])

  const totalHoursSelectedDate = useMemo(() => {
    return logsForSelectedDate.reduce((sum, log) => sum + Number(getDurationHours(log.arrival_time, log.departure_time) || 0), 0)
  }, [logsForSelectedDate])

  const boxStyle: CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 11px',
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
    padding: '9px 12px',
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
    minHeight: 42,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 900,
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.25)',
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

  const summaryCard = (label: string, value: string | number, helper?: string) => (
    <div style={{ ...boxStyle, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      {helper ? <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>{helper}</div> : null}
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
        padding: 12,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div
          style={{
            ...boxStyle,
            marginBottom: 14,
            padding: 18,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div
            className="topBar"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 14, opacity: 0.84, marginBottom: 4 }}>ITspot s.r.o.</div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Dochádzka zamestnancov</h1>
              <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>
                Príchod, odchod a ručná úprava záznamov
              </div>
            </div>

            <div className="topBarActions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  ...buttonStyle,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                Zákazky
              </Link>

              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  resetManualForm()
                  setOpenAddManual(true)
                }}
              >
                + Ručný záznam
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            style={{
              ...boxStyle,
              marginBottom: 14,
              padding: '12px 14px',
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
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'inherit' }}
                aria-label="Zavrieť správu"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="summaryGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
          {summaryCard('Aktívni zamestnanci', activeEmployees.length)}
          {summaryCard('Aktuálne v práci', currentlyPresentCount)}
          {summaryCard('Dnes ukončené', todayCompletedCount)}
          {summaryCard('Hodiny za deň', totalHoursSelectedDate.toFixed(1), formatDate(selectedDate))}
        </div>

        <div style={{ ...boxStyle, marginBottom: 14 }}>
          <div className="filtersGrid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="search">
                Hľadať zamestnanca
              </label>
              <input
                id="search"
                style={inputStyle}
                placeholder="Meno zamestnanca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="selected-date">
                Deň v prehľade
              </label>
              <input
                id="selected-date"
                type="date"
                style={inputStyle}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="contentGrid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14 }}>
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
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Rýchle odtuknutie</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                  Zamestnanec si vie odtuknúť príchod a odchod.
                </div>
              </div>
              <div style={{ color: '#475569', fontWeight: 700 }}>Dnes: {formatDate(getTodayDate())}</div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {filteredEmployees.map((emp) => {
                const openLog = getOpenLogForEmployee(emp.id)
                return (
                  <div
                    key={emp.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      padding: 14,
                      background: openLog ? '#f0fdf4' : '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{emp.name}</div>
                        <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
                          {openLog
                            ? `V práci od ${formatDateTime(openLog.arrival_time).slice(-5)}`
                            : 'Momentálne nemá otvorenú dochádzku'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={greenButtonStyle}
                          onClick={() => registerArrival(emp.id)}
                          disabled={!!openLog || saving}
                        >
                          Príchod
                        </button>
                        <button
                          type="button"
                          style={dangerButtonStyle}
                          onClick={() => registerDeparture(emp.id)}
                          disabled={!openLog || saving}
                        >
                          Odchod
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredEmployees.length === 0 && (
                <div style={{ color: '#64748b', padding: 10 }}>Nenašiel sa žiadny zamestnanec.</div>
              )}
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
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Denný prehľad</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{formatDate(selectedDate)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {logsForSelectedDate.map((log) => {
                const duration = getDurationHours(log.arrival_time, log.departure_time)
                return (
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
                        <div style={{ fontSize: 17, fontWeight: 900 }}>{getEmployeeName(log.employee_id)}</div>
                        <div style={{ marginTop: 6, color: '#475569', fontSize: 14 }}>
                          Príchod: <strong>{formatDateTime(log.arrival_time).slice(-5)}</strong> · Odchod:{' '}
                          <strong>{log.departure_time ? formatDateTime(log.departure_time).slice(-5) : '-'}</strong>
                        </div>
                        <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
                          Hodiny: <strong>{duration ? duration.toFixed(2) : '0.00'}</strong>
                        </div>
                        {log.note ? (
                          <div style={{ marginTop: 6, color: '#334155', fontSize: 13 }}>{log.note}</div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" style={buttonStyle} onClick={() => startEditLog(log)}>
                          Upraviť
                        </button>
                        <button type="button" style={dangerButtonStyle} onClick={() => deleteLog(log.id)}>
                          Zmazať
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {logsForSelectedDate.length === 0 && (
                <div style={{ color: '#64748b', padding: 10 }}>
                  Pre vybraný deň zatiaľ nie je žiadny záznam.
                </div>
              )}
            </div>
          </div>
        </div>

        <Modal open={openAddManual} title="Pridať ručný záznam dochádzky" onClose={closeManualModal}>
          <div className="modalGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Zamestnanec</label>
              <select style={inputStyle} value={manualEmployeeId} onChange={(e) => setManualEmployeeId(e.target.value)}>
                <option value="">Vyber zamestnanca</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Dátum</label>
              <input type="date" style={inputStyle} value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Príchod</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={manualArrival}
                onChange={(e) => setManualArrival(e.target.value)}
                placeholder={getCurrentDateTimeLocal()}
              />
            </div>

            <div>
              <label style={labelStyle}>Odchod</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={manualDeparture}
                onChange={(e) => setManualDeparture(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Poznámka</label>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Voliteľná poznámka"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={closeManualModal}>
              Zrušiť
            </button>
            <button type="button" style={primaryButtonStyle} onClick={addManualLog} disabled={saving}>
              {saving ? 'Ukladám...' : 'Uložiť'}
            </button>
          </div>
        </Modal>

        <Modal open={openEditLog} title="Upraviť dochádzku" onClose={closeEditModal}>
          <div className="modalGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Zamestnanec</label>
              <select style={inputStyle} value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)}>
                <option value="">Vyber zamestnanca</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Dátum</label>
              <input type="date" style={inputStyle} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Príchod</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={editArrival}
                onChange={(e) => setEditArrival(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Odchod</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={editDeparture}
                onChange={(e) => setEditDeparture(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Poznámka</label>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={closeEditModal}>
              Zrušiť
            </button>
            <button type="button" style={primaryButtonStyle} onClick={saveEditedLog} disabled={saving}>
              {saving ? 'Ukladám...' : 'Uložiť zmeny'}
            </button>
          </div>
        </Modal>

        <style jsx>{`
          @media (max-width: 900px) {
            .summaryGrid,
            .contentGrid,
            .filtersGrid,
            .modalGrid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 640px) {
            .topBar {
              align-items: flex-start;
            }

            .topBarActions {
              width: 100%;
            }

            .topBarActions :global(a),
            .topBarActions button {
              flex: 1 1 calc(50% - 6px);
            }
          }
        `}</style>
      </div>
    </div>
  )
}
