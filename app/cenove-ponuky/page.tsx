'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/BrandLogo'
import type { Customer, Notice, Quote } from '@/lib/dashboard-types'
import { formatDate, getTodayDate } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

type QuoteItem = {
  id: string
  name: string
  note: string
  quantity: string
  unit: string
  unitPrice: string
  vatRate: string
}

const STATUS_LABELS: Record<Quote['status'], string> = {
  draft: 'Rozpracovaná',
  sent: 'Odoslaná',
  approved: 'Schválená',
  rejected: 'Zamietnutá',
}

const statusStyle: Record<Quote['status'], CSSProperties> = {
  draft: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  sent: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  approved: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  rejected: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
}

function createQuoteItem(): QuoteItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    note: '',
    quantity: '1',
    unit: 'ks',
    unitPrice: '',
    vatRate: '23',
  }
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return getTodayDate()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return `${value.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeItems(items: unknown): QuoteItem[] {
  if (!Array.isArray(items)) return [createQuoteItem()]
  const normalized = items
    .map((item) => {
      const raw = item as Partial<QuoteItem>
      return {
        id: raw.id || createQuoteItem().id,
        name: raw.name || '',
        note: raw.note || '',
        quantity: raw.quantity || '1',
        unit: raw.unit || 'ks',
        unitPrice: raw.unitPrice || '',
        vatRate: raw.vatRate || '23',
      }
    })
    .filter((item) => item.name.trim() || item.note.trim() || item.unitPrice.trim())
  return normalized.length > 0 ? normalized : [createQuoteItem()]
}

function getItemTotals(item: QuoteItem) {
  const quantity = parseMoney(item.quantity)
  const unitPrice = parseMoney(item.unitPrice)
  const vatRate = parseMoney(item.vatRate)
  const net = quantity * unitPrice
  const vat = net * (vatRate / 100)
  return {
    net,
    vat,
    gross: net + vat,
  }
}

export default function QuotesPage() {
  const router = useRouter()
  const formRef = useRef<HTMLElement | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])

  const [editingId, setEditingId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [quoteNumber, setQuoteNumber] = useState('')
  const [quoteDate, setQuoteDate] = useState(getTodayDate())
  const [validUntil, setValidUntil] = useState(addDays(getTodayDate(), 14))
  const [status, setStatus] = useState<Quote['status']>('draft')
  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [realizationNote, setRealizationNote] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([createQuoteItem()])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  useEffect(() => {
    if (editingId || quoteNumber) return
    setQuoteNumber(generateQuoteNumber())
  }, [editingId, quoteNumber, quotes])

  const totals = useMemo(() => {
    return items.reduce(
      (sum, item) => {
        const itemTotals = getItemTotals(item)
        return {
          net: sum.net + itemTotals.net,
          vat: sum.vat + itemTotals.vat,
          gross: sum.gross + itemTotals.gross,
        }
      },
      { net: 0, vat: 0, gross: 0 }
    )
  }, [items])

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase()
    return quotes.filter((quote) => {
      const matchesStatus = statusFilter === 'all' || quote.status === statusFilter
      const matchesSearch =
        !term ||
        quote.quote_number.toLowerCase().includes(term) ||
        quote.title.toLowerCase().includes(term) ||
        (quote.customer_name || '').toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [quotes, search, statusFilter])

  async function loadData(currentUserId: string) {
    setLoading(true)
    try {
      const [customersResult, quotesResult] = await Promise.all([
        supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov', { ascending: true }),
        supabase.from('quotes').select('*').eq('user_id', currentUserId).order('updated_at', { ascending: false }),
      ])

      if (customersResult.error) {
        setNotice({ type: 'error', text: `Zákazníci: ${customersResult.error.message}` })
      } else {
        setCustomers((customersResult.data || []) as Customer[])
      }

      if (quotesResult.error) {
        if (quotesResult.error.code === '42P01') {
          setNotice({
            type: 'error',
            text: 'Chýba tabuľka quotes. Spusť SQL skript scripts/supabase-quotes.sql v Supabase.',
          })
        } else {
          setNotice({ type: 'error', text: `Cenové ponuky: ${quotesResult.error.message}` })
        }
      } else {
        setQuotes((quotesResult.data || []) as Quote[])
      }
    } finally {
      setLoading(false)
    }
  }

  function generateQuoteNumber() {
    const year = new Date().getFullYear()
    const currentYearQuotes = quotes.filter((quote) => quote.quote_number.includes(`CP-${year}-`))
    const nextNumber = currentYearQuotes.length + 1
    return `CP-${year}-${String(nextNumber).padStart(3, '0')}`
  }

  function resetForm() {
    const today = getTodayDate()
    setEditingId('')
    setCustomerId('')
    setQuoteNumber(generateQuoteNumber())
    setQuoteDate(today)
    setValidUntil(addDays(today, 14))
    setStatus('draft')
    setTitle('')
    setCustomerName('')
    setContactName('')
    setContactEmail('')
    setRealizationNote('')
    setNote('')
    setItems([createQuoteItem()])
  }

  function startNewQuote() {
    resetForm()
    setNotice({ type: 'success', text: 'Nová cenová ponuka je pripravená.' })
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function selectCustomer(customerIdValue: string) {
    const customer = customers.find((item) => item.id === customerIdValue)
    setCustomerId(customerIdValue)
    setCustomerName(customer?.nazov || '')
    setContactName(customer?.kontakt || '')
    setContactEmail(customer?.email || '')
  }

  function startEdit(quote: Quote) {
    setEditingId(quote.id)
    setCustomerId(quote.customer_id || '')
    setQuoteNumber(quote.quote_number)
    setQuoteDate(quote.quote_date || getTodayDate())
    setValidUntil(quote.valid_until || addDays(getTodayDate(), 14))
    setStatus(quote.status)
    setTitle(quote.title || '')
    setCustomerName(quote.customer_name || '')
    setContactName(quote.contact_name || '')
    setContactEmail(quote.contact_email || '')
    setRealizationNote(quote.realization_note || '')
    setNote(quote.note || '')
    setItems(normalizeItems(quote.items))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateItem(index: number, field: keyof Omit<QuoteItem, 'id'>, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  function addItem() {
    setItems((current) => [...current, createQuoteItem()])
  }

  function removeItem(index: number) {
    setItems((current) => (current.length <= 1 ? current : current.filter((_item, itemIndex) => itemIndex !== index)))
  }

  async function saveQuote() {
    if (!userId) return
    const cleanItems = items.filter((item) => item.name.trim() || item.note.trim() || item.unitPrice.trim())

    if (!title.trim()) {
      setNotice({ type: 'error', text: 'Zadaj názov ponuky.' })
      return
    }

    if (!customerName.trim()) {
      setNotice({ type: 'error', text: 'Vyber alebo zadaj zákazníka.' })
      return
    }

    if (cleanItems.length === 0) {
      setNotice({ type: 'error', text: 'Doplň aspoň jednu položku ponuky.' })
      return
    }

    const payload = {
      user_id: userId,
      customer_id: customerId || null,
      quote_number: quoteNumber.trim() || generateQuoteNumber(),
      quote_date: quoteDate,
      valid_until: validUntil || null,
      status,
      title: title.trim(),
      customer_name: customerName.trim(),
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      realization_note: realizationNote.trim() || null,
      note: note.trim() || null,
      items: cleanItems,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const request = editingId
      ? supabase.from('quotes').update(payload).eq('id', editingId).eq('user_id', userId).select().single()
      : supabase.from('quotes').insert([payload]).select().single()

    const { data, error } = await request
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Ponuka sa neuložila: ${error.message}` })
      return
    }

    const saved = data as Quote
    setQuotes((current) => {
      const withoutSaved = current.filter((quote) => quote.id !== saved.id)
      return [saved, ...withoutSaved]
    })
    startEdit(saved)
    setNotice({ type: 'success', text: editingId ? 'Ponuka bola upravená.' : 'Ponuka bola uložená.' })
  }

  function getPrintableHtml(quoteLike?: Quote) {
    const source = quoteLike
      ? {
          number: quoteLike.quote_number,
          date: quoteLike.quote_date,
          valid: quoteLike.valid_until || '',
          title: quoteLike.title,
          customer: quoteLike.customer_name || '',
          contact: quoteLike.contact_name || '',
          email: quoteLike.contact_email || '',
          realization: quoteLike.realization_note || '',
          note: quoteLike.note || '',
          items: normalizeItems(quoteLike.items),
        }
      : {
          number: quoteNumber || generateQuoteNumber(),
          date: quoteDate,
          valid: validUntil,
          title,
          customer: customerName,
          contact: contactName,
          email: contactEmail,
          realization: realizationNote,
          note,
          items: items.filter((item) => item.name.trim() || item.note.trim() || item.unitPrice.trim()),
        }

    const quoteTotals = source.items.reduce(
      (sum, item) => {
        const itemTotals = getItemTotals(item)
        return { net: sum.net + itemTotals.net, vat: sum.vat + itemTotals.vat, gross: sum.gross + itemTotals.gross }
      },
      { net: 0, vat: 0, gross: 0 }
    )

    const rows = source.items
      .map((item, index) => {
        const itemTotals = getItemTotals(item)
        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <div class="item-name">${escapeHtml(item.name || '-')}</div>
              ${item.note.trim() ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ''}
            </td>
            <td class="num">${escapeHtml(item.quantity || '1')}</td>
            <td>${escapeHtml(item.unit || 'ks')}</td>
            <td class="num">${formatMoney(parseMoney(item.unitPrice))}</td>
            <td class="num">${escapeHtml(item.vatRate || '23')} %</td>
            <td class="num">${formatMoney(itemTotals.gross)}</td>
          </tr>`
      })
      .join('')

    return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(source.number)} - ${escapeHtml(source.customer)}</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#dbe3ee; --soft:#f5f8fc; --lime:#77d20b; --deep:#101827; }
  * { box-sizing: border-box; }
  body { margin:0; background:#dfe7f1; color:var(--ink); font-family:Arial,Helvetica,sans-serif; padding:28px; }
  .page { width:210mm; min-height:297mm; margin:0 auto; background:white; box-shadow:0 24px 70px rgba(15,23,42,.18); padding:18mm; position:relative; overflow:hidden; }
  .page:before { content:""; position:absolute; inset:0 0 auto; height:7mm; background:linear-gradient(90deg,var(--deep),#1e293b 62%,var(--lime)); }
  .header { display:grid; grid-template-columns:1fr 1.1fr; gap:18mm; padding-top:8mm; align-items:start; }
  .brand { display:flex; gap:12px; align-items:center; }
  .brand img { width:48px; height:48px; object-fit:contain; }
  .brand-title { font-size:26px; font-weight:900; }
  .brand-sub { margin-top:3px; font-size:12px; color:var(--muted); font-weight:700; }
  .company { margin-top:12mm; font-size:11px; line-height:1.55; color:#334155; }
  .quote-box { border:1px solid var(--line); border-radius:14px; padding:16px 18px; background:linear-gradient(145deg,#fff,#f8fafc); }
  .quote-label { font-size:11px; color:var(--muted); text-transform:uppercase; font-weight:900; letter-spacing:.08em; }
  .quote-number { margin-top:7px; font-size:30px; font-weight:900; color:var(--deep); }
  .quote-meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; font-size:12px; }
  .meta-card { border-radius:10px; background:var(--soft); padding:10px; }
  .meta-card span { display:block; color:var(--muted); font-weight:800; font-size:10px; text-transform:uppercase; }
  .meta-card strong { display:block; margin-top:4px; font-size:13px; }
  .customer-row { display:grid; grid-template-columns:1fr 1fr; gap:12mm; margin-top:18mm; }
  .panel { border:1px solid var(--line); border-radius:14px; padding:14px; }
  .panel h2 { margin:0 0 10px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  .panel .name { font-size:18px; font-weight:900; margin-bottom:6px; }
  .panel p { margin:0; color:#475569; font-size:12px; line-height:1.55; white-space:pre-line; }
  .offer-title { margin-top:16mm; padding:16px 18px; border-radius:16px; color:white; background:linear-gradient(135deg,#111827,#1f2937 70%,#365314); }
  .offer-title span { color:#b7f45a; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
  .offer-title h1 { margin:6px 0 0; font-size:26px; line-height:1.18; }
  table { width:100%; border-collapse:collapse; margin-top:12mm; font-size:11px; }
  th { background:var(--deep); color:white; padding:10px 9px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.04em; }
  th:first-child { border-radius:10px 0 0 10px; } th:last-child { border-radius:0 10px 10px 0; }
  td { padding:11px 9px; border-bottom:1px solid #edf2f7; vertical-align:top; }
  tbody tr:nth-child(even) td { background:#fafcff; }
  .num { text-align:right; white-space:nowrap; }
  .item-name { font-weight:900; }
  .item-note { margin-top:3px; color:var(--muted); font-size:10px; }
  .summary { display:grid; grid-template-columns:1fr 78mm; gap:12mm; margin-top:12mm; align-items:start; }
  .terms { background:var(--soft); border-radius:14px; padding:14px; color:#475569; font-size:11px; line-height:1.55; white-space:pre-line; }
  .terms strong { display:block; color:var(--ink); margin-bottom:6px; }
  .totals { border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .total-row { display:flex; justify-content:space-between; gap:12px; padding:11px 14px; border-bottom:1px solid var(--line); font-size:12px; }
  .total-row strong { font-size:13px; }
  .total-row.final { background:var(--deep); color:white; border-bottom:0; align-items:baseline; }
  .total-row.final strong { font-size:24px; }
  .footer { position:absolute; left:18mm; right:18mm; bottom:12mm; display:flex; justify-content:space-between; gap:20px; border-top:1px solid var(--line); padding-top:10px; color:var(--muted); font-size:10px; font-weight:800; }
  .toolbar { position:fixed; right:20px; top:20px; display:flex; gap:8px; z-index:10; }
  .toolbar button { border:0; border-radius:10px; background:#77d20b; color:#111827; padding:10px 14px; font-weight:900; cursor:pointer; }
  @media print { body { background:white; padding:0; } .page { box-shadow:none; margin:0; } .toolbar { display:none; } }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">Tlačiť / uložiť PDF</button></div>
<main class="page">
  <section class="header">
    <div>
      <div class="brand">
        <img src="/delivery-protocol-logo.png" alt="ITspot" />
        <div><div class="brand-title">ITspot</div><div class="brand-sub">Servis, montáž a inteligentné technológie</div></div>
      </div>
      <div class="company"><strong>ITspot s. r. o.</strong><br />Hájles 1703/6, 968 01 Nová Baňa<br />IČO: 56430388 · DIČ: 2122307462<br />IČ DPH: SK2122307462<br />info@itspot.sk · +421 908 806 691</div>
    </div>
    <div class="quote-box">
      <div class="quote-label">Cenová ponuka</div>
      <div class="quote-number">${escapeHtml(source.number)}</div>
      <div class="quote-meta">
        <div class="meta-card"><span>Vystavené</span><strong>${formatDate(source.date)}</strong></div>
        <div class="meta-card"><span>Platnosť</span><strong>${source.valid ? formatDate(source.valid) : '-'}</strong></div>
      </div>
    </div>
  </section>
  <section class="customer-row">
    <div class="panel"><h2>Odberateľ</h2><div class="name">${escapeHtml(source.customer || 'Bez zákazníka')}</div><p>${source.contact ? `Kontaktná osoba: ${escapeHtml(source.contact)}<br />` : ''}${source.email ? `Email: ${escapeHtml(source.email)}` : ''}</p></div>
    <div class="panel"><h2>Realizácia</h2><div class="name">${escapeHtml(source.title || 'Cenová ponuka')}</div><p>${escapeHtml(source.realization || 'Termín realizácie podľa dohody.')}</p></div>
  </section>
  <section class="offer-title"><span>Návrh riešenia</span><h1>${escapeHtml(source.title || 'Cenová ponuka')}</h1></section>
  <table>
    <thead><tr><th style="width:8%">Č.</th><th>Položka</th><th style="width:10%" class="num">Množstvo</th><th style="width:10%">MJ</th><th style="width:14%" class="num">Cena bez DPH</th><th style="width:12%" class="num">DPH</th><th style="width:16%" class="num">Spolu s DPH</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="summary">
    <div class="terms"><strong>Poznámka a podmienky</strong>${escapeHtml(source.note || 'Ceny sú uvedené bez nepredvídaného materiálu. Presný termín realizácie bude dohodnutý po schválení ponuky.')}</div>
    <div class="totals">
      <div class="total-row"><span>Spolu bez DPH</span><strong>${formatMoney(quoteTotals.net)}</strong></div>
      <div class="total-row"><span>DPH</span><strong>${formatMoney(quoteTotals.vat)}</strong></div>
      <div class="total-row final"><span>Celkom s DPH</span><strong>${formatMoney(quoteTotals.gross)}</strong></div>
    </div>
  </section>
  <footer class="footer"><span>www.itspot.sk</span><span>info@itspot.sk</span><span>Strana 1 / 1</span></footer>
</main>
</body>
</html>`
  }

  function showQuote(quote?: Quote) {
    const html = getPrintableHtml(quote)
    const win = window.open('', '_blank')
    if (!win) {
      setNotice({ type: 'error', text: 'Prehliadač zablokoval otvorenie náhľadu.' })
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  function sendQuoteEmail(quote?: Quote) {
    const target = quote || null
    const recipient = target?.contact_email || contactEmail
    const number = target?.quote_number || quoteNumber || generateQuoteNumber()
    const targetTitle = target?.title || title || 'cenová ponuka'
    const body = [
      'Dobrý deň,',
      '',
      `posielame cenovú ponuku ${number}: ${targetTitle}.`,
      '',
      'S pozdravom',
      'ITspot s. r. o.',
    ].join('\n')
    window.location.href = `mailto:${encodeURIComponent(recipient || '')}?subject=${encodeURIComponent(`Cenová ponuka ${number}`)}&body=${encodeURIComponent(body)}`
  }

  if (checkingAuth) {
    return <div style={{ padding: 24 }}>Kontrolujem prihlásenie...</div>
  }

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #eef4fb 0%, #f8fafc 52%, #edf7e6 100%)',
    color: '#0f172a',
    padding: '22px min(28px, 4vw)',
  }

  const boxStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #dbe3ee',
    borderRadius: 18,
    boxShadow: '0 18px 45px rgba(15,23,42,0.08)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 44,
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 800,
    background: '#fff',
    color: '#0f172a',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    marginBottom: 6,
    color: '#334155',
    fontSize: 13,
    fontWeight: 900,
  }

  const buttonStyle: CSSProperties = {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 42,
    padding: '10px 14px',
    textDecoration: 'none',
  }

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    borderColor: '#65a30d',
    background: '#77d20b',
    boxShadow: '0 12px 24px rgba(119,210,11,0.2)',
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <header style={{ ...boxStyle, padding: 18, marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BrandLogo size="sm" />
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950 }}>Cenové ponuky</h1>
              <div style={{ color: '#64748b', fontWeight: 800 }}>Tvorba, evidencia a odosielanie ponúk</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/" style={buttonStyle}>Domov</Link>
            <button type="button" style={primaryButtonStyle} onClick={startNewQuote}>+ Nová ponuka</button>
          </div>
        </header>

        {notice && (
          <div style={{ ...boxStyle, padding: 14, marginBottom: 16, borderColor: notice.type === 'success' ? '#86efac' : '#fecaca', color: notice.type === 'success' ? '#166534' : '#991b1b' }}>
            <strong>{notice.text}</strong>
          </div>
        )}

        <section ref={formRef} style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 520px) 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ ...boxStyle, padding: 18, display: 'grid', gap: 14 }}>
            <div>
              <div style={{ color: '#77d20b', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {editingId ? 'Úprava ponuky' : 'Nová ponuka'}
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: 24 }}>Základné údaje</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Číslo ponuky</label>
                <input style={inputStyle} value={quoteNumber} onChange={(event) => setQuoteNumber(event.target.value)} placeholder="CP-2026-001" />
              </div>
              <div>
                <label style={labelStyle}>Stav</label>
                <select style={inputStyle} value={status} onChange={(event) => setStatus(event.target.value as Quote['status'])}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Dátum</label>
                <input type="date" style={inputStyle} value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Platnosť do</label>
                <input type="date" style={inputStyle} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Zákazník</label>
              <select style={inputStyle} value={customerId} onChange={(event) => selectCustomer(event.target.value)}>
                <option value="">Vyber zákazníka</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.nazov}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Názov riešenia</label>
              <input style={inputStyle} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Kamerový systém pre areál" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Kontaktná osoba</label>
                <input style={inputStyle} value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Realizácia</label>
              <textarea style={{ ...inputStyle, minHeight: 82, resize: 'vertical' }} value={realizationNote} onChange={(event) => setRealizationNote(event.target.value)} placeholder="Termín realizácie podľa dohody..." />
            </div>

            <div>
              <label style={labelStyle}>Poznámka a podmienky</label>
              <textarea style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ceny sú uvedené bez nepredvídaného materiálu..." />
            </div>
          </div>

          <div style={{ ...boxStyle, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#77d20b', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Položky</div>
                <h2 style={{ margin: '4px 0 0', fontSize: 24 }}>Rozpočet ponuky</h2>
              </div>
              <button type="button" style={buttonStyle} onClick={addItem}>+ Pridať položku</button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((item, index) => {
                const itemTotals = getItemTotals(item)
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.6fr 0.9fr 0.7fr 0.9fr 44px', gap: 8, alignItems: 'end', border: '1px solid #e2e8f0', borderRadius: 14, padding: 10 }}>
                    <div>
                      {index === 0 && <label style={labelStyle}>Položka</label>}
                      <input style={inputStyle} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Názov položky" />
                      <input style={{ ...inputStyle, minHeight: 36, marginTop: 6, fontSize: 13 }} value={item.note} onChange={(event) => updateItem(index, 'note', event.target.value)} placeholder="Poznámka k položke" />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>Množstvo</label>}
                      <input style={inputStyle} value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>MJ</label>}
                      <input style={inputStyle} value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>Cena bez DPH</label>}
                      <input style={inputStyle} value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} placeholder="0,00" />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>DPH %</label>}
                      <input style={inputStyle} value={item.vatRate} onChange={(event) => updateItem(index, 'vatRate', event.target.value)} />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>Spolu</label>}
                      <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#f8fafc' }}>{formatMoney(itemTotals.gross)}</div>
                    </div>
                    <button type="button" style={{ ...buttonStyle, minHeight: 44, padding: 0, color: '#991b1b' }} onClick={() => removeItem(index)} disabled={items.length <= 1}>×</button>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginTop: 16, alignItems: 'start' }}>
              <div style={{ color: '#64748b', fontWeight: 800 }}>
                Prvá verzia generuje tlačový náhľad. V náhľade klikneš <strong>Tlačiť / uložiť PDF</strong>.
              </div>
              <div style={{ border: '1px solid #dbe3ee', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #dbe3ee' }}>
                  <span>Spolu bez DPH</span>
                  <strong>{formatMoney(totals.net)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #dbe3ee' }}>
                  <span>DPH</span>
                  <strong>{formatMoney(totals.vat)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, background: '#101827', color: '#fff', alignItems: 'baseline' }}>
                  <span>Celkom s DPH</span>
                  <strong style={{ fontSize: 24 }}>{formatMoney(totals.gross)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" style={primaryButtonStyle} onClick={saveQuote} disabled={saving}>{saving ? 'Ukladám...' : 'Uložiť ponuku'}</button>
              <button type="button" style={buttonStyle} onClick={() => showQuote()}>Ukáž ponuku</button>
              <button type="button" style={buttonStyle} onClick={() => sendQuoteEmail()}>Odoslať mailom</button>
              {editingId && <button type="button" style={buttonStyle} onClick={startNewQuote}>Zrušiť úpravu</button>}
            </div>
          </div>
        </section>

        <section style={{ ...boxStyle, padding: 18, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ color: '#77d20b', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Evidencia</div>
              <h2 style={{ margin: '4px 0 0', fontSize: 24 }}>Uložené ponuky</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, width: 260 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hľadať..." />
              <select style={{ ...inputStyle, width: 180 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Všetky stavy</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <div style={{ color: '#64748b', fontWeight: 800 }}>Načítavam...</div> : null}
          {!loading && filteredQuotes.length === 0 ? <div style={{ color: '#64748b', fontWeight: 800 }}>Zatiaľ tu nie sú žiadne ponuky.</div> : null}

          <div style={{ display: 'grid', gap: 8 }}>
            {filteredQuotes.map((quote) => (
              <div key={quote.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 220px 140px 280px', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
                <strong>{quote.quote_number}</strong>
                <div>
                  <div style={{ fontWeight: 950 }}>{quote.title}</div>
                  <div style={{ color: '#64748b', fontWeight: 800, fontSize: 13 }}>{quote.customer_name || 'Bez zákazníka'}</div>
                </div>
                <div style={{ color: '#64748b', fontWeight: 800 }}>{formatDate(quote.quote_date)}</div>
                <span style={{ ...statusStyle[quote.status], borderRadius: 999, padding: '7px 10px', fontWeight: 900, textAlign: 'center' }}>{STATUS_LABELS[quote.status]}</span>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" style={buttonStyle} onClick={() => startEdit(quote)}>Upraviť</button>
                  <button type="button" style={buttonStyle} onClick={() => showQuote(quote)}>Ukáž</button>
                  <button type="button" style={buttonStyle} onClick={() => sendQuoteEmail(quote)}>Email</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
