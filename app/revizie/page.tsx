'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/BrandLogo'
import { supabase } from '@/lib/supabase'
import type { Customer, MaintenanceRevision, Notice } from '@/lib/dashboard-types'
import { formatDate, getTodayDate } from '@/lib/dashboard-utils'

const SYSTEM_TYPES = [
  'EZS / alarm',
  'Kamerový systém',
  'Loxone',
  'Sieť / Wi-Fi',
  'Prístupový systém',
  'Server / NAS',
  'Iné',
]

function addMonths(dateValue: string, months: number) {
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return getTodayDate()
  const date = new Date(year, month - 1, day)
  date.setMonth(date.getMonth() + months)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysUntil(dateValue: string) {
  const today = new Date(getTodayDate()).getTime()
  const target = new Date(dateValue).getTime()
  return Math.ceil((target - today) / 86400000)
}

function getRevisionState(revision: MaintenanceRevision) {
  if (!revision.active) return { key: 'inactive', label: 'Neaktívna' }
  const days = daysUntil(revision.next_due_date)
  if (days < 0) return { key: 'overdue', label: 'Po termíne' }
  if (days <= 30) return { key: 'soon', label: 'Blíži sa' }
  return { key: 'ok', label: 'V poriadku' }
}

function stateStyle(stateKey: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    overdue: { background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
    soon: { background: '#ffedd5', color: '#9a3412', borderColor: '#fdba74' },
    ok: { background: '#dcfce7', color: '#166534', borderColor: '#86efac' },
    inactive: { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' },
  }
  return map[stateKey] || map.ok
}

export default function RevisionsPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [revisions, setRevisions] = useState<MaintenanceRevision[]>([])

  const [editingId, setEditingId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [systemType, setSystemType] = useState(SYSTEM_TYPES[0])
  const [title, setTitle] = useState('')
  const [contactName, setContactName] = useState('')
  const [lastCheckDate, setLastCheckDate] = useState(getTodayDate())
  const [intervalMonths, setIntervalMonths] = useState('12')
  const [nextDueDate, setNextDueDate] = useState(addMonths(getTodayDate(), 12))
  const [note, setNote] = useState('')

  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('vsetci')
  const [stateFilter, setStateFilter] = useState('aktivne')

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

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    if (!userId) return
    void loadData(userId)
  }, [userId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function loadData(currentUserId: string) {
    setLoading(true)
    try {
      const [customersResult, revisionsResult] = await Promise.all([
        supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov', { ascending: true }),
        supabase.from('maintenance_revisions').select('*').eq('user_id', currentUserId).order('next_due_date', { ascending: true }),
      ])

      if (customersResult.error) {
        setNotice({ type: 'error', text: `Zákazníci: ${customersResult.error.message}` })
      } else {
        setCustomers((customersResult.data || []) as Customer[])
      }

      if (revisionsResult.error) {
        if (revisionsResult.error.code === '42P01') {
          setNotice({
            type: 'error',
            text: 'Chýba tabuľka revízií. Spusť SQL skript scripts/supabase-maintenance-revisions.sql v Supabase.',
          })
        } else {
          setNotice({ type: 'error', text: `Revízie: ${revisionsResult.error.message}` })
        }
      } else {
        setRevisions((revisionsResult.data || []) as MaintenanceRevision[])
      }
    } finally {
      setLoading(false)
    }
  }

  function getCustomer(customerIdValue: string) {
    return customers.find((customer) => customer.id === customerIdValue)
  }

  function resetForm() {
    setEditingId('')
    setCustomerId('')
    setSystemType(SYSTEM_TYPES[0])
    setTitle('')
    setContactName('')
    setLastCheckDate(getTodayDate())
    setIntervalMonths('12')
    setNextDueDate(addMonths(getTodayDate(), 12))
    setNote('')
  }

  function startEdit(revision: MaintenanceRevision) {
    setEditingId(revision.id)
    setCustomerId(revision.customer_id)
    setSystemType(revision.system_type)
    setTitle(revision.title)
    setContactName(revision.contact_name || '')
    setLastCheckDate(revision.last_check_date || getTodayDate())
    setIntervalMonths(String(revision.interval_months || 12))
    setNextDueDate(revision.next_due_date)
    setNote(revision.note || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveRevision() {
    if (!userId) return
    const interval = Number(intervalMonths)
    if (!customerId) {
      setNotice({ type: 'error', text: 'Vyber zákazníka.' })
      return
    }
    if (!title.trim()) {
      setNotice({ type: 'error', text: 'Zadaj názov revízie alebo údržby.' })
      return
    }
    if (!Number.isFinite(interval) || interval <= 0) {
      setNotice({ type: 'error', text: 'Interval musí byť číslo väčšie ako 0.' })
      return
    }
    if (!nextDueDate) {
      setNotice({ type: 'error', text: 'Zadaj najbližší termín revízie.' })
      return
    }

    setSaving(true)
    const payload = {
      user_id: userId,
      customer_id: customerId,
      system_type: systemType,
      title: title.trim(),
      contact_name: contactName.trim() || null,
      last_check_date: lastCheckDate || null,
      interval_months: interval,
      next_due_date: nextDueDate,
      note: note.trim() || null,
      active: true,
      updated_at: new Date().toISOString(),
    }

    const request = editingId
      ? supabase.from('maintenance_revisions').update(payload).eq('id', editingId).eq('user_id', userId).select().single()
      : supabase.from('maintenance_revisions').insert([payload]).select().single()

    const { data, error } = await request
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Revízia sa neuložila: ${error.message}` })
      return
    }

    const saved = data as MaintenanceRevision
    setRevisions((current) =>
      editingId
        ? current.map((revision) => (revision.id === saved.id ? saved : revision)).sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
        : [...current, saved].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    )
    resetForm()
    setNotice({ type: 'success', text: editingId ? 'Revízia bola upravená.' : 'Revízia bola pridaná.' })
  }

  async function markCompleted(revision: MaintenanceRevision) {
    if (!userId) return
    const completedDate = getTodayDate()
    const nextDate = addMonths(completedDate, revision.interval_months || 12)

    const { data, error } = await supabase
      .from('maintenance_revisions')
      .update({
        last_check_date: completedDate,
        next_due_date: nextDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', revision.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      setNotice({ type: 'error', text: `Revízia sa neaktualizovala: ${error.message}` })
      return
    }

    setRevisions((current) =>
      current.map((item) => (item.id === revision.id ? (data as MaintenanceRevision) : item)).sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    )
    setNotice({ type: 'success', text: `Hotovo. Ďalší termín je ${formatDate(nextDate)}.` })
  }

  async function deleteRevision(revisionId: string) {
    if (!userId) return
    if (!window.confirm('Zmazať túto revíziu z evidencie?')) return

    const previous = revisions
    setRevisions((current) => current.filter((revision) => revision.id !== revisionId))

    const { error } = await supabase.from('maintenance_revisions').delete().eq('id', revisionId).eq('user_id', userId)
    if (error) {
      setRevisions(previous)
      setNotice({ type: 'error', text: `Revízia sa nezmazala: ${error.message}` })
      return
    }

    setNotice({ type: 'success', text: 'Revízia bola zmazaná.' })
  }

  async function createOrderFromRevision(revision: MaintenanceRevision) {
    if (!userId) return
    const customer = getCustomer(revision.customer_id)
    const { error } = await supabase.from('orders').insert([
      {
        user_id: userId,
        customer_id: revision.customer_id,
        nazov: `${revision.title} - ${customer?.nazov || 'zákazník'}`,
        stav: 'nova',
        praca: null,
        popis: [`Revízia / údržba: ${revision.system_type}`, revision.note || ''].filter(Boolean).join('\n'),
        public_message: 'Evidujeme plánovanú revíziu alebo údržbu. Ozveme sa vám s návrhom termínu.',
        prijatie_zakazky: getTodayDate(),
        termin: revision.next_due_date,
      },
    ])

    if (error) {
      setNotice({ type: 'error', text: `Zákazka sa nevytvorila: ${error.message}` })
      return
    }

    setNotice({ type: 'success', text: 'Zo záznamu revízie bola vytvorená nová zákazka.' })
  }

  function openReminderEmail(revision: MaintenanceRevision) {
    const customer = getCustomer(revision.customer_id)
    const to = customer?.email || ''
    const subject = `Pripomenutie revízie - ${revision.title}`
    const body = [
      'Dobrý deň,',
      '',
      `evidujeme, že pri systéme ${revision.system_type} sa blíži termín pravidelnej kontroly/revízie.`,
      `Najbližší termín evidujeme: ${formatDate(revision.next_due_date)}.`,
      '',
      'Radi by sme sa s Vami dohodli na vhodnom termíne.',
      '',
      'S pozdravom',
      'ITspot s.r.o.',
    ].join('\n')

    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const filteredRevisions = useMemo(() => {
    const term = search.trim().toLowerCase()

    return revisions
      .filter((revision) => {
        const customer = getCustomer(revision.customer_id)
        const state = getRevisionState(revision)

        if (customerFilter !== 'vsetci' && revision.customer_id !== customerFilter) return false
        if (stateFilter === 'aktivne' && !revision.active) return false
        if (stateFilter !== 'aktivne' && stateFilter !== 'vsetky' && state.key !== stateFilter) return false

        if (!term) return true
        return [revision.title, revision.system_type, revision.note || '', revision.contact_name || '', customer?.nazov || '']
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => {
        const stateA = getRevisionState(a).key
        const stateB = getRevisionState(b).key
        const weight: Record<string, number> = { overdue: 0, soon: 1, ok: 2, inactive: 3 }
        return (weight[stateA] ?? 9) - (weight[stateB] ?? 9) || a.next_due_date.localeCompare(b.next_due_date)
      })
  }, [customerFilter, revisions, search, stateFilter, customers])

  const stats = useMemo(() => {
    return {
      overdue: revisions.filter((revision) => getRevisionState(revision).key === 'overdue').length,
      soon: revisions.filter((revision) => getRevisionState(revision).key === 'soon').length,
      totalActive: revisions.filter((revision) => revision.active).length,
    }
  }, [revisions])

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 42,
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 700,
    boxSizing: 'border-box',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    marginBottom: 6,
    color: '#475569',
    fontSize: 12,
    fontWeight: 900,
  }

  const buttonStyle: CSSProperties = {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0f172a',
    padding: '10px 13px',
    fontWeight: 900,
    cursor: 'pointer',
  }

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    border: '1px solid #65a30d',
    background: '#65c90f',
    color: '#07111f',
    boxShadow: '0 12px 24px rgba(101, 201, 15, 0.22)',
  }

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <main className="revisionsPage">
      <style jsx global>{`
        body {
          background: #eef4ff;
        }

        .revisionsPage {
          min-height: 100vh;
          padding: 14px;
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
          background:
            radial-gradient(circle at 78% -8%, rgba(132, 204, 22, 0.22), transparent 28%),
            linear-gradient(180deg, #060a12 0%, #111827 265px, #eef4ff 266px, #f8fafc 100%);
        }

        .revisionsShell {
          max-width: 1360px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .revisionsHeader,
        .revisionPanel,
        .revisionCard {
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          box-shadow: 0 22px 50px rgba(15, 23, 42, 0.12);
        }

        .revisionsHeader {
          padding: 16px;
          background: linear-gradient(135deg, #0b1120 0%, #182235 68%, #243b12 100%);
          color: #fff;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .revisionStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(120px, 1fr));
          gap: 10px;
        }

        .revisionStat {
          min-width: 120px;
          border-radius: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
        }

        .revisionStatLabel {
          color: rgba(226, 232, 240, 0.76);
          font-size: 12px;
          font-weight: 900;
        }

        .revisionStatValue {
          margin-top: 4px;
          font-size: 32px;
          line-height: 1;
          font-weight: 900;
        }

        .revisionLayout {
          display: grid;
          grid-template-columns: 380px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }

        .revisionPanel {
          padding: 16px;
          background: #fff;
        }

        .revisionFormGrid,
        .revisionFilters {
          display: grid;
          gap: 12px;
        }

        .revisionFilters {
          grid-template-columns: minmax(220px, 1fr) 220px 170px;
          margin-bottom: 12px;
        }

        .revisionList {
          display: grid;
          gap: 10px;
        }

        .revisionCard {
          background: #fff;
          padding: 14px;
          display: grid;
          gap: 12px;
          border-left: 7px solid #84cc16;
        }

        .revisionCard.overdue {
          border-left-color: #ef4444;
        }

        .revisionCard.soon {
          border-left-color: #fb923c;
        }

        .revisionCard.inactive {
          border-left-color: #94a3b8;
        }

        .revisionCardHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .revisionTitle {
          font-size: 18px;
          font-weight: 950;
          line-height: 1.15;
        }

        .revisionCustomer {
          margin-top: 4px;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
        }

        .revisionBadge {
          border: 1px solid;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .revisionMeta {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .revisionMetaBox {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 9px;
        }

        .revisionMetaLabel {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .revisionMetaValue {
          margin-top: 3px;
          font-weight: 900;
        }

        .revisionActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        @media (max-width: 960px) {
          .revisionLayout,
          .revisionFilters {
            grid-template-columns: 1fr;
          }

          .revisionMeta {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 560px) {
          .revisionsPage {
            padding: 10px;
          }

          .revisionsHeader {
            align-items: flex-start;
          }

          .revisionStats {
            width: 100%;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .revisionStat {
            min-width: 0;
            padding: 9px;
          }

          .revisionStatValue {
            font-size: 26px;
          }

          .revisionMeta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="revisionsShell">
        <header className="revisionsHeader">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <BrandLogo size="sm" tone="dark" />
            <div>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1, fontWeight: 950 }}>Revízie a údržba</h1>
              <div style={{ marginTop: 6, color: 'rgba(226,232,240,0.78)', fontWeight: 800 }}>
                Ročné kontroly EZS, kamier, Loxone a ďalších systémov.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/" style={{ ...buttonStyle, textDecoration: 'none' }}>
              Domov
            </Link>
            <Link href="/kancelaria" style={{ ...buttonStyle, textDecoration: 'none' }}>
              Kancelária
            </Link>
          </div>
        </header>

        {notice && (
          <div
            className="revisionPanel"
            style={{
              borderColor: notice.type === 'success' ? '#86efac' : '#fecaca',
              background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: notice.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            <strong>{notice.text}</strong>
          </div>
        )}

        <section className="revisionStats">
          <div className="revisionStat" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>
            <div className="revisionStatLabel" style={{ color: '#991b1b' }}>Po termíne</div>
            <div className="revisionStatValue">{stats.overdue}</div>
          </div>
          <div className="revisionStat" style={{ background: '#ffedd5', color: '#9a3412', borderColor: '#fdba74' }}>
            <div className="revisionStatLabel" style={{ color: '#9a3412' }}>Do 30 dní</div>
            <div className="revisionStatValue">{stats.soon}</div>
          </div>
          <div className="revisionStat" style={{ background: '#dcfce7', color: '#166534', borderColor: '#86efac' }}>
            <div className="revisionStatLabel" style={{ color: '#166534' }}>Aktívne</div>
            <div className="revisionStatValue">{stats.totalActive}</div>
          </div>
        </section>

        <section className="revisionLayout">
          <div className="revisionPanel">
            <h2 style={{ margin: '0 0 12px', fontSize: 21, fontWeight: 950 }}>
              {editingId ? 'Upraviť revíziu' : 'Nová revízia'}
            </h2>
            <form
              className="revisionFormGrid"
              onSubmit={(event) => {
                event.preventDefault()
                void saveRevision()
              }}
            >
              <div>
                <label style={labelStyle} htmlFor="revision-customer">Zákazník</label>
                <select id="revision-customer" style={inputStyle} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Vyber zákazníka</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.nazov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-type">Typ systému</label>
                <select id="revision-type" style={inputStyle} value={systemType} onChange={(event) => setSystemType(event.target.value)}>
                  {SYSTEM_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-title">Názov</label>
                <input
                  id="revision-title"
                  style={inputStyle}
                  placeholder="Napr. Ročná kontrola alarmu"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-contact">Kontaktná osoba</label>
                <input
                  id="revision-contact"
                  style={inputStyle}
                  placeholder="Voliteľné"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-last">Posledná kontrola</label>
                <input
                  id="revision-last"
                  type="date"
                  style={inputStyle}
                  value={lastCheckDate}
                  onChange={(event) => {
                    setLastCheckDate(event.target.value)
                    setNextDueDate(addMonths(event.target.value, Number(intervalMonths) || 12))
                  }}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-interval">Interval</label>
                <select
                  id="revision-interval"
                  style={inputStyle}
                  value={intervalMonths}
                  onChange={(event) => {
                    setIntervalMonths(event.target.value)
                    setNextDueDate(addMonths(lastCheckDate || getTodayDate(), Number(event.target.value) || 12))
                  }}
                >
                  <option value="6">6 mesiacov</option>
                  <option value="12">12 mesiacov</option>
                  <option value="24">24 mesiacov</option>
                  <option value="36">36 mesiacov</option>
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-next">Ďalší termín</label>
                <input id="revision-next" type="date" style={inputStyle} value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} />
              </div>

              <div>
                <label style={labelStyle} htmlFor="revision-note">Poznámka</label>
                <textarea
                  id="revision-note"
                  style={{ ...inputStyle, minHeight: 96, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }}
                  placeholder="Napr. kód ústredne, miesto zariadenia, čo skontrolovať..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={saving}>
                  {saving ? 'Ukladám...' : editingId ? 'Uložiť zmeny' : 'Pridať revíziu'}
                </button>
                {editingId && (
                  <button type="button" style={buttonStyle} onClick={resetForm}>
                    Zrušiť úpravu
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            <div className="revisionPanel" style={{ marginBottom: 12 }}>
              <div className="revisionFilters">
                <div>
                  <label style={labelStyle} htmlFor="revision-search">Hľadať</label>
                  <input
                    id="revision-search"
                    style={inputStyle}
                    placeholder="Zákazník, systém, poznámka..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="revision-customer-filter">Zákazník</label>
                  <select id="revision-customer-filter" style={inputStyle} value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
                    <option value="vsetci">Všetci zákazníci</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.nazov}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle} htmlFor="revision-state-filter">Stav</label>
                  <select id="revision-state-filter" style={inputStyle} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                    <option value="aktivne">Aktívne</option>
                    <option value="overdue">Po termíne</option>
                    <option value="soon">Do 30 dní</option>
                    <option value="ok">V poriadku</option>
                    <option value="vsetky">Všetko</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="revisionList">
              {filteredRevisions.length === 0 ? (
                <div className="revisionPanel" style={{ textAlign: 'center', color: '#64748b', fontWeight: 800 }}>
                  Zatiaľ tu nie je žiadna revízia pre vybrané filtre.
                </div>
              ) : (
                filteredRevisions.map((revision) => {
                  const state = getRevisionState(revision)
                  const customer = getCustomer(revision.customer_id)
                  const days = daysUntil(revision.next_due_date)

                  return (
                    <article key={revision.id} className={`revisionCard ${state.key}`}>
                      <div className="revisionCardHeader">
                        <div>
                          <div className="revisionTitle">{revision.title}</div>
                          <div className="revisionCustomer">{customer?.nazov || 'Neznámy zákazník'} · {revision.system_type}</div>
                        </div>
                        <span className="revisionBadge" style={stateStyle(state.key)}>
                          {state.label}
                        </span>
                      </div>

                      <div className="revisionMeta">
                        <div className="revisionMetaBox">
                          <div className="revisionMetaLabel">Ďalší termín</div>
                          <div className="revisionMetaValue">{formatDate(revision.next_due_date)}</div>
                        </div>
                        <div className="revisionMetaBox">
                          <div className="revisionMetaLabel">Zostáva</div>
                          <div className="revisionMetaValue">{days < 0 ? `${Math.abs(days)} dní po` : `${days} dní`}</div>
                        </div>
                        <div className="revisionMetaBox">
                          <div className="revisionMetaLabel">Posledná kontrola</div>
                          <div className="revisionMetaValue">{formatDate(revision.last_check_date)}</div>
                        </div>
                        <div className="revisionMetaBox">
                          <div className="revisionMetaLabel">Kontakt</div>
                          <div className="revisionMetaValue">{revision.contact_name || customer?.kontakt || '-'}</div>
                        </div>
                      </div>

                      {revision.note && (
                        <div style={{ whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.45, fontWeight: 700 }}>
                          {revision.note}
                        </div>
                      )}

                      <div className="revisionActions">
                        <button type="button" style={primaryButtonStyle} onClick={() => void markCompleted(revision)}>
                          Označiť ako hotové
                        </button>
                        <button type="button" style={buttonStyle} onClick={() => openReminderEmail(revision)}>
                          Email zákazníkovi
                        </button>
                        <button type="button" style={buttonStyle} onClick={() => void createOrderFromRevision(revision)}>
                          Vytvoriť zákazku
                        </button>
                        <button type="button" style={buttonStyle} onClick={() => startEdit(revision)}>
                          Upraviť
                        </button>
                        <button
                          type="button"
                          style={{ ...buttonStyle, borderColor: '#fecaca', color: '#991b1b', background: '#fff1f2' }}
                          onClick={() => void deleteRevision(revision.id)}
                        >
                          Zmazať
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </section>

        {loading && <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 800 }}>Načítavam revízie...</div>}
      </div>
    </main>
  )
}
