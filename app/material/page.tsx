'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/BrandLogo'
import type { Customer, MaterialRequest, Notice } from '@/lib/dashboard-types'
import { formatDate, getTodayDate } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

const STATUS_LABELS: Record<MaterialRequest['status'], string> = {
  to_order: 'Treba objednať',
  ordered: 'Objednané',
  delivered: 'Doručené',
  used: 'Vybavené',
  cancelled: 'Zrušené',
}

const STATUS_ORDER: MaterialRequest['status'][] = ['to_order', 'ordered', 'delivered', 'used', 'cancelled']

const STATUS_STYLES: Record<MaterialRequest['status'], CSSProperties> = {
  to_order: { background: '#fef3c7', color: '#92400e', borderColor: '#fbbf24' },
  ordered: { background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
  delivered: { background: '#dcfce7', color: '#166534', borderColor: '#86efac' },
  used: { background: '#f1f5f9', color: '#334155', borderColor: '#cbd5e1' },
  cancelled: { background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
}

const UNIT_OPTIONS = ['ks', 'm', 'bal', 'sada', 'hod', 'l', 'kg']

function isOverdue(dateValue: string | null | undefined) {
  if (!dateValue) return false
  return dateValue < getTodayDate()
}

function createEmptyForm() {
  return {
    targetType: 'internal' as MaterialRequest['target_type'],
    customerId: '',
    name: '',
    quantity: '1',
    unit: 'ks',
    supplier: '',
    status: 'to_order' as MaterialRequest['status'],
    priority: 'normal' as MaterialRequest['priority'],
    neededBy: '',
    note: '',
  }
}

export default function MaterialPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<MaterialRequest[]>([])
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(createEmptyForm)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | MaterialRequest['status'] | 'all'>('active')
  const [targetFilter, setTargetFilter] = useState<'all' | 'internal' | 'customer'>('all')
  const [customerFilter, setCustomerFilter] = useState('all')

  const boxStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #dbe4ef',
    borderRadius: 16,
    boxShadow: '0 12px 34px rgba(15, 23, 42, 0.08)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 40,
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 14,
    fontWeight: 800,
    color: '#0f172a',
    background: '#fff',
  }

  const buttonStyle: CSSProperties = {
    minHeight: 40,
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '8px 12px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  }

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
      const [customersResult, materialResult] = await Promise.all([
        supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov', { ascending: true }),
        supabase
          .from('material_requests')
          .select('*')
          .eq('user_id', currentUserId)
          .order('status', { ascending: true })
          .order('priority', { ascending: true })
          .order('needed_by', { ascending: true, nullsFirst: false }),
      ])

      if (customersResult.error) {
        setNotice({ type: 'error', text: `Zákazníci: ${customersResult.error.message}` })
      } else {
        setCustomers((customersResult.data || []) as Customer[])
      }

      if (materialResult.error) {
        if (materialResult.error.code === '42P01') {
          setNotice({
            type: 'error',
            text: 'Chýba tabuľka material_requests. Spusť SQL skript scripts/supabase-material-requests.sql v Supabase.',
          })
        } else {
          setNotice({ type: 'error', text: `Materiál: ${materialResult.error.message}` })
        }
      } else {
        setItems((materialResult.data || []) as MaterialRequest[])
      }
    } finally {
      setLoading(false)
    }
  }

  function customerName(customerId: string | null | undefined) {
    if (!customerId) return 'Interné / firma'
    return customers.find((customer) => customer.id === customerId)?.nazov || 'Neznámy zákazník'
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((item) => {
        if (statusFilter === 'active' && ['used', 'cancelled'].includes(item.status)) return false
        if (statusFilter !== 'active' && statusFilter !== 'all' && item.status !== statusFilter) return false
        if (targetFilter !== 'all' && item.target_type !== targetFilter) return false
        if (customerFilter !== 'all' && item.customer_id !== customerFilter) return false
        if (!q) return true
        return [
          item.name,
          item.quantity || '',
          item.unit || '',
          item.supplier || '',
          item.note || '',
          customerName(item.customer_id),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => {
        const prioritySort = Number(b.priority === 'urgent') - Number(a.priority === 'urgent')
        if (prioritySort) return prioritySort
        const statusSort = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        if (statusSort) return statusSort
        return String(a.needed_by || '9999-12-31').localeCompare(String(b.needed_by || '9999-12-31'))
      })
  }, [items, search, statusFilter, targetFilter, customerFilter, customers])

  const summary = useMemo(() => {
    return {
      toOrder: items.filter((item) => item.status === 'to_order').length,
      urgent: items.filter((item) => item.priority === 'urgent' && !['used', 'cancelled'].includes(item.status)).length,
      ordered: items.filter((item) => item.status === 'ordered').length,
      delivered: items.filter((item) => item.status === 'delivered').length,
    }
  }, [items])

  function resetForm() {
    setEditingId('')
    setForm(createEmptyForm())
  }

  function startEdit(item: MaterialRequest) {
    setEditingId(item.id)
    setForm({
      targetType: item.target_type,
      customerId: item.customer_id || '',
      name: item.name,
      quantity: item.quantity || '',
      unit: item.unit || 'ks',
      supplier: item.supplier || '',
      status: item.status,
      priority: item.priority,
      neededBy: item.needed_by || '',
      note: item.note || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveItem() {
    if (!userId) return
    if (!form.name.trim()) {
      setNotice({ type: 'error', text: 'Zadaj názov materiálu.' })
      return
    }
    if (form.targetType === 'customer' && !form.customerId) {
      setNotice({ type: 'error', text: 'Vyber zákazníka alebo nastav Interné / firma.' })
      return
    }

    setSaving(true)
    const payload = {
      user_id: userId,
      customer_id: form.targetType === 'customer' ? form.customerId : null,
      target_type: form.targetType,
      name: form.name.trim(),
      quantity: form.quantity.trim() || null,
      unit: form.unit.trim() || null,
      supplier: form.supplier.trim() || null,
      status: form.status,
      priority: form.priority,
      needed_by: form.neededBy || null,
      note: form.note.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const request = editingId
      ? supabase.from('material_requests').update(payload).eq('id', editingId).eq('user_id', userId).select().single()
      : supabase.from('material_requests').insert([payload]).select().single()

    const { data, error } = await request
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Materiál sa neuložil: ${error.message}` })
      return
    }

    const saved = data as MaterialRequest
    setItems((current) => (editingId ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]))
    resetForm()
    setNotice({ type: 'success', text: editingId ? 'Položka bola upravená.' : 'Materiál bol pridaný do zoznamu.' })
  }

  async function updateStatus(item: MaterialRequest, status: MaterialRequest['status']) {
    if (!userId) return
    const previous = items
    const patch = { status, updated_at: new Date().toISOString() }
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)))

    const { error } = await supabase.from('material_requests').update(patch).eq('id', item.id).eq('user_id', userId)
    if (error) {
      setItems(previous)
      setNotice({ type: 'error', text: `Stav sa nezmenil: ${error.message}` })
    }
  }

  async function deleteItem(itemId: string) {
    if (!userId) return
    if (!window.confirm('Zmazať túto položku materiálu?')) return
    const previous = items
    setItems((current) => current.filter((item) => item.id !== itemId))
    const { error } = await supabase.from('material_requests').delete().eq('id', itemId).eq('user_id', userId)
    if (error) {
      setItems(previous)
      setNotice({ type: 'error', text: `Položka sa nezmazala: ${error.message}` })
    }
  }

  if (checkingAuth) {
    return <main style={{ padding: 30, fontWeight: 900 }}>Kontrolujem prihlásenie...</main>
  }

  return (
    <main className="materialPage">
      <style jsx global>{`
        body {
          margin: 0;
          background: #eaf0f7;
          color: #0f172a;
          font-family: Arial, Helvetica, sans-serif;
        }

        .materialPage {
          min-height: 100vh;
          padding: 18px;
        }

        .materialShell {
          max-width: 1480px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .materialHero {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          background: linear-gradient(135deg, #0b1120 0%, #172033 68%, #365314 100%) !important;
          color: #fff;
          border: 0 !important;
        }

        .materialHero h1,
        .materialForm h2,
        .materialList h2 {
          margin: 0;
          font-weight: 900;
          letter-spacing: 0;
        }

        .materialHero p {
          margin: 4px 0 0;
          color: rgba(255,255,255,0.76);
          font-weight: 700;
        }

        .materialActions,
        .materialFilters,
        .materialButtonRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .materialStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .materialStat {
          padding: 14px;
          border-radius: 14px;
          color: #0f172a;
        }

        .materialStat span {
          color: #64748b;
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
        }

        .materialStat strong {
          display: block;
          margin-top: 6px;
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
        }

        .materialWorkspace {
          display: grid;
          grid-template-columns: 420px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }

        .materialForm,
        .materialList {
          padding: 14px;
        }

        .materialForm {
          display: grid;
          gap: 12px;
          position: sticky;
          top: 12px;
        }

        .materialGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .materialField {
          display: grid;
          gap: 5px;
        }

        .materialField label {
          color: #475569;
          font-size: 12px;
          font-weight: 900;
        }

        .materialItems {
          display: grid;
          gap: 8px;
        }

        .materialRow {
          display: grid;
          grid-template-columns: 1.6fr 130px 150px 130px 190px;
          gap: 10px;
          align-items: center;
          border: 1px solid #dbe4ef;
          border-radius: 12px;
          padding: 10px;
          background: #fff;
        }

        .materialRow.urgent {
          border-color: #f97316;
          box-shadow: inset 4px 0 0 #f97316;
        }

        .materialName strong {
          display: block;
          font-weight: 900;
          font-size: 15px;
        }

        .materialName span,
        .materialMeta {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-weight: 800;
          font-size: 12px;
        }

        .materialBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .materialDue.overdue {
          color: #b91c1c;
          font-weight: 900;
        }

        @media (max-width: 1000px) {
          .materialWorkspace,
          .materialStats {
            grid-template-columns: 1fr;
          }

          .materialForm {
            position: static;
          }

          .materialRow {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .materialPage {
            padding: 10px;
          }

          .materialHero {
            align-items: stretch;
            flex-direction: column;
          }

          .materialGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="materialShell">
        <section className="materialHero" style={boxStyle}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <BrandLogo size="sm" tone="dark" />
            <div>
              <h1>Nákup materiálu</h1>
              <p>Prehľad vecí, ktoré treba objednať pre zákazníkov alebo interne pre firmu.</p>
            </div>
          </div>
          <div className="materialActions">
            <Link href="/" style={{ ...buttonStyle, background: '#fff' }}>
              Domov
            </Link>
            <button type="button" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              + Pridať materiál
            </button>
          </div>
        </section>

        {notice && (
          <div
            style={{
              ...boxStyle,
              padding: 12,
              background: notice.type === 'error' ? '#fff1f2' : '#f7fee7',
              borderColor: notice.type === 'error' ? '#fecaca' : '#bef264',
              color: notice.type === 'error' ? '#991b1b' : '#365314',
              fontWeight: 900,
            }}
          >
            {notice.text}
          </div>
        )}

        <section className="materialStats">
          <div className="materialStat" style={{ ...boxStyle, borderLeft: '5px solid #fbbf24' }}>
            <span>Treba objednať</span>
            <strong>{summary.toOrder}</strong>
          </div>
          <div className="materialStat" style={{ ...boxStyle, borderLeft: '5px solid #f97316' }}>
            <span>Súrne</span>
            <strong>{summary.urgent}</strong>
          </div>
          <div className="materialStat" style={{ ...boxStyle, borderLeft: '5px solid #60a5fa' }}>
            <span>Objednané</span>
            <strong>{summary.ordered}</strong>
          </div>
          <div className="materialStat" style={{ ...boxStyle, borderLeft: '5px solid #22c55e' }}>
            <span>Doručené</span>
            <strong>{summary.delivered}</strong>
          </div>
        </section>

        <section className="materialWorkspace">
          <div className="materialForm" style={boxStyle}>
            <div>
              <div style={{ color: '#65a30d', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>
                {editingId ? 'Úprava položky' : 'Nová položka'}
              </div>
              <h2>{editingId ? 'Upraviť materiál' : 'Pridať materiál'}</h2>
            </div>

            <div className="materialGrid">
              <div className="materialField">
                <label htmlFor="targetType">Zaradenie</label>
                <select
                  id="targetType"
                  value={form.targetType}
                  onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value as MaterialRequest['target_type'], customerId: '' }))}
                  style={inputStyle}
                >
                  <option value="internal">Interné / firma</option>
                  <option value="customer">Pre zákazníka</option>
                </select>
              </div>

              <div className="materialField">
                <label htmlFor="customer">Zákazník</label>
                <select
                  id="customer"
                  value={form.customerId}
                  onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                  style={{ ...inputStyle, background: form.targetType === 'internal' ? '#f8fafc' : '#fff' }}
                  disabled={form.targetType === 'internal'}
                >
                  <option value="">Vyber zákazníka</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.nazov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="materialField">
              <label htmlFor="name">Materiál</label>
              <input
                id="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Napr. UTP kábel, kamera, zdroj, svorky..."
                style={inputStyle}
              />
            </div>

            <div className="materialGrid">
              <div className="materialField">
                <label htmlFor="quantity">Množstvo</label>
                <input
                  id="quantity"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  placeholder="1"
                  style={inputStyle}
                />
              </div>
              <div className="materialField">
                <label htmlFor="unit">Jednotka</label>
                <select id="unit" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} style={inputStyle}>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="materialGrid">
              <div className="materialField">
                <label htmlFor="supplier">Dodávateľ</label>
                <input
                  id="supplier"
                  value={form.supplier}
                  onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))}
                  placeholder="Alza, i4wifi, veľkoobchod..."
                  style={inputStyle}
                />
              </div>
              <div className="materialField">
                <label htmlFor="neededBy">Potrebné do</label>
                <input id="neededBy" type="date" value={form.neededBy} onChange={(event) => setForm((current) => ({ ...current, neededBy: event.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div className="materialGrid">
              <div className="materialField">
                <label htmlFor="status">Stav</label>
                <select id="status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MaterialRequest['status'] }))} style={inputStyle}>
                  {STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="materialField">
                <label htmlFor="priority">Priorita</label>
                <select id="priority" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as MaterialRequest['priority'] }))} style={inputStyle}>
                  <option value="normal">Normálna</option>
                  <option value="urgent">Súrne</option>
                </select>
              </div>
            </div>

            <div className="materialField">
              <label htmlFor="note">Poznámka</label>
              <textarea
                id="note"
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Prečo to treba, kde sa použije, špecifikácia..."
                style={{ ...inputStyle, minHeight: 92, resize: 'vertical' }}
              />
            </div>

            <div className="materialButtonRow">
              <button type="button" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }} onClick={saveItem} disabled={saving}>
                {saving ? 'Ukladám...' : editingId ? 'Uložiť zmenu' : 'Pridať do zoznamu'}
              </button>
              {(editingId || form.name || form.note) && (
                <button type="button" style={buttonStyle} onClick={resetForm}>
                  Zrušiť
                </button>
              )}
            </div>
          </div>

          <div className="materialList" style={boxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ color: '#65a30d', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Prehľad</div>
                <h2>Zoznam materiálu</h2>
              </div>
              <div style={{ color: '#64748b', fontWeight: 900 }}>{filteredItems.length} položiek</div>
            </div>

            <div className="materialFilters" style={{ marginBottom: 12 }}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hľadať materiál, zákazníka, dodávateľa..." style={{ ...inputStyle, maxWidth: 340 }} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} style={{ ...inputStyle, width: 190 }}>
                <option value="active">Aktívne</option>
                <option value="all">Všetky</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value as typeof targetFilter)} style={{ ...inputStyle, width: 180 }}>
                <option value="all">Všetko</option>
                <option value="internal">Interné</option>
                <option value="customer">Pre zákazníka</option>
              </select>
              <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} style={{ ...inputStyle, width: 220 }}>
                <option value="all">Všetci zákazníci</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.nazov}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div style={{ color: '#64748b', fontWeight: 900, padding: 18 }}>Načítavam materiál...</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ color: '#64748b', fontWeight: 900, padding: 18 }}>Zatiaľ tu nie je žiadny materiál pre zvolený filter.</div>
            ) : (
              <div className="materialItems">
                {filteredItems.map((item) => (
                  <article key={item.id} className={`materialRow ${item.priority === 'urgent' ? 'urgent' : ''}`}>
                    <div className="materialName">
                      <strong>{item.name}</strong>
                      <span>{customerName(item.customer_id)}</span>
                      {item.note && <span>{item.note}</span>}
                    </div>

                    <div>
                      <div style={{ fontWeight: 900 }}>{[item.quantity, item.unit].filter(Boolean).join(' ') || '-'}</div>
                      {item.priority === 'urgent' && <div className="materialMeta" style={{ color: '#ea580c' }}>Súrne</div>}
                    </div>

                    <div>
                      <span className="materialBadge" style={STATUS_STYLES[item.status]}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>

                    <div>
                      <div className={`materialDue ${isOverdue(item.needed_by) ? 'overdue' : ''}`}>{item.needed_by ? formatDate(item.needed_by) : '-'}</div>
                      {item.supplier && <div className="materialMeta">{item.supplier}</div>}
                    </div>

                    <div className="materialButtonRow">
                      {item.status === 'to_order' && (
                        <button type="button" style={buttonStyle} onClick={() => updateStatus(item, 'ordered')}>
                          Objednané
                        </button>
                      )}
                      {item.status === 'ordered' && (
                        <button type="button" style={buttonStyle} onClick={() => updateStatus(item, 'delivered')}>
                          Doručené
                        </button>
                      )}
                      {item.status === 'delivered' && (
                        <button type="button" style={buttonStyle} onClick={() => updateStatus(item, 'used')}>
                          Vybavené
                        </button>
                      )}
                      <button type="button" style={buttonStyle} onClick={() => startEdit(item)}>
                        Upraviť
                      </button>
                      <button type="button" style={{ ...buttonStyle, color: '#be123c' }} onClick={() => deleteItem(item.id)}>
                        Zmazať
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
