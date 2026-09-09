'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/BrandLogo'
import { getSessionWithTimeout } from '@/lib/auth-timeout'
import type { Customer, Inspection, Notice } from '@/lib/dashboard-types'
import { formatDate, getTodayDate } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

type InspectionForm = {
  customerId: string
  customerName: string
  inspectionDate: string
  inspectionType: string
  siteAddress: string
  contactName: string
  contactPhone: string
  contactEmail: string
  requestSummary: string
  currentState: string
  verificationNotes: string
  quoteNote: string
  status: Inspection['status']
  sketchDataUrl: string
}

const INSPECTION_TYPES = [
  { value: 'kamery', label: 'Kamery' },
  { value: 'siet', label: 'Sieť / Wi-Fi / LAN' },
  { value: 'alarm', label: 'Alarm' },
  { value: 'loxone', label: 'Loxone / smart home' },
  { value: 'elektro', label: 'Elektro' },
  { value: 'pc', label: 'PC / IT' },
  { value: 'satelit', label: 'Satelit' },
  { value: 'vseobecna', label: 'Všeobecná' },
]

const STATUS_LABELS: Record<Inspection['status'], string> = {
  draft: 'Rozpracovaná',
  done: 'Hotová',
  quoted: 'V ponuke',
}

function createForm(): InspectionForm {
  return {
    customerId: '',
    customerName: '',
    inspectionDate: getTodayDate(),
    inspectionType: 'vseobecna',
    siteAddress: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    requestSummary: '',
    currentState: '',
    verificationNotes: '',
    quoteNote: '',
    status: 'draft',
    sketchDataUrl: '',
  }
}

function getInspectionTypeLabel(value: string) {
  return INSPECTION_TYPES.find((type) => type.value === value)?.label || value
}

