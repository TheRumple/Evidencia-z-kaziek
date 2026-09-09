'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BrandLogo } from '@/components/BrandLogo'
import { getSessionWithTimeout } from '@/lib/auth-timeout'
import type { Customer, DeliveryProtocol, Notice } from '@/lib/dashboard-types'
import {
  formatDate,
  getTodayDate,
  loadFirstAvailableImage,
  PDF_FONT_NAME,
  pdfSafeText,
  registerPdfFont,
} from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

type DeliveryProtocolItem = {
  id: string
  name: string
  serialNumber: string
  quantity: string
  note: string
}

const DEFAULT_TECHNICIAN = 'Ľuboš Ivanič'

function createDeliveryProtocolItem(): DeliveryProtocolItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    serialNumber: '',
    quantity: '1',
    note: '',
  }
}

function createDeliveryProtocolItems(count = 1) {
  return Array.from({ length: count }, () => createDeliveryProtocolItem())
}

function normalizeDeliveryProtocolItems(items: unknown): DeliveryProtocolItem[] {
  const sourceItems = Array.isArray(items)
    ? items
    : items && typeof items === 'object' && Array.isArray((items as { rows?: unknown }).rows)
      ? (items as { rows: unknown[] }).rows
      : []

  const normalized = sourceItems
    .map((item) => {
      const raw = item as Partial<DeliveryProtocolItem>
      return {
        id: raw.id || createDeliveryProtocolItem().id,
        name: raw.name || '',
        serialNumber: raw.serialNumber || '',
        quantity: raw.quantity || '1',
        note: raw.note || '',
      }
    })
    .filter((item) => item.name.trim() || item.serialNumber.trim() || item.quantity.trim() || item.note.trim())

  return normalized.length > 0 ? normalized : createDeliveryProtocolItems()
}

function getDeliveryProtocolSignature(protocol: DeliveryProtocol) {
  if (protocol.received_signature) return protocol.received_signature
  if (protocol.items && typeof protocol.items === 'object' && !Array.isArray(protocol.items)) {
    const signature = (protocol.items as { receivedSignature?: unknown }).receivedSignature
    return typeof signature === 'string' ? signature : ''
  }
  return ''
}

function isProtocolSigned(protocol: DeliveryProtocol) {
  return Boolean(getDeliveryProtocolSignature(protocol))
}

function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
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
    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const point = getPoint(event)
    ctx.lineTo(point.x, point.y)
    ctx.strokeStyle = '#020617'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    onChange(canvas.toDataURL('image/png'))
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false
    canvasRef.current?.releasePointerCapture(event.pointerId)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="signatureBox">
      <div className="signatureHeader">
        <span>{label}</span>
        <button type="button" onClick={clearSignature} disabled={!value}>
          Vymazať
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={520}
        height={150}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />
    </div>
  )
}