export default function InspectionsPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const activePointersRef = useRef(new Set<number>())
  const multiTouchRef = useRef(false)
  const sketchSnapshotRef = useRef<ImageData | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [editingId, setEditingId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(createForm)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | Inspection['status'] | 'all'>('active')
  const [penColor, setPenColor] = useState('#0f172a')
  const [penWidth, setPenWidth] = useState(4)
  const [sketchTool, setSketchTool] = useState<'pen' | 'eraser'>('pen')
  const [isSketchFullscreen, setIsSketchFullscreen] = useState(false)

  const boxStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #dbe4ef',
    borderRadius: 14,
    boxShadow: '0 12px 34px rgba(15, 23, 42, 0.08)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 34,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '6px 9px',
    fontSize: 13,
    fontWeight: 800,
    color: '#0f172a',
    background: '#fff',
  }

  const buttonStyle: CSSProperties = {
    minHeight: 32,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '6px 10px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 900,
    fontSize: 12,
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
      const session = await getSessionWithTimeout()

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

  useEffect(() => {
    if (!showForm) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!form.sketchDataUrl) return

    const image = new Image()
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = form.sketchDataUrl
  }, [showForm, form.sketchDataUrl])

  async function loadData(currentUserId: string) {
    setLoading(true)
    const [customersResult, inspectionsResult] = await Promise.all([
      supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov', { ascending: true }),
      supabase.from('inspections').select('*').eq('user_id', currentUserId).order('updated_at', { ascending: false }),
    ])
    setLoading(false)

    if (customersResult.error) {
      setNotice({ type: 'error', text: `Zákazníci: ${customersResult.error.message}` })
    } else {
      setCustomers((customersResult.data || []) as Customer[])
    }

    if (inspectionsResult.error) {
      if (inspectionsResult.error.code === '42P01') {
        setNotice({ type: 'error', text: 'Chýba tabuľka inspections. Spusť SQL skript scripts/supabase-inspections.sql v Supabase.' })
      } else {
        setNotice({ type: 'error', text: `Obhliadky: ${inspectionsResult.error.message}` })
      }
      setInspections([])
      return
    }

    setInspections((inspectionsResult.data || []) as Inspection[])
  }

  const summary = useMemo(() => {
    return {
      all: inspections.length,
      active: inspections.filter((item) => item.status !== 'quoted').length,
      done: inspections.filter((item) => item.status === 'done').length,
    }
  }, [inspections])

  const filteredInspections = useMemo(() => {
    const term = search.trim().toLowerCase()
    return inspections
      .filter((item) => {
        if (statusFilter === 'active' && item.status === 'quoted') return false
        if (statusFilter !== 'all' && statusFilter !== 'active' && item.status !== statusFilter) return false
        if (!term) return true
        return [
          item.customer_name,
          item.site_address,
          item.contact_name,
          item.request_summary,
          item.current_state,
          getInspectionTypeLabel(item.inspection_type),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      })
      .sort((a, b) => (b.inspection_date || '').localeCompare(a.inspection_date || '') || (b.updated_at || '').localeCompare(a.updated_at || ''))
  }, [inspections, search, statusFilter])

  function updateForm<K extends keyof InspectionForm>(key: K, value: InspectionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId)
    setForm((current) => ({
      ...current,
      customerId,
      customerName: customer?.nazov || '',
      contactName: customer?.kontakt || '',
      contactPhone: customer?.telefon || '',
      contactEmail: customer?.email || '',
    }))
  }

  function startNewInspection() {
    setEditingId('')
    setForm(createForm())
    setShowForm(true)
    window.setTimeout(() => document.getElementById('inspection-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function editInspection(inspection: Inspection) {
    setEditingId(inspection.id)
    setForm({
      customerId: inspection.customer_id || '',
      customerName: inspection.customer_name || '',
      inspectionDate: inspection.inspection_date || getTodayDate(),
      inspectionType: inspection.inspection_type || 'vseobecna',
      siteAddress: inspection.site_address || '',
      contactName: inspection.contact_name || '',
      contactPhone: inspection.contact_phone || '',
      contactEmail: inspection.contact_email || '',
      requestSummary: inspection.request_summary || '',
      currentState: inspection.current_state || '',
      verificationNotes: inspection.verification_notes || '',
      quoteNote: inspection.quote_note || '',
      status: inspection.status || 'draft',
      sketchDataUrl: inspection.sketch_data_url || '',
    })
    setShowForm(true)
    window.setTimeout(() => document.getElementById('inspection-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    activePointersRef.current.add(event.pointerId)
    if (activePointersRef.current.size > 1) {
      multiTouchRef.current = true
      drawingRef.current = false
      lastPointRef.current = null
      if (sketchSnapshotRef.current) ctx.putImageData(sketchSnapshotRef.current, 0, 0)
      return
    }
    multiTouchRef.current = false
    sketchSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    lastPointRef.current = getCanvasPoint(event)
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    if (activePointersRef.current.size > 1) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      multiTouchRef.current = true
      drawingRef.current = false
      lastPointRef.current = null
      if (ctx && sketchSnapshotRef.current) ctx.putImageData(sketchSnapshotRef.current, 0, 0)
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const lastPoint = lastPointRef.current
    if (!canvas || !ctx || !lastPoint) return
    const point = getCanvasPoint(event)
    ctx.beginPath()
    ctx.moveTo(lastPoint.x, lastPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.strokeStyle = sketchTool === 'eraser' ? '#ffffff' : penColor
    ctx.lineWidth = sketchTool === 'eraser' ? penWidth * 4 : penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPointRef.current = point
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const wasDrawing = drawingRef.current
    activePointersRef.current.delete(event.pointerId)
    drawingRef.current = false
    lastPointRef.current = null
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (canvas && wasDrawing && !multiTouchRef.current) updateForm('sketchDataUrl', canvas.toDataURL('image/png'))
    if (activePointersRef.current.size === 0) {
      multiTouchRef.current = false
      sketchSnapshotRef.current = null
    }
  }

  function clearSketch() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    updateForm('sketchDataUrl', '')
  }

  async function saveInspection() {
    if (!userId) return
    if (!form.customerName.trim()) {
      setNotice({ type: 'error', text: 'Vyber alebo zadaj zákazníka.' })
      return
    }

    const payload = {
      user_id: userId,
      customer_id: form.customerId || null,
      inspection_date: form.inspectionDate,
      inspection_type: form.inspectionType,
      site_address: form.siteAddress.trim() || null,
      customer_name: form.customerName.trim() || null,
      contact_name: form.contactName.trim() || null,
      contact_phone: form.contactPhone.trim() || null,
      contact_email: form.contactEmail.trim() || null,
      request_summary: form.requestSummary.trim() || null,
      current_state: form.currentState.trim() || null,
      verification_notes: form.verificationNotes.trim() || null,
      quote_note: form.quoteNote.trim() || null,
      sketch_data_url: form.sketchDataUrl || null,
      materials: [],
      status: form.status,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const query = editingId
      ? supabase.from('inspections').update(payload).eq('id', editingId).eq('user_id', userId).select().single()
      : supabase.from('inspections').insert([payload]).select().single()
    const { data, error } = await query
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Obhliadka sa neuložila: ${error.message}` })
      return
    }

    const saved = data as Inspection
    setEditingId(saved.id)
    setInspections((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
    setNotice({ type: 'success', text: 'Obhliadka je uložená.' })
  }

  async function deleteInspection(inspectionId: string) {
    if (!userId || !window.confirm('Naozaj chceš zmazať túto obhliadku?')) return
    const previous = inspections
    setInspections((current) => current.filter((item) => item.id !== inspectionId))
    const { error } = await supabase.from('inspections').delete().eq('id', inspectionId).eq('user_id', userId)
    if (error) {
      setInspections(previous)
      setNotice({ type: 'error', text: `Obhliadka sa nezmazala: ${error.message}` })
      return
    }
    if (editingId === inspectionId) {
      setEditingId('')
      setShowForm(false)
      setForm(createForm())
    }
    setNotice({ type: 'success', text: 'Obhliadka bola zmazaná.' })
  }

  if (checkingAuth) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontWeight: 900 }}>Načítavam...</main>
  }

  return (
    <main className="inspectionPage">
      <style jsx global>{`
        body {
          margin: 0;
          background: #eaf0f7;
          color: #0f172a;
          font-family: Arial, Helvetica, sans-serif;
        }

        .inspectionPage {
          min-height: 100vh;
          padding: 12px;
        }

        .inspectionShell {
          max-width: 1480px;
          margin: 0 auto;
          display: grid;
          gap: 10px;
        }

        .inspectionHero {
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          background: linear-gradient(135deg, #0b1120 0%, #172033 68%, #365314 100%) !important;
          color: #fff;
          border: 0 !important;
        }

        .inspectionHero h1,
        .inspectionForm h2,
        .inspectionList h2 {
          margin: 0;
          font-weight: 900;
          letter-spacing: 0;
        }

        .inspectionHero p {
          margin: 4px 0 0;
          color: rgba(255, 255, 255, 0.76);
          font-weight: 700;
          font-size: 13px;
        }

        .inspectionActions,
        .inspectionFilters,
        .inspectionButtonRow,
        .sketchTools {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .inspectionStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .inspectionStat {
          padding: 8px 10px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .inspectionStat span {
          color: #64748b;
          font-weight: 900;
          font-size: 11px;
          text-transform: uppercase;
        }

        .inspectionStat strong {
          display: block;
          font-size: 22px;
          line-height: 1;
          font-weight: 900;
        }

        .inspectionWorkspace {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: start;
        }

        .inspectionForm,
        .inspectionList {
          padding: 10px;
        }

        .inspectionForm {
          display: grid;
          gap: 9px;
        }

        .inspectionGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .inspectionField {
          display: grid;
          gap: 3px;
        }

        .inspectionField label {
          color: #475569;
          font-size: 11px;
          font-weight: 900;
        }

        .inspectionTextGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .inspectionTextarea {
          min-height: 82px;
          resize: vertical;
        }

        .sketchPanel {
          border: 1px solid #dbe4ef;
          border-radius: 12px;
          overflow: hidden;
          background: #f8fafc;
        }

        .sketchPanelFullscreen {
          position: fixed;
          inset: 0;
          z-index: 80;
          border: 0;
          border-radius: 0;
          background: #eaf0f7;
          display: flex;
          flex-direction: column;
        }

        .sketchHeader {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid #dbe4ef;
        }

        .sketchPanelFullscreen .sketchHeader {
          background: #fff;
          flex: 0 0 auto;
        }

        .sketchCanvas {
          display: block;
          width: 100%;
          height: min(54vh, 520px);
          background: #fff;
          touch-action: pinch-zoom;
          cursor: crosshair;
        }

        .sketchPanelFullscreen .sketchCanvas {
          flex: 1 1 auto;
          height: auto;
          min-height: 0;
        }

        .inspectionItems {
          display: grid;
          border: 1px solid #dbe4ef;
          border-radius: 10px;
          overflow: hidden;
        }

        .inspectionTableHeader,
        .inspectionRow {
          display: grid;
          grid-template-columns: 110px 140px minmax(170px, 1fr) minmax(200px, 1.3fr) 110px 245px;
          gap: 8px;
          align-items: center;
        }

        .inspectionTableHeader {
          padding: 7px 9px;
          background: #0f172a;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .inspectionRow {
          padding: 6px 9px;
          border-bottom: 1px solid #e2e8f0;
          background: #fff;
        }

        .inspectionRow:nth-child(even) {
          background: #f8fafc;
        }

        .inspectionRow:last-child {
          border-bottom: 0;
        }

        .statusBadge {
          width: fit-content;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 900;
          background: #f8fafc;
        }

        .muted {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 1040px) {
          .inspectionGrid,
          .inspectionStats,
          .inspectionTextGrid {
            grid-template-columns: 1fr 1fr;
          }

          .inspectionTableHeader {
            display: none;
          }

          .inspectionRow {
            grid-template-columns: 1fr;
            gap: 5px;
          }
        }

        @media (max-width: 680px) {
          .inspectionPage {
            padding: 8px;
          }

          .inspectionHero {
            align-items: flex-start;
            flex-direction: column;
          }

          .inspectionGrid,
          .inspectionStats,
          .inspectionTextGrid {
            grid-template-columns: 1fr;
          }

          .sketchCanvas {
            height: 62vh;
          }
        }
      `}</style>

      <div className="inspectionShell">
        <section className="inspectionHero" style={boxStyle}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <BrandLogo size="sm" tone="dark" />
            <div>
              <h1>Obhliadky</h1>
              <p>Poznámky z tabletu, údaje zákazníka a kresby perom z obhliadky.</p>
            </div>
          </div>
          <div className="inspectionActions">
            <Link href="/" style={{ ...buttonStyle, background: '#fff' }}>
              Domov
            </Link>
            <button type="button" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }} onClick={startNewInspection}>
              + Nová obhliadka
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

        <section className="inspectionStats">
          <div className="inspectionStat" style={{ ...boxStyle, borderLeft: '5px solid #84cc16' }}>
            <span>Obhliadky</span>
            <strong>{summary.all}</strong>
          </div>
          <div className="inspectionStat" style={{ ...boxStyle, borderLeft: '5px solid #fbbf24' }}>
            <span>Aktívne</span>
            <strong>{summary.active}</strong>
          </div>
          <div className="inspectionStat" style={{ ...boxStyle, borderLeft: '5px solid #22c55e' }}>
            <span>Hotové</span>
            <strong>{summary.done}</strong>
          </div>
        </section>

        <section className="inspectionWorkspace">
          {showForm && (
            <form
              id="inspection-form"
              className="inspectionForm"
              style={boxStyle}
              onSubmit={(event) => {
                event.preventDefault()
                void saveInspection()
              }}
            >
              <div className="inspectionButtonRow" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#65a30d', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>
                    {editingId ? 'Úprava obhliadky' : 'Nová obhliadka'}
                  </div>
                  <h2>{editingId ? 'Upraviť obhliadku' : 'Zapísať obhliadku'}</h2>
                </div>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    setShowForm(false)
                    setEditingId('')
                    setForm(createForm())
                  }}
                >
                  Zavrieť
                </button>
              </div>

              <div className="inspectionGrid">
                <div className="inspectionField">
                  <label htmlFor="customer">Zákazník</label>
                  <select id="customer" style={inputStyle} value={form.customerId} onChange={(event) => selectCustomer(event.target.value)}>
                    <option value="">Vyber zákazníka</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.nazov}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inspectionField">
                  <label htmlFor="customerName">Názov zákazníka</label>
                  <input id="customerName" style={inputStyle} value={form.customerName} onChange={(event) => updateForm('customerName', event.target.value)} />
                </div>

                <div className="inspectionField">
                  <label htmlFor="inspectionDate">Dátum</label>
                  <input id="inspectionDate" type="date" style={inputStyle} value={form.inspectionDate} onChange={(event) => updateForm('inspectionDate', event.target.value)} />
                </div>

                <div className="inspectionField">
                  <label htmlFor="inspectionType">Typ</label>
                  <select id="inspectionType" style={inputStyle} value={form.inspectionType} onChange={(event) => updateForm('inspectionType', event.target.value)}>
                    {INSPECTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inspectionField" style={{ gridColumn: 'span 2' }}>
                  <label htmlFor="siteAddress">Miesto realizácie</label>
                  <input id="siteAddress" style={inputStyle} value={form.siteAddress} onChange={(event) => updateForm('siteAddress', event.target.value)} />
                </div>

                <div className="inspectionField">
                  <label htmlFor="contactName">Kontaktná osoba</label>
                  <input id="contactName" style={inputStyle} value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} />
                </div>

                <div className="inspectionField">
                  <label htmlFor="contactPhone">Telefón</label>
                  <input id="contactPhone" style={inputStyle} value={form.contactPhone} onChange={(event) => updateForm('contactPhone', event.target.value)} />
                </div>

                <div className="inspectionField">
                  <label htmlFor="contactEmail">Email</label>
                  <input id="contactEmail" type="email" style={inputStyle} value={form.contactEmail} onChange={(event) => updateForm('contactEmail', event.target.value)} />
                </div>

                <div className="inspectionField">
                  <label htmlFor="status">Stav</label>
                  <select id="status" style={inputStyle} value={form.status} onChange={(event) => updateForm('status', event.target.value as Inspection['status'])}>
                    <option value="draft">Rozpracovaná</option>
                    <option value="done">Hotová</option>
                    <option value="quoted">V ponuke</option>
                  </select>
                </div>
              </div>

              <div className="inspectionTextGrid">
                <div className="inspectionField">
                  <label htmlFor="requestSummary">Čo zákazník potrebuje</label>
                  <textarea id="requestSummary" className="inspectionTextarea" style={inputStyle} value={form.requestSummary} onChange={(event) => updateForm('requestSummary', event.target.value)} />
                </div>
                <div className="inspectionField">
                  <label htmlFor="currentState">Existujúci stav</label>
                  <textarea id="currentState" className="inspectionTextarea" style={inputStyle} value={form.currentState} onChange={(event) => updateForm('currentState', event.target.value)} />
                </div>
                <div className="inspectionField">
                  <label htmlFor="verificationNotes">Čo treba preveriť</label>
                  <textarea id="verificationNotes" className="inspectionTextarea" style={inputStyle} value={form.verificationNotes} onChange={(event) => updateForm('verificationNotes', event.target.value)} />
                </div>
                <div className="inspectionField">
                  <label htmlFor="quoteNote">Poznámka pre cenovú ponuku</label>
                  <textarea id="quoteNote" className="inspectionTextarea" style={inputStyle} value={form.quoteNote} onChange={(event) => updateForm('quoteNote', event.target.value)} />
                </div>
              </div>

              <div className={isSketchFullscreen ? 'sketchPanel sketchPanelFullscreen' : 'sketchPanel'}>
                <div className="sketchHeader">
                  <strong>Kreslená poznámka</strong>
                  <div className="sketchTools">
                    <button
                      type="button"
                      style={{
                        ...buttonStyle,
                        background: sketchTool === 'pen' ? '#0f172a' : '#fff',
                        borderColor: sketchTool === 'pen' ? '#0f172a' : '#cbd5e1',
                        color: sketchTool === 'pen' ? '#fff' : '#0f172a',
                      }}
                      onClick={() => setSketchTool('pen')}
                    >
                      Pero
                    </button>
                    <button
                      type="button"
                      style={{
                        ...buttonStyle,
                        background: sketchTool === 'eraser' ? '#0f172a' : '#fff',
                        borderColor: sketchTool === 'eraser' ? '#0f172a' : '#cbd5e1',
                        color: sketchTool === 'eraser' ? '#fff' : '#0f172a',
                      }}
                      onClick={() => setSketchTool('eraser')}
                    >
                      Guma
                    </button>
                    {['#0f172a', '#dc2626', '#16a34a', '#2563eb'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Farba ${color}`}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          border: penColor === color ? '3px solid #0f172a' : '1px solid #cbd5e1',
                          background: color,
                          cursor: 'pointer',
                          opacity: sketchTool === 'eraser' ? 0.45 : 1,
                        }}
                        onClick={() => {
                          setPenColor(color)
                          setSketchTool('pen')
                        }}
                      />
                    ))}
                    <select style={{ ...inputStyle, width: 96 }} value={penWidth} onChange={(event) => setPenWidth(Number(event.target.value))}>
                      <option value={2}>Tenké</option>
                      <option value={4}>Stredné</option>
                      <option value={7}>Hrubé</option>
                    </select>
                    <button type="button" style={buttonStyle} onClick={clearSketch}>
                      Vymazať
                    </button>
                    <button type="button" style={buttonStyle} onClick={() => setIsSketchFullscreen((current) => !current)}>
                      {isSketchFullscreen ? 'Zavrieť' : 'Celá obrazovka'}
                    </button>
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={720}
                  className="sketchCanvas"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                />
              </div>

              <div className="inspectionButtonRow">
                <button type="submit" style={{ ...buttonStyle, background: '#84cc16', borderColor: '#65a30d' }} disabled={saving}>
                  {saving ? 'Ukladám...' : 'Uložiť obhliadku'}
                </button>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    setEditingId('')
                    setForm(createForm())
                  }}
                >
                  Vyčistiť
                </button>
              </div>
            </form>
          )}

          <section className="inspectionList" style={boxStyle}>
            <div className="inspectionButtonRow" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ color: '#65a30d', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Evidencia</div>
                <h2>Uložené obhliadky</h2>
              </div>
              <div className="inspectionFilters">
                <input style={{ ...inputStyle, width: 260 }} placeholder="Hľadať..." value={search} onChange={(event) => setSearch(event.target.value)} />
                <select style={{ ...inputStyle, width: 170 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="active">Aktívne</option>
                  <option value="all">Všetky</option>
                  <option value="draft">Rozpracované</option>
                  <option value="done">Hotové</option>
                  <option value="quoted">V ponuke</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="muted">Načítavam...</div>
            ) : filteredInspections.length === 0 ? (
              <div className="muted">Zatiaľ tu nie sú žiadne obhliadky.</div>
            ) : (
              <div className="inspectionItems">
                <div className="inspectionTableHeader">
                  <div>Dátum</div>
                  <div>Typ</div>
                  <div>Zákazník</div>
                  <div>Poznámka</div>
                  <div>Stav</div>
                  <div>Akcie</div>
                </div>
                {filteredInspections.map((inspection) => {
                  return (
                    <article key={inspection.id} className="inspectionRow">
                      <div>
                        <strong>{formatDate(inspection.inspection_date)}</strong>
                        {inspection.site_address && <div className="muted">{inspection.site_address}</div>}
                      </div>
                      <div>{getInspectionTypeLabel(inspection.inspection_type)}</div>
                      <div>
                        <strong>{inspection.customer_name || 'Bez zákazníka'}</strong>
                        {inspection.contact_name && <div className="muted">{inspection.contact_name}</div>}
                      </div>
                      <div>
                        <strong>{inspection.request_summary || inspection.quote_note || '-'}</strong>
                        {inspection.sketch_data_url ? <div className="muted">Kresba uložená</div> : null}
                      </div>
                      <div>
                        <span className="statusBadge">{STATUS_LABELS[inspection.status] || inspection.status}</span>
                      </div>
                      <div className="inspectionButtonRow">
                        <button type="button" style={buttonStyle} onClick={() => editInspection(inspection)}>
                          Upraviť
                        </button>
                        <button type="button" style={buttonStyle} onClick={() => void deleteInspection(inspection.id)}>
                          Zmazať
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}