export default function DeliveryProtocolsPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [protocols, setProtocols] = useState<DeliveryProtocol[]>([])
  const [search, setSearch] = useState('')
  const [signedFilter, setSignedFilter] = useState<'all' | 'signed' | 'unsigned'>('all')

  const [protocolId, setProtocolId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [protocolNumber, setProtocolNumber] = useState('')
  const [customerOrderNumber, setCustomerOrderNumber] = useState('')
  const [protocolDate, setProtocolDate] = useState(getTodayDate())
  const [customerName, setCustomerName] = useState('')
  const [deliveredBy, setDeliveredBy] = useState(DEFAULT_TECHNICIAN)
  const [receivedBy, setReceivedBy] = useState('')
  const [tested, setTested] = useState(true)
  const [briefed, setBriefed] = useState(true)
  const [receivedSignature, setReceivedSignature] = useState('')
  const [items, setItems] = useState<DeliveryProtocolItem[]>(() => createDeliveryProtocolItems())

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

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    borderColor: '#65a30d',
    background: '#73c900',
    color: '#07130a',
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
    void loadData(userId)
  }, [userId])

  async function loadData(currentUserId: string) {
    setLoading(true)
    const [customersResult, protocolsResult] = await Promise.all([
      supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov', { ascending: true }),
      supabase.from('delivery_protocols').select('*').eq('user_id', currentUserId).order('updated_at', { ascending: false }),
    ])
    setLoading(false)

    if (customersResult.error) {
      setNotice({ type: 'error', text: `Zákazníci: ${customersResult.error.message}` })
    } else {
      setCustomers((customersResult.data || []) as Customer[])
    }

    if (protocolsResult.error) {
      if (protocolsResult.error.code === '42P01') {
        setProtocols([])
        setNotice({
          type: 'error',
          text: 'Chýba tabuľka delivery_protocols. Spusť SQL skript scripts/supabase-delivery-protocols.sql v Supabase.',
        })
      } else {
        setNotice({ type: 'error', text: `Odovzdávacie protokoly: ${protocolsResult.error.message}` })
      }
    } else {
      setProtocols((protocolsResult.data || []) as DeliveryProtocol[])
    }
  }

  const filteredProtocols = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return protocols
      .filter((protocol) => {
        const signed = isProtocolSigned(protocol)
        if (signedFilter === 'signed' && !signed) return false
        if (signedFilter === 'unsigned' && signed) return false
        if (!needle) return true
        return [protocol.protocol_number, protocol.customer_order_number, protocol.customer_name, protocol.received_by]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      })
      .sort((a, b) => {
        const aNumber = a.protocol_number || ''
        const bNumber = b.protocol_number || ''
        if (aNumber !== bNumber) return bNumber.localeCompare(aNumber, 'sk', { numeric: true })
        return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      })
  }, [protocols, search, signedFilter])

  function resetForm() {
    setProtocolId('')
    setCustomerId('')
    setProtocolNumber('')
    setCustomerOrderNumber('')
    setProtocolDate(getTodayDate())
    setCustomerName('')
    setDeliveredBy(DEFAULT_TECHNICIAN)
    setReceivedBy('')
    setTested(true)
    setBriefed(true)
    setReceivedSignature('')
    setItems(createDeliveryProtocolItems())
  }

  function selectCustomer(value: string) {
    const customer = customers.find((item) => item.id === value)
    setCustomerId(value)
    setCustomerName(customer?.nazov || '')
    setReceivedBy(customer?.kontakt || '')
  }

  function openProtocol(protocol: DeliveryProtocol) {
    setProtocolId(protocol.id)
    setCustomerId(protocol.customer_id || '')
    setProtocolNumber(protocol.protocol_number || '')
    setCustomerOrderNumber(protocol.customer_order_number || '')
    setProtocolDate(protocol.protocol_date || getTodayDate())
    setCustomerName(protocol.customer_name || '')
    setDeliveredBy(protocol.delivered_by || DEFAULT_TECHNICIAN)
    setReceivedBy(protocol.received_by || '')
    setTested(Boolean(protocol.tested))
    setBriefed(Boolean(protocol.briefed))
    setReceivedSignature(getDeliveryProtocolSignature(protocol))
    setItems(normalizeDeliveryProtocolItems(protocol.items))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveProtocol() {
    if (!userId) return null
    const cleanItems = items.filter((item) => item.name.trim() || item.serialNumber.trim() || item.quantity.trim() || item.note.trim())
    if (cleanItems.length === 0) {
      setNotice({ type: 'error', text: 'Doplň aspoň jednu odovzdávanú položku.' })
      return null
    }

    const payload = {
      user_id: userId,
      customer_id: customerId || null,
      protocol_number: protocolNumber.trim(),
      customer_order_number: customerOrderNumber.trim() || null,
      protocol_date: protocolDate,
      customer_name: customerName.trim() || null,
      delivered_by: deliveredBy.trim() || null,
      received_by: receivedBy.trim() || null,
      tested,
      briefed,
      items: {
        rows: cleanItems,
        receivedSignature: receivedSignature || null,
      },
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const query = protocolId
      ? supabase.from('delivery_protocols').update(payload).eq('id', protocolId).eq('user_id', userId).select().single()
      : supabase.from('delivery_protocols').insert([payload]).select().single()

    const { data, error } = await query
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Protokol sa neuložil: ${error.message}` })
      return null
    }

    const saved = data as DeliveryProtocol
    setProtocolId(saved.id)
    setProtocols((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
    setNotice({ type: 'success', text: 'Odovzdávací protokol je uložený.' })
    return saved
  }

  function updateItem(index: number, field: keyof Omit<DeliveryProtocolItem, 'id'>, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  async function exportPdf(action: 'show' | 'mail' = 'show') {
    const filledItems = items.filter((item) => item.name.trim() || item.serialNumber.trim() || item.quantity.trim() || item.note.trim())
    if (filledItems.length === 0) {
      setNotice({ type: 'error', text: 'Doplň aspoň jednu odovzdávanú položku.' })
      return
    }

    try {
      const saved = await saveProtocol()
      if (!saved) return

      const logoDataUrl = await loadFirstAvailableImage(['/delivery-protocol-logo.png'])
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      await registerPdfFont(doc)

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 14
      const safeProtocolNumber = pdfSafeText(protocolNumber)
      const safeCustomerOrderNumber = pdfSafeText(customerOrderNumber)
      const safeCustomerName = pdfSafeText(customerName)
      const safeDeliveredBy = pdfSafeText(deliveredBy)
      const safeReceivedBy = pdfSafeText(receivedBy)

      function drawHeader(pageNumber: number) {
        doc.setTextColor(15, 23, 42)
        doc.setFont(PDF_FONT_NAME, 'normal')
        doc.setCharSpace(0)
        if (pageNumber !== 1) return

        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', margin, 14, 22, 22)
        } else {
          doc.setFont(PDF_FONT_NAME, 'bold')
          doc.setFontSize(35)
          doc.text('ITspot', margin, 29)
        }

        doc.setFont(PDF_FONT_NAME, 'bold')
        doc.setFontSize(11)
        doc.text('ITspot s. r. o.', pageWidth - margin, 16, { align: 'right' })
        doc.setFont(PDF_FONT_NAME, 'normal')
        doc.setFontSize(8.5)
        doc.text('Hájles 1703/6, 968 01 Nová Baňa', pageWidth - margin, 20.5, { align: 'right' })
        doc.text('IČO: 56430388', pageWidth - margin, 25, { align: 'right' })
        doc.text('IČ DPH: SK2122307462', pageWidth - margin, 29.5, { align: 'right' })
      }

      function drawFooter(pageNumber: number, totalPages: number) {
        doc.setTextColor(100, 116, 139)
        doc.setFont(PDF_FONT_NAME, 'normal')
        doc.setFontSize(8)
        doc.text('info@itspot.sk | +421 908 806 691 | www.itspot.sk', margin, pageHeight - 5)
        doc.text('Vygenerované z aplikácie ITspot', pageWidth / 2, pageHeight - 5, { align: 'center' })
        doc.text(`Strana ${pageNumber} z ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
      }

      drawHeader(1)
      doc.setTextColor(15, 23, 42)
      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(18)
      doc.text('ODOVZDÁVACÍ PROTOKOL', margin, 48)

      doc.setFontSize(10)
      doc.text('Číslo protokolu:', margin, 58)
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.text(safeProtocolNumber, margin + 33, 58)

      const customerInfoY = safeCustomerOrderNumber ? 76 : 70
      const separatorY = safeCustomerOrderNumber ? 90 : 84
      const tableTitleY = safeCustomerOrderNumber ? 99 : 93
      const tableStartY = safeCustomerOrderNumber ? 104 : 98

      if (safeCustomerOrderNumber) {
        doc.setFont(PDF_FONT_NAME, 'bold')
        doc.text('Číslo objednávky:', margin, 64)
        doc.setFont(PDF_FONT_NAME, 'normal')
        doc.text(safeCustomerOrderNumber, margin + 36, 64)
      }

      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.text('Zákazník:', margin, customerInfoY)
      doc.text('Dátum odovzdania:', 112, customerInfoY)
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.text(safeCustomerName, margin, customerInfoY + 6)
      doc.text(formatDate(protocolDate) || '-', 112, customerInfoY + 6)

      doc.setDrawColor(15, 23, 42)
      doc.setLineWidth(0.4)
      doc.line(margin, separatorY, pageWidth - margin, separatorY)

      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(11)
      doc.text('ZOZNAM ODOVZDANEJ TECHNIKY A PRÍSLUŠENSTVA', margin, tableTitleY)

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin, bottom: 54 },
        head: [['P. č.', 'Zariadenie / položka', 'Sériové číslo (S/N)', 'Ks', 'Poznámka']],
        body: filledItems.map((item, index) => [
          String(index + 1),
          pdfSafeText(item.name || '-'),
          pdfSafeText(item.serialNumber || '-'),
          pdfSafeText(item.quantity || '1'),
          pdfSafeText(item.note || ''),
        ]),
        styles: {
          font: PDF_FONT_NAME,
          fontSize: 9,
          cellPadding: 2.2,
          textColor: [15, 23, 42],
          lineColor: [203, 213, 225],
          lineWidth: 0.25,
          valign: 'top',
          overflow: 'linebreak',
        },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
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
      if (confirmationY > pageHeight - 86) doc.addPage()

      const footerStartY = doc.getCurrentPageInfo().pageNumber === 1 ? confirmationY : 28
      doc.setTextColor(15, 23, 42)
      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(11)
      doc.text('POTVRDENIE', margin, footerStartY)
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.setFontSize(10)
      doc.text(`${tested ? '[x]' : '[ ]'} Zariadenie bolo odskúšané a je funkčné.`, margin, footerStartY + 8)
      doc.text(`${briefed ? '[x]' : '[ ]'} Zákazník bol oboznámený so základnou obsluhou.`, margin, footerStartY + 15)

      const signatureY = footerStartY + 34
      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.text('ODOVZDAL', margin, signatureY)
      doc.text('PREVZAL', 112, signatureY)
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.text(`Meno: ${safeDeliveredBy}`, margin, signatureY + 10)
      doc.text(`Meno: ${safeReceivedBy}`, 112, signatureY + 10)
      if (receivedSignature) doc.addImage(receivedSignature, 'PNG', 114, signatureY + 12, 58, 15)
      doc.line(112, signatureY + 28, pageWidth - margin, signatureY + 28)
      doc.setFontSize(8)
      doc.text('Podpis', 112, signatureY + 33)

      const totalPages = doc.getNumberOfPages()
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page)
        drawHeader(page)
        drawFooter(page, totalPages)
      }

      const safeName = pdfSafeText(`${safeProtocolNumber}-${safeCustomerName}`).replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() || 'odovzdavaci-protokol'
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)

      if (action === 'mail') {
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeName}.pdf`
        a.click()

        const selectedCustomer = customers.find((customer) => customer.id === customerId)
        const recipient = selectedCustomer?.email || ''
        const subject = `Odovzdávací protokol ${safeProtocolNumber}`
        const body = ['Dobrý deň,', '', 'v prílohe posielame odovzdávací protokol.', '', 'S pozdravom', 'ITspot s. r. o.'].join('\n')
        window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        setNotice({ type: 'success', text: selectedCustomer?.email ? 'PDF bolo stiahnuté. Prilož ho do otvoreného emailu.' : 'PDF bolo stiahnuté a email otvorený. Zákazník nemá vyplnený email, doplň adresu ručne.' })
      } else {
        const win = window.open(url, '_blank')
        if (!win) {
          const a = document.createElement('a')
          a.href = url
          a.download = `${safeName}.pdf`
          a.click()
        }
        setNotice({ type: 'success', text: 'Odovzdávací protokol bol otvorený.' })
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznáma chyba.'
      setNotice({ type: 'error', text: `Protokol sa nepodarilo vytvoriť: ${message}` })
    }
  }

  if (checkingAuth) return <main className="loadingPage">Načítavam...</main>

  return (
    <main className="page">
      <style jsx>{`
        .page { min-height:100vh; padding:18px; background:linear-gradient(135deg,#eef4fb 0%,#f7fbf2 100%); color:#0f172a; }
        .shell { max-width:1780px; margin:0 auto; display:grid; gap:12px; }
        .topbar, .panel { background:#fff; border:1px solid #dbe4ef; border-radius:14px; box-shadow:0 12px 34px rgba(15,23,42,.08); }
        .topbar { padding:12px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandWrap h1 { margin:0; font-size:28px; letter-spacing:0; }
        .brandWrap p { margin:2px 0 0; color:#64748b; font-weight:800; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; }
        .notice { border-radius:10px; padding:9px 11px; font-weight:900; font-size:13px; }
        .notice.success { background:#dcfce7; color:#166534; border:1px solid #86efac; }
        .notice.error { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
        .editorGrid { display:grid; grid-template-columns:minmax(360px,.8fr) minmax(620px,1.2fr); gap:12px; align-items:start; }
        .panel { padding:12px; }
        .eyebrow { color:#65c900; font-size:12px; font-weight:1000; letter-spacing:2px; text-transform:uppercase; }
        h2 { margin:2px 0 12px; font-size:24px; letter-spacing:0; }
        label { display:block; margin-bottom:4px; color:#334155; font-size:12px; font-weight:900; }
        .formGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
        .full { grid-column:1 / -1; }
        .checks { border:1px solid #e2e8f0; border-radius:10px; padding:9px; display:grid; gap:8px; background:#f8fafc; }
        .checks label { display:flex; align-items:center; gap:8px; margin:0; color:#0f172a; }
        .checks input { width:17px; height:17px; }
        .itemsTable { overflow:auto; border:1px solid #e2e8f0; border-radius:10px; }
        .itemsHead, .itemRow { display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(130px,.7fr) 58px minmax(160px,.9fr) 38px; min-width:740px; gap:6px; align-items:center; padding:7px; }
        .itemsHead { background:#0f172a; color:#fff; font-size:11px; font-weight:1000; text-transform:uppercase; }
        .itemRow { border-top:1px solid #e2e8f0; background:#fff; }
        .listHeader { display:flex; justify-content:space-between; gap:10px; align-items:end; flex-wrap:wrap; margin-bottom:10px; }
        .filters { display:flex; gap:8px; flex-wrap:wrap; }
        .protocolTable { overflow:auto; border:1px solid #e2e8f0; border-radius:10px; }
        .protocolHead, .protocolRow { display:grid; grid-template-columns:110px minmax(170px,1fr) minmax(135px,.7fr) 100px 120px 190px; min-width:900px; gap:8px; align-items:center; padding:8px 10px; }
        .protocolHead { background:#f1f5f9; color:#475569; font-size:11px; font-weight:1000; text-transform:uppercase; }
        .protocolRow { border-top:1px solid #e2e8f0; font-size:13px; font-weight:900; cursor:pointer; background:#fff; }
        .protocolRow:hover, .protocolRow.active { background:#f7fee7; }
        .badge { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:4px 8px; font-size:11px; font-weight:1000; border:1px solid; }
        .badge.signed { background:#dcfce7; color:#166534; border-color:#86efac; }
        .badge.unsigned { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
        .rowActions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
        .signatureBox { display:grid; gap:8px; }
        .signatureHeader { display:flex; justify-content:space-between; align-items:center; gap:10px; color:#0f172a; font-weight:900; }
        .signatureHeader button { border:1px solid #cbd5e1; background:#fff; border-radius:8px; padding:6px 9px; color:#334155; font-weight:900; }
        .signatureHeader button:disabled { opacity:.45; }
        canvas { width:100%; height:130px; background:#fff; border:1px dashed #94a3b8; border-radius:12px; cursor:crosshair; touch-action:none; }
        .loadingPage { min-height:100vh; padding:28px; background:#020617; color:#fff; font-weight:900; }
        @media (max-width:980px) {
          .page { padding:10px; }
          .editorGrid { grid-template-columns:1fr; }
          .brandWrap h1 { font-size:24px; }
          .formGrid { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="shell">
        <header className="topbar">
          <div className="brandWrap">
            <BrandLogo size="sm" />
            <div>
              <h1>Odovzdávacie protokoly</h1>
              <p>Príprava, podpis, PDF a odoslanie zákazníkovi.</p>
            </div>
          </div>
          <div className="actions">
            <Link href="/" style={buttonStyle}>Domov</Link>
            <button type="button" style={primaryButtonStyle} onClick={resetForm}>+ Nový protokol</button>
          </div>
        </header>

        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

        <section className="editorGrid">
          <div className="panel">
            <div className="eyebrow">{protocolId ? 'Úprava protokolu' : 'Nový protokol'}</div>
            <h2>Základné údaje</h2>
            <div className="formGrid">
              <div>
                <label htmlFor="protocol-number">Číslo protokolu</label>
                <input id="protocol-number" style={inputStyle} value={protocolNumber} onChange={(event) => setProtocolNumber(event.target.value)} />
              </div>
              <div>
                <label htmlFor="protocol-date">Dátum odovzdania</label>
                <input id="protocol-date" type="date" style={inputStyle} value={protocolDate} onChange={(event) => setProtocolDate(event.target.value)} />
              </div>
              <div>
                <label htmlFor="customer-order">Číslo objednávky zákazníka</label>
                <input id="customer-order" style={inputStyle} placeholder="Voliteľné" value={customerOrderNumber} onChange={(event) => setCustomerOrderNumber(event.target.value)} />
              </div>
              <div>
                <label htmlFor="customer">Zákazník</label>
                <select id="customer" style={inputStyle} value={customerId} onChange={(event) => selectCustomer(event.target.value)}>
                  <option value="">Vyber zákazníka</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.nazov}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="delivered-by">Odovzdal</label>
                <input id="delivered-by" style={inputStyle} value={deliveredBy} onChange={(event) => setDeliveredBy(event.target.value)} />
              </div>
              <div>
                <label htmlFor="received-by">Prevzal</label>
                <input id="received-by" style={inputStyle} value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} />
              </div>
              <div className="full checks">
                <label>
                  <input type="checkbox" checked={tested} onChange={(event) => setTested(event.target.checked)} />
                  Zariadenie bolo odskúšané a je funkčné.
                </label>
                <label>
                  <input type="checkbox" checked={briefed} onChange={(event) => setBriefed(event.target.checked)} />
                  Zákazník bol oboznámený so základnou obsluhou.
                </label>
              </div>
              <div className="full">
                <SignaturePad label="Podpis prevzal" value={receivedSignature} onChange={setReceivedSignature} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="listHeader">
              <div>
                <div className="eyebrow">Odovzdaná technika</div>
                <h2>Položky protokolu</h2>
              </div>
              <button type="button" style={buttonStyle} onClick={() => setItems((current) => [...current, createDeliveryProtocolItem()])}>
                + Pridať položku
              </button>
            </div>
            <div className="itemsTable">
              <div className="itemsHead">
                <div>Zariadenie / položka</div>
                <div>Sériové číslo</div>
                <div>Ks</div>
                <div>Poznámka</div>
                <div></div>
              </div>
              {items.map((item, index) => (
                <div className="itemRow" key={item.id}>
                  <input style={inputStyle} placeholder="Napr. kamera, NVR, klávesnica" value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} />
                  <input style={inputStyle} placeholder="S/N" value={item.serialNumber} onChange={(event) => updateItem(index, 'serialNumber', event.target.value)} />
                  <input style={inputStyle} inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                  <input style={inputStyle} placeholder="Voliteľné" value={item.note} onChange={(event) => updateItem(index, 'note', event.target.value)} />
                  <button type="button" style={buttonStyle} disabled={items.length <= 1} onClick={() => setItems((current) => (current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 10 }}>
              <button type="button" style={buttonStyle} onClick={saveProtocol} disabled={saving}>
                {saving ? 'Ukladám...' : 'Uložiť protokol'}
              </button>
              <button type="button" style={primaryButtonStyle} onClick={() => exportPdf('show')}>Ukáž PDF</button>
              <button type="button" style={primaryButtonStyle} onClick={() => exportPdf('mail')}>Odoslať mailom</button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="listHeader">
            <div>
              <div className="eyebrow">Evidencia</div>
              <h2>Uložené protokoly {loading ? '' : `(${filteredProtocols.length})`}</h2>
            </div>
            <div className="filters">
              <input style={{ ...inputStyle, width: 260 }} placeholder="Hľadať..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <select style={{ ...inputStyle, width: 190 }} value={signedFilter} onChange={(event) => setSignedFilter(event.target.value as typeof signedFilter)}>
                <option value="all">Všetky podpisy</option>
                <option value="unsigned">Nepodpísané</option>
                <option value="signed">Podpísané</option>
              </select>
            </div>
          </div>

          <div className="protocolTable">
            <div className="protocolHead">
              <div>Číslo</div>
              <div>Zákazník</div>
              <div>Objednávka</div>
              <div>Dátum</div>
              <div>Podpis</div>
              <div>Akcie</div>
            </div>
            {filteredProtocols.map((protocol) => {
              const signed = isProtocolSigned(protocol)
              return (
                <div className={`protocolRow ${protocol.id === protocolId ? 'active' : ''}`} key={protocol.id} onClick={() => openProtocol(protocol)}>
                  <div>{protocol.protocol_number || 'Bez čísla'}</div>
                  <div>{protocol.customer_name || 'Bez zákazníka'}</div>
                  <div style={{ color: '#64748b' }}>{protocol.customer_order_number || '-'}</div>
                  <div>{formatDate(protocol.protocol_date)}</div>
                  <div><span className={`badge ${signed ? 'signed' : 'unsigned'}`}>{signed ? 'Podpísané' : 'Nepodpísané'}</span></div>
                  <div className="rowActions">
                    <button type="button" style={buttonStyle} onClick={(event) => { event.stopPropagation(); openProtocol(protocol) }}>Upraviť</button>
                  </div>
                </div>
              )
            })}
            {!loading && filteredProtocols.length === 0 && (
              <div style={{ padding: 14, color: '#64748b', fontWeight: 900 }}>Zatiaľ tu nie sú žiadne protokoly.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
