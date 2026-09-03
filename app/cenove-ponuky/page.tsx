'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BrandLogo } from '@/components/BrandLogo'
import type { Customer, Notice, Quote } from '@/lib/dashboard-types'
import { formatDate, getTodayDate, loadFirstAvailableImage, loadImageAsDataUrl, pdfSafeText } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

type QuoteItem = {
  id: string
  name: string
  note: string
  imageUrl?: string
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

const MATERIAL_DELIVERY_NOTE = 'Dodanie podľa dostupnosti tovaru. Osobný odber alebo doručenie podľa dohody.'
const INSTALLATION_DELIVERY_NOTE = 'Termín realizácie podľa dohody.'
const MATERIAL_TERMS_NOTE = 'Ponuka je nezáväzná do jej odsúhlasenia zákazníkom. Platnosť ponuky je uvedená v hlavičke dokumentu.'
const INSTALLATION_TERMS_NOTE = 'Ceny sú uvedené bez nepredvídaného materiálu. Presný termín realizácie bude dohodnutý po schválení ponuky.'

type QuoteKind = 'sale' | 'installation'

type QuotePrintSource = {
  number: string
  date: string
  valid: string
  title: string
  customer: string
  contact: string
  email: string
  kind: QuoteKind
  realization: string
  note: string
  discountType: 'none' | 'percent' | 'amount'
  discountValue: string
  items: QuoteItem[]
}

const QUOTE_KIND_LABELS: Record<QuoteKind, string> = {
  sale: 'Predaj materiálu',
  installation: 'S montážou',
}

const statusStyle: Record<Quote['status'], CSSProperties> = {
  draft: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  sent: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  approved: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  rejected: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
}

const flowiiQuote260802Items: QuoteItem[] = [
  { id: 'flowii-260802-1', name: 'Dahua Pentabridný AI videorekordér', note: '', quantity: '1', unit: 'ks', unitPrice: '127', vatRate: '23' },
  { id: 'flowii-260802-2', name: 'Montáž a nastavenie videorekordéra', note: '', quantity: '1', unit: 'ks', unitPrice: '60', vatRate: '23' },
  { id: 'flowii-260802-3', name: 'Seagate HDD2000S 24/7 SATA disk', note: '', quantity: '1', unit: 'ks', unitPrice: '139', vatRate: '23' },
  { id: 'flowii-260802-4', name: 'Dahua 5 Mpx turret HDCVI kamera', note: '', quantity: '2', unit: 'ks', unitPrice: '82', vatRate: '23' },
  { id: 'flowii-260802-5', name: 'Montáž a nastavenie kamier', note: '', quantity: '2', unit: 'ks', unitPrice: '50', vatRate: '23' },
  { id: 'flowii-260802-6', name: 'Dahua PFA137 prídavný límec pre kamery', note: '', quantity: '2', unit: 'ks', unitPrice: '12', vatRate: '23' },
  { id: 'flowii-260802-7', name: 'Simple PS 12/2000 napájací zdroj', note: '', quantity: '2', unit: 'ks', unitPrice: '11,5', vatRate: '23' },
  { id: 'flowii-260802-8', name: 'Dahua PFM800-4K súprava 1-kanálových pasívnych video prevodníkov BNC', note: '', quantity: '2', unit: 'ks', unitPrice: '8', vatRate: '23' },
  { id: 'flowii-260802-9', name: 'Zapojenie kamerového systému, konektory, oživenie', note: '', quantity: '1', unit: 'ks', unitPrice: '50', vatRate: '23' },
  { id: 'flowii-260802-10', name: 'AB Cryptobox 750HD', note: '', quantity: '1', unit: 'ks', unitPrice: '67', vatRate: '23' },
  { id: 'flowii-260802-11', name: 'Satelitná parabola LTC 110', note: '', quantity: '1', unit: 'ks', unitPrice: '45', vatRate: '23' },
  { id: 'flowii-260802-12', name: 'Montáž paraboly + LNB', note: '', quantity: '1', unit: 'ks', unitPrice: '60', vatRate: '23' },
  { id: 'flowii-260802-13', name: 'LNB Smart TWIN Titanium Edition', note: '', quantity: '1', unit: 'ks', unitPrice: '15', vatRate: '23' },
  { id: 'flowii-260802-14', name: 'Konzola T-sat 50 cm', note: '', quantity: '1', unit: 'ks', unitPrice: '23', vatRate: '23' },
  { id: 'flowii-260802-15', name: 'Nastavenie satelitu a nastavenie prijímača', note: '', quantity: '1', unit: 'ks', unitPrice: '80', vatRate: '23' },
]

const quoteItemTemplates: Array<Omit<QuoteItem, 'id'>> = [
  { name: 'Obhliadka a konzultácia u zákazníka', note: '', quantity: '1', unit: 'ks', unitPrice: '', vatRate: '23' },
  { name: 'Montáž a nastavenie zariadenia', note: '', quantity: '1', unit: 'ks', unitPrice: '', vatRate: '23' },
  { name: 'Programovanie a konfigurácia systému', note: '', quantity: '1', unit: 'ks', unitPrice: '', vatRate: '23' },
  { name: 'Zapojenie, konektory a oživenie systému', note: '', quantity: '1', unit: 'ks', unitPrice: '', vatRate: '23' },
  { name: 'Doprava', note: '', quantity: '1', unit: 'ks', unitPrice: '', vatRate: '23' },
]

function createQuoteItem(): QuoteItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    note: '',
    imageUrl: '',
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

function getQuoteKindFromRealization(value: string | null | undefined): QuoteKind {
  return String(value || '').trim() === MATERIAL_DELIVERY_NOTE ? 'sale' : 'installation'
}

function normalizeCustomerName(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bs\.?\s*r\.?\s*o\.?\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
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
        imageUrl: (raw as Partial<QuoteItem>).imageUrl || '',
        quantity: raw.quantity || '1',
        unit: raw.unit || 'ks',
        unitPrice: raw.unitPrice || '',
        vatRate: raw.vatRate || '23',
      }
    })
    .filter((item) => item.name.trim() || item.note.trim() || item.imageUrl.trim() || item.unitPrice.trim())
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

function getQuoteTotals(items: QuoteItem[], discountType: 'none' | 'percent' | 'amount', discountValue: string) {
  const base = items.reduce(
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
  const rawDiscount = parseMoney(discountValue)
  const discount = discountType === 'percent'
    ? Math.min(base.net, Math.max(0, base.net * (rawDiscount / 100)))
    : discountType === 'amount'
      ? Math.min(base.net, Math.max(0, rawDiscount))
      : 0
  const net = base.net - discount
  const vat = net * 0.23
  return {
    originalNet: base.net,
    discount,
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
  const [quoteKind, setQuoteKind] = useState<QuoteKind>('sale')
  const [realizationNote, setRealizationNote] = useState(MATERIAL_DELIVERY_NOTE)
  const [note, setNote] = useState('')
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'amount'>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([createQuoteItem()])
  const [materialQuote, setMaterialQuote] = useState<Quote | null>(null)
  const [selectedMaterialItemIds, setSelectedMaterialItemIds] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeSection, setActiveSection] = useState<'create' | 'list'>('create')
  const [isCompact, setIsCompact] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

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

  useEffect(() => {
    const updateSize = () => {
      setIsCompact(window.innerWidth < 980)
      setIsNarrow(window.innerWidth < 760)
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const totals = useMemo(() => {
    return getQuoteTotals(items, discountType, discountValue)
  }, [discountType, discountValue, items])

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase()
    return quotes
      .filter((quote) => {
        const matchesStatus = statusFilter === 'all' || quote.status === statusFilter
        const matchesSearch =
          !term ||
          quote.quote_number.toLowerCase().includes(term) ||
          quote.title.toLowerCase().includes(term) ||
          (quote.customer_name || '').toLowerCase().includes(term)
        return matchesStatus && matchesSearch
      })
      .sort((a, b) => b.quote_number.localeCompare(a.quote_number, 'sk', { numeric: true }))
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

  function generateQuoteNumber(dateValue = quoteDate || getTodayDate()) {
    const date = new Date(dateValue)
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
    const year = String(safeDate.getFullYear()).slice(-2)
    const month = String(safeDate.getMonth() + 1).padStart(2, '0')
    const prefix = `${year}${month}`
    const lastNumberInMonth = quotes.reduce((highest, quote) => {
      const match = quote.quote_number.match(new RegExp(`^${prefix}(\\d{2,})$`))
      if (!match) return highest
      const order = Number(match[1])
      return Number.isFinite(order) ? Math.max(highest, order) : highest
    }, 0)
    return `${prefix}${String(lastNumberInMonth + 1).padStart(2, '0')}`
  }

  function resetForm() {
    const today = getTodayDate()
    setEditingId('')
    setCustomerId('')
    setQuoteNumber(generateQuoteNumber(today))
    setQuoteDate(today)
    setValidUntil(addDays(today, 14))
    setStatus('draft')
    setTitle('')
    setCustomerName('')
    setContactName('')
    setContactEmail('')
    setQuoteKind('sale')
    setRealizationNote(MATERIAL_DELIVERY_NOTE)
    setNote('')
    setDiscountType('none')
    setDiscountValue('')
    setItems([createQuoteItem()])
  }

  function startNewQuote() {
    resetForm()
    setActiveSection('create')
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

  function changeQuoteKind(nextKind: QuoteKind) {
    setQuoteKind(nextKind)
    const nextDefault = nextKind === 'sale' ? MATERIAL_DELIVERY_NOTE : INSTALLATION_DELIVERY_NOTE
    setRealizationNote((current) => {
      const trimmed = current.trim()
      if (!trimmed || trimmed === MATERIAL_DELIVERY_NOTE || trimmed === INSTALLATION_DELIVERY_NOTE) {
        return nextDefault
      }
      return current
    })
  }

  function startEdit(quote: Quote) {
    setActiveSection('create')
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
    setQuoteKind(getQuoteKindFromRealization(quote.realization_note))
    setRealizationNote(quote.realization_note || MATERIAL_DELIVERY_NOTE)
    setNote(quote.note || '')
    setDiscountType((quote.discount_type === 'percent' || quote.discount_type === 'amount') ? quote.discount_type : 'none')
    setDiscountValue(quote.discount_value ? String(quote.discount_value).replace('.', ',') : '')
    setItems(normalizeItems(quote.items))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateItem(index: number, field: keyof Omit<QuoteItem, 'id'>, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  async function uploadQuoteItemImage(index: number, file: File | null | undefined) {
    if (!file) return
    if (!userId) {
      setNotice({ type: 'error', text: 'Najprv sa prihlás.' })
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'Obrázok môže byť JPG, PNG alebo WEBP, maximálne 8 MB.' })
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `ponuky/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
    setSaving(true)
    const { error } = await supabase.storage
      .from('customer-request-files')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Obrázok sa nenahral: ${error.message}` })
      return
    }

    const { data } = supabase.storage.from('customer-request-files').getPublicUrl(filePath)
    if (!data.publicUrl) {
      setNotice({ type: 'error', text: 'Obrázok sa nahral, ale nepodarilo sa získať verejný odkaz.' })
      return
    }

    updateItem(index, 'imageUrl', data.publicUrl)
    setNotice({ type: 'success', text: 'Obrázok produktu bol pridaný k položke.' })
  }

  function setQuoteItemImageUrl(index: number) {
    const currentUrl = items[index]?.imageUrl || ''
    const nextUrl = window.prompt('Vlož URL obrázka produktu:', currentUrl)
    if (nextUrl === null) return
    const trimmedUrl = nextUrl.trim()
    if (!trimmedUrl) {
      updateItem(index, 'imageUrl', '')
      return
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setNotice({ type: 'error', text: 'URL obrázka musí začínať na http:// alebo https://.' })
      return
    }
    updateItem(index, 'imageUrl', trimmedUrl)
    setNotice({ type: 'success', text: 'URL obrázka bola pridaná k položke.' })
  }

  function addItem() {
    setItems((current) => [...current, createQuoteItem()])
  }

  function addTemplateItem(template: Omit<QuoteItem, 'id'>) {
    setItems((current) => [
      ...current.filter((item) => item.name.trim() || item.note.trim() || item.unitPrice.trim()),
      { ...template, id: createQuoteItem().id },
    ])
  }

  function removeItem(index: number) {
    setItems((current) => (current.length <= 1 ? current : current.filter((_item, itemIndex) => itemIndex !== index)))
  }

  function duplicateQuote(quote: Quote) {
    const today = getTodayDate()
    setActiveSection('create')
    setEditingId('')
    setCustomerId(quote.customer_id || '')
    setQuoteNumber(generateQuoteNumber(today))
    setQuoteDate(today)
    setValidUntil(addDays(today, 14))
    setStatus('draft')
    setTitle(quote.title || '')
    setCustomerName(quote.customer_name || '')
    setContactName(quote.contact_name || '')
    setContactEmail(quote.contact_email || '')
    setQuoteKind(getQuoteKindFromRealization(quote.realization_note))
    setRealizationNote(quote.realization_note || MATERIAL_DELIVERY_NOTE)
    setNote(quote.note || '')
    setDiscountType((quote.discount_type === 'percent' || quote.discount_type === 'amount') ? quote.discount_type : 'none')
    setDiscountValue(quote.discount_value ? String(quote.discount_value).replace('.', ',') : '')
    setItems(normalizeItems(quote.items).map((item) => ({ ...item, id: createQuoteItem().id })))
    setNotice({ type: 'success', text: 'Ponuka je skopírovaná ako nová rozpracovaná ponuka.' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openMaterialImport(quote: Quote) {
    const quoteItems = normalizeItems(quote.items).filter((item) => item.name.trim())
    setMaterialQuote(quote)
    setSelectedMaterialItemIds(quoteItems.map((item) => item.id))
    window.setTimeout(() => {
      document.getElementById('quote-material-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function toggleMaterialItem(itemId: string) {
    setSelectedMaterialItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    )
  }

  async function resolveQuoteCustomer(quote: Quote) {
    if (quote.customer_id) return quote.customer_id
    if (!quote.customer_name?.trim()) return ''

    const normalizedQuoteCustomer = normalizeCustomerName(quote.customer_name)
    const existingCustomer = customers.find((customer) => normalizeCustomerName(customer.nazov) === normalizedQuoteCustomer)
    if (existingCustomer) return existingCustomer.id

    if (!userId) return ''
    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          user_id: userId,
          nazov: quote.customer_name.trim(),
          kontakt: quote.contact_name || null,
          telefon: null,
          email: quote.contact_email || null,
        },
      ])
      .select()
      .single()

    if (error || !data) {
      setNotice({ type: 'error', text: `Zákazník sa nevytvoril: ${error?.message || 'neznáma chyba'}` })
      return ''
    }

    const createdCustomer = data as Customer
    setCustomers((current) => [createdCustomer, ...current])
    return createdCustomer.id
  }

  async function addSelectedQuoteItemsToMaterial() {
    if (!userId || !materialQuote) return
    const quoteItems = normalizeItems(materialQuote.items).filter((item) => selectedMaterialItemIds.includes(item.id) && item.name.trim())

    if (quoteItems.length === 0) {
      setNotice({ type: 'error', text: 'Vyber aspoň jednu položku, ktorú treba objednať.' })
      return
    }

    setSaving(true)
    const finalCustomerId = await resolveQuoteCustomer(materialQuote)
    if (materialQuote.customer_name?.trim() && !finalCustomerId) {
      setSaving(false)
      return
    }

    const rows = quoteItems.map((item) => ({
      user_id: userId,
      customer_id: finalCustomerId || null,
      target_type: finalCustomerId ? 'customer' : 'internal',
      name: item.name.trim(),
      quantity: item.quantity || null,
      unit: item.unit || 'ks',
      supplier: null,
      status: 'to_order',
      priority: 'normal',
      needed_by: null,
      note: [`Z ponuky ${materialQuote.quote_number}.`, item.note?.trim() || ''].filter(Boolean).join(' '),
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('material_requests').insert(rows)
    setSaving(false)

    if (error) {
      const missingTable = error.code === '42P01'
        ? ' Chýba tabuľka material_requests. Spusť SQL skript scripts/supabase-material-requests.sql.'
        : ''
      setNotice({ type: 'error', text: `Materiál sa nepridal: ${error.message}${missingTable}` })
      return
    }

    setMaterialQuote(null)
    setSelectedMaterialItemIds([])
    setNotice({ type: 'success', text: `${quoteItems.length} položiek z ponuky ${materialQuote.quote_number} bolo pridaných do nákupu materiálu.` })
  }

  async function updateQuoteStatus(quote: Quote, nextStatus: Quote['status']) {
    if (!userId) return
    setSaving(true)
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', quote.id)
      .eq('user_id', userId)
      .select()
      .single()
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Stav ponuky sa neuložil: ${error.message}` })
      return
    }

    const saved = data as Quote
    setQuotes((current) => current.map((item) => (item.id === saved.id ? saved : item)))
    if (editingId === saved.id) {
      setStatus(saved.status)
    }
    setNotice({ type: 'success', text: `Ponuka je označená ako ${STATUS_LABELS[nextStatus].toLowerCase()}.` })
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
      discount_type: discountType,
      discount_value: discountType === 'none' ? 0 : parseMoney(discountValue),
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

  async function importFlowiiQuote260802() {
    if (!userId) return

    const payload = {
      user_id: userId,
      customer_id: null,
      quote_number: '260802',
      quote_date: '2026-08-20',
      valid_until: null,
      status: 'draft' as Quote['status'],
      title: 'Kamerový systém + Satelit',
      customer_name: 'Prochyra',
      contact_name: null,
      contact_email: null,
      realization_note: 'Termín realizácie podľa dohody.',
      note: 'Importované z pôvodnej ponuky Flowii číslo 260802.',
      discount_type: 'none' as const,
      discount_value: 0,
      items: flowiiQuote260802Items,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('quotes')
      .upsert(payload, { onConflict: 'user_id,quote_number' })
      .select()
      .single()
    setSaving(false)

    if (error) {
      setNotice({ type: 'error', text: `Import sa nepodaril: ${error.message}` })
      return
    }

    const saved = data as Quote
    setQuotes((current) => {
      const withoutSaved = current.filter((quote) => quote.id !== saved.id && quote.quote_number !== saved.quote_number)
      return [saved, ...withoutSaved]
    })
    startEdit(saved)
    setNotice({ type: 'success', text: 'Ponuka 260802 bola uložená do našej evidencie.' })
  }

  async function createOrderFromQuote(quote: Quote) {
    if (!userId) return

    const quoteItems = normalizeItems(quote.items)
    const quoteDiscountType = (quote.discount_type === 'percent' || quote.discount_type === 'amount') ? quote.discount_type : 'none'
    const quoteDiscountValue = quote.discount_value ? String(quote.discount_value) : ''
    const quoteTotals = getQuoteTotals(quoteItems, quoteDiscountType, quoteDiscountValue)
    const requestedCustomerName = quote.customer_name?.trim() || 'Zákazník z ponuky'

    setSaving(true)

    let finalCustomerId = quote.customer_id || ''
    if (!finalCustomerId) {
      const normalizedQuoteCustomer = normalizeCustomerName(requestedCustomerName)
      const existingCustomer = customers.find((customer) => normalizeCustomerName(customer.nazov) === normalizedQuoteCustomer)

      if (existingCustomer) {
        finalCustomerId = existingCustomer.id
      } else {
        const { data: createdCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([
            {
              user_id: userId,
              nazov: requestedCustomerName,
              kontakt: quote.contact_name || null,
              telefon: null,
              email: quote.contact_email || null,
            },
          ])
          .select()
          .single()

        if (customerError || !createdCustomer) {
          setSaving(false)
          setNotice({ type: 'error', text: `Zákazník sa nevytvoril: ${customerError?.message || 'neznáma chyba'}` })
          return
        }

        const newCustomer = createdCustomer as Customer
        finalCustomerId = newCustomer.id
        setCustomers((current) => [newCustomer, ...current])
      }
    }

    const itemLines = quoteItems.map((item, index) => {
      const itemTotals = getItemTotals(item)
      return `${index + 1}. ${item.name} - ${item.quantity || '1'} ${item.unit || 'ks'} x ${formatMoney(parseMoney(item.unitPrice))} bez DPH = ${formatMoney(itemTotals.net)}`
    })

    const description = [
      `Vytvorené z cenovej ponuky ${quote.quote_number}.`,
      `Cena spolu bez DPH: ${formatMoney(quoteTotals.net)}`,
      `Cena spolu s DPH: ${formatMoney(quoteTotals.gross)}`,
      '',
      'Položky:',
      ...itemLines,
      quote.note ? ['', 'Poznámka:', quote.note] : '',
    ]
      .flat()
      .filter(Boolean)
      .join('\n')

    const { data: existingOrders, error: existingOrderError } = await supabase
      .from('orders')
      .select('id, nazov')
      .eq('user_id', userId)
      .ilike('popis', `%cenovej ponuky ${quote.quote_number}%`)
      .limit(1)

    if (existingOrderError) {
      setSaving(false)
      setNotice({ type: 'error', text: `Kontrola existujúcej zákazky zlyhala: ${existingOrderError.message}` })
      return
    }

    if (existingOrders && existingOrders.length > 0) {
      setSaving(false)
      setNotice({ type: 'success', text: `Z tejto ponuky už existuje zákazka: ${existingOrders[0].nazov}.` })
      return
    }

    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: userId,
          nazov: quote.title || `Zákazka z ponuky ${quote.quote_number}`,
          customer_id: finalCustomerId,
          stav: 'nova',
          praca: null,
          popis: description,
          requester_email: quote.contact_email || null,
          public_message: null,
          termin: null,
          prijatie_zakazky: getTodayDate(),
          hodiny: 0,
        },
      ])
      .select()
      .single()

    if (orderError || !insertedOrder) {
      setSaving(false)
      setNotice({ type: 'error', text: `Zákazka sa nevytvorila: ${orderError?.message || 'neznáma chyba'}` })
      return
    }

    const { data: updatedQuote, error: quoteError } = await supabase
      .from('quotes')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', quote.id)
      .eq('user_id', userId)
      .select()
      .single()

    setSaving(false)

    if (quoteError) {
      setNotice({ type: 'error', text: `Zákazka vznikla, ale ponuka sa neoznačila ako schválená: ${quoteError.message}` })
      return
    }

    const savedQuote = updatedQuote as Quote
    setQuotes((current) => current.map((item) => (item.id === savedQuote.id ? savedQuote : item)))
    if (editingId === savedQuote.id) startEdit(savedQuote)
    setNotice({ type: 'success', text: `Zo schválenej ponuky ${quote.quote_number} vznikla nová zákazka.` })
  }

  function getQuotePrintSource(quoteLike?: Quote): QuotePrintSource {
    return quoteLike
      ? {
          number: quoteLike.quote_number,
          date: quoteLike.quote_date,
          valid: quoteLike.valid_until || '',
          title: quoteLike.title,
          customer: quoteLike.customer_name || '',
          contact: quoteLike.contact_name || '',
          email: quoteLike.contact_email || '',
          kind: getQuoteKindFromRealization(quoteLike.realization_note),
          realization: quoteLike.realization_note || '',
          note: quoteLike.note || '',
          discountType: (quoteLike.discount_type === 'percent' || quoteLike.discount_type === 'amount') ? quoteLike.discount_type : 'none',
          discountValue: quoteLike.discount_value ? String(quoteLike.discount_value) : '',
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
          kind: quoteKind,
          realization: realizationNote,
          note,
          discountType,
          discountValue,
          items: items.filter((item) => item.name.trim() || item.note.trim() || item.unitPrice.trim()),
        }
  }

  function getPrintableHtml(quoteLike?: Quote) {
    const source = getQuotePrintSource(quoteLike)

    const sourceDiscountType = (source.discountType === 'percent' || source.discountType === 'amount') ? source.discountType : 'none'
    const quoteTotals = getQuoteTotals(source.items, sourceDiscountType, source.discountValue)
    const deliveryTitle = source.kind === 'sale' ? 'Dodanie' : 'Realizácia'
    const deliveryText = source.realization || (source.kind === 'sale' ? MATERIAL_DELIVERY_NOTE : INSTALLATION_DELIVERY_NOTE)
    const termsText = source.note || (source.kind === 'sale' ? MATERIAL_TERMS_NOTE : INSTALLATION_TERMS_NOTE)
    const discountLabel = source.discountType === 'percent'
      ? `Zľava ${escapeHtml(source.discountValue || '0')} %`
      : 'Zľava'

    const rows = source.items
      .map((item, index) => {
        const itemTotals = getItemTotals(item)
        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <div class="item-name">${escapeHtml(item.name || '-')}</div>
              ${item.note.trim() ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ''}
              ${item.imageUrl ? `<img class="item-image" src="${escapeHtml(item.imageUrl)}" alt="" />` : ''}
            </td>
            <td class="num">${escapeHtml(item.quantity || '1')}</td>
            <td>${escapeHtml(item.unit || 'ks')}</td>
            <td class="num">${formatMoney(parseMoney(item.unitPrice))}</td>
            <td class="num">${escapeHtml(item.vatRate || '23')} %</td>
            <td class="num strong">${formatMoney(itemTotals.net)}</td>
          </tr>`
      })
      .join('')

    return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(source.number)} - ${escapeHtml(source.customer)}</title>
<style>
  :root { --ink:#111827; --muted:#667085; --line:#d7dde7; --soft:#f6f8fb; --lime:#77d20b; --deep:#111827; }
  * { box-sizing: border-box; }
  body { margin:0; background:#dfe7f1; color:var(--ink); font-family:Arial,Helvetica,sans-serif; padding:24px; }
  .page { width:210mm; min-height:297mm; margin:0 auto; background:white; box-shadow:0 24px 70px rgba(15,23,42,.16); padding:15mm 16mm 13mm; position:relative; }
  .topline { height:4px; background:linear-gradient(90deg,var(--deep),var(--deep) 78%,var(--lime)); margin:-15mm -16mm 12mm; }
  .header { display:grid; grid-template-columns:1.1fr .9fr; gap:16mm; align-items:start; padding-bottom:9mm; border-bottom:1px solid var(--line); }
  .brand-logo { display:block; width:64mm; max-width:100%; height:auto; }
  .company { margin-top:8mm; font-size:10.5px; line-height:1.55; color:#344054; }
  .quote-box { border:1px solid var(--deep); padding:14px 16px; background:#fff; }
  .quote-label { font-size:10px; color:var(--muted); text-transform:uppercase; font-weight:900; letter-spacing:.09em; }
  .quote-number { margin-top:6px; font-size:29px; font-weight:950; color:var(--deep); }
  .quote-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; font-size:11px; }
  .meta-card { border-top:1px solid var(--line); padding-top:8px; }
  .meta-card span { display:block; color:var(--muted); font-weight:900; font-size:9px; text-transform:uppercase; letter-spacing:.06em; }
  .meta-card strong { display:block; margin-top:4px; font-size:12px; }
  .customer-row { display:grid; grid-template-columns:1fr 1fr; gap:9mm; margin-top:10mm; }
  .panel { border:1px solid var(--line); padding:12px; background:#fff; }
  .panel h2 { margin:0 0 9px; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  .panel .name { font-size:16px; font-weight:950; margin-bottom:6px; }
  .panel p { margin:0; color:#475467; font-size:11px; line-height:1.5; white-space:pre-line; }
  .offer-title { margin-top:10mm; }
  .offer-title span { color:var(--lime); font-size:10px; font-weight:950; text-transform:uppercase; letter-spacing:.08em; }
  .offer-title h1 { margin:4px 0 0; font-size:22px; line-height:1.18; color:var(--ink); }
  table { width:100%; border-collapse:collapse; margin-top:8mm; font-size:10.3px; }
  th { background:#f0f3f7; color:#344054; padding:8px 7px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.04em; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  td { padding:8px 7px; border-bottom:1px solid #e8edf3; vertical-align:top; }
  tbody tr:nth-child(even) td { background:#fbfcfe; }
  .num { text-align:right; white-space:nowrap; }
  .strong { font-weight:950; color:var(--ink); }
  .item-name { font-weight:850; }
  .item-note { margin-top:3px; color:var(--muted); font-size:10px; }
  .item-image { display:block; width:18mm; max-height:18mm; object-fit:contain; margin-top:5px; border:1px solid #e8edf3; border-radius:3px; padding:2px; background:white; }
  .summary { display:grid; grid-template-columns:1fr 76mm; gap:10mm; margin-top:9mm; align-items:start; }
  .terms { background:var(--soft); border:1px solid #e8edf3; padding:12px; color:#475467; font-size:10.5px; line-height:1.5; white-space:pre-line; }
  .terms strong { display:block; color:var(--ink); margin-bottom:6px; }
  .totals { border:1px solid var(--line); background:#fff; }
  .total-row { display:flex; justify-content:space-between; gap:12px; padding:9px 12px; border-bottom:1px solid var(--line); font-size:11px; }
  .total-row strong { font-size:12px; }
  .total-row.final { background:#eefbdc; color:#111827; border:2px solid var(--lime); margin:-1px; align-items:baseline; padding:13px 12px; }
  .total-row.final span { font-size:12px; font-weight:950; text-transform:uppercase; letter-spacing:.04em; }
  .total-row.final strong { font-size:30px; color:#111827; }
  .total-row.muted { color:var(--muted); }
  .signatures { display:grid; grid-template-columns:1fr; gap:18mm; margin-top:18mm; page-break-inside:avoid; max-width:76mm; }
  .signature { border-top:1px solid #98a2b3; padding-top:7px; color:#667085; font-size:10px; font-weight:800; }
  .footer { margin-top:12mm; display:flex; justify-content:space-between; gap:20px; border-top:1px solid var(--line); padding-top:8px; color:var(--muted); font-size:9.5px; font-weight:800; }
  .toolbar { position:fixed; right:20px; top:20px; display:flex; gap:8px; z-index:10; }
  .toolbar button { border:0; border-radius:10px; background:#77d20b; color:#111827; padding:10px 14px; font-weight:900; cursor:pointer; }
  @media print { body { background:white; padding:0; } .page { box-shadow:none; margin:0; width:auto; min-height:auto; } .toolbar { display:none; } }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">Tlačiť / uložiť PDF</button></div>
<main class="page">
  <div class="topline"></div>
  <section class="header">
    <div>
      <img class="brand-logo" src="/brand-logo-light.png" alt="ITspot" />
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
    <div class="panel"><h2>${deliveryTitle}</h2><p>${escapeHtml(deliveryText)}</p></div>
  </section>
  <section class="offer-title"><span>Návrh riešenia</span><h1>${escapeHtml(source.title || 'Cenová ponuka')}</h1></section>
  <table>
    <thead><tr><th style="width:7%">Č.</th><th>Položka</th><th style="width:10%" class="num">Množstvo</th><th style="width:8%">MJ</th><th style="width:15%" class="num">Cena/MJ bez DPH</th><th style="width:10%" class="num">DPH</th><th style="width:16%" class="num">Spolu bez DPH</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="summary">
    <div class="terms"><strong>Poznámka a podmienky</strong>${escapeHtml(termsText)}</div>
    <div class="totals">
      ${quoteTotals.discount > 0 ? `<div class="total-row muted"><span>Pôvodná cena bez DPH</span><strong>${formatMoney(quoteTotals.originalNet)}</strong></div><div class="total-row"><span>${discountLabel}</span><strong>- ${formatMoney(quoteTotals.discount)}</strong></div>` : ''}
      <div class="total-row final"><span>Celkom bez DPH</span><strong>${formatMoney(quoteTotals.net)}</strong></div>
      <div class="total-row"><span>DPH 23 %</span><strong>${formatMoney(quoteTotals.vat)}</strong></div>
      <div class="total-row muted"><span>Celkom s DPH</span><strong>${formatMoney(quoteTotals.gross)}</strong></div>
    </div>
  </section>
  <section class="signatures">
    <div class="signature">Vystavil: ITspot s. r. o.</div>
  </section>
  <footer class="footer"><span>www.itspot.sk</span><span>info@itspot.sk</span><span>Cenová ponuka ${escapeHtml(source.number)}</span></footer>
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

  async function downloadQuotePdf(quote?: Quote) {
    const source = getQuotePrintSource(quote)
    const sourceDiscountType = (source.discountType === 'percent' || source.discountType === 'amount') ? source.discountType : 'none'
    const quoteTotals = getQuoteTotals(source.items, sourceDiscountType, source.discountValue)
    const deliveryTitle = source.kind === 'sale' ? 'Dodanie' : 'Realizácia'
    const deliveryText = source.realization || (source.kind === 'sale' ? MATERIAL_DELIVERY_NOTE : INSTALLATION_DELIVERY_NOTE)
    const termsText = source.note || (source.kind === 'sale' ? MATERIAL_TERMS_NOTE : INSTALLATION_TERMS_NOTE)
    const discountLabel = source.discountType === 'percent' ? `Zľava ${source.discountValue || '0'} %` : 'Zľava'

    const logoDataUrl = await loadFirstAvailableImage(['/brand-logo-light.png'])
    const itemImages = await Promise.all(
      source.items.map(async (item) => {
        if (!item.imageUrl) return ''
        try {
          return await loadImageAsDataUrl(item.imageUrl)
        } catch {
          return ''
        }
      })
    )

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', margin, 14, 58, 15)
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(28)
      doc.text('ITspot', margin, 25)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(52, 64, 84)
    doc.text('ITspot s. r. o.', margin, 39)
    doc.text('Hajles 1703/6, 968 01 Nova Bana', margin, 43)
    doc.text('ICO: 56430388 · DIC: 2122307462', margin, 47)
    doc.text('IC DPH: SK2122307462', margin, 51)
    doc.text('info@itspot.sk · +421 908 806 691', margin, 55)

    doc.setDrawColor(17, 24, 39)
    doc.rect(126, 14, 70, 36)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(102, 112, 133)
    doc.text('CENOVA PONUKA', 130, 21)
    doc.setFontSize(20)
    doc.setTextColor(17, 24, 39)
    doc.text(pdfSafeText(source.number), 130, 30)
    doc.setDrawColor(215, 221, 231)
    doc.line(130, 35, 192, 35)
    doc.setFontSize(7.5)
    doc.setTextColor(102, 112, 133)
    doc.text('VYSTAVENE', 130, 41)
    doc.text('PLATNOST', 162, 41)
    doc.setFontSize(8.5)
    doc.setTextColor(17, 24, 39)
    doc.text(formatDate(source.date), 130, 46)
    doc.text(source.valid ? formatDate(source.valid) : '-', 162, 46)

    doc.setDrawColor(215, 221, 231)
    doc.line(margin, 64, pageWidth - margin, 64)

    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, 72, 82, 30)
    doc.rect(114, 72, 82, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(102, 112, 133)
    doc.text('ODBERATEL', margin + 4, 79)
    doc.text(pdfSafeText(deliveryTitle).toUpperCase(), 118, 79)
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    doc.text(pdfSafeText(source.customer || 'Bez zakaznika'), margin + 4, 87, { maxWidth: 74 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(pdfSafeText([source.contact ? `Kontaktna osoba: ${source.contact}` : '', source.email ? `Email: ${source.email}` : ''].filter(Boolean).join('\n')), margin + 4, 94, { maxWidth: 74 })
    doc.text(pdfSafeText(deliveryText), 118, 87, { maxWidth: 74 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(119, 210, 11)
    doc.text('NAVRH RIESENIA', margin, 114)
    doc.setFontSize(17)
    doc.setTextColor(17, 24, 39)
    doc.text(pdfSafeText(source.title || 'Cenova ponuka'), margin, 122, { maxWidth: 180 })

    autoTable(doc, {
      startY: 130,
      margin: { left: margin, right: margin, bottom: 58 },
      head: [['C.', 'Polozka', 'Mnozstvo', 'MJ', 'Cena/MJ bez DPH', 'DPH', 'Spolu bez DPH']],
      body: source.items.map((item, index) => {
        const itemTotals = getItemTotals(item)
        return [
          String(index + 1),
          [item.name, item.note].filter(Boolean).join('\n'),
          item.quantity || '1',
          item.unit || 'ks',
          formatMoney(parseMoney(item.unitPrice)),
          `${item.vatRate || '23'} %`,
          formatMoney(itemTotals.net),
        ].map((value) => pdfSafeText(value))
      }),
      styles: {
        font: 'helvetica',
        fontSize: 8.4,
        cellPadding: 2.2,
        textColor: [17, 24, 39],
        lineColor: [232, 237, 243],
        lineWidth: 0.25,
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [240, 243, 247],
        textColor: [52, 64, 84],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 9 },
        1: { cellWidth: 72 },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 12 },
        4: { cellWidth: 27, halign: 'right' },
        5: { cellWidth: 17, halign: 'right' },
        6: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 1) return
        const image = itemImages[data.row.index]
        if (!image) return
        try {
          doc.addImage(image, 'JPEG', data.cell.x + 2, data.cell.y + data.cell.height - 15, 12, 12)
        } catch {
          try {
            doc.addImage(image, 'PNG', data.cell.x + 2, data.cell.y + data.cell.height - 15, 12, 12)
          } catch {}
        }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1 && itemImages[data.row.index]) {
          data.cell.styles.minCellHeight = Math.max(Number(data.cell.styles.minCellHeight || 0), 18)
        }
      },
    })

    let y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 150) + 10
    if (y > pageHeight - 75) {
      doc.addPage()
      y = 24
    }

    doc.setDrawColor(232, 237, 243)
    doc.setFillColor(246, 248, 251)
    doc.rect(margin, y, 82, 28, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(17, 24, 39)
    doc.text('Poznamka a podmienky', margin + 4, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 84, 103)
    doc.text(pdfSafeText(termsText), margin + 4, y + 14, { maxWidth: 74 })

    const totalsX = 116
    doc.setDrawColor(119, 210, 11)
    doc.setLineWidth(0.7)
    doc.rect(totalsX, y, 80, 17)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(17, 24, 39)
    doc.text('CELKOM BEZ DPH', totalsX + 4, y + 10)
    doc.setFontSize(18)
    doc.text(formatMoney(quoteTotals.net), totalsX + 76, y + 11, { align: 'right' })
    doc.setDrawColor(215, 221, 231)
    doc.setLineWidth(0.25)
    let totalsY = y + 17
    if (quoteTotals.discount > 0) {
      doc.rect(totalsX, totalsY, 80, 9)
      doc.setFontSize(8)
      doc.text(pdfSafeText(discountLabel), totalsX + 4, totalsY + 6)
      doc.text(`- ${formatMoney(quoteTotals.discount)}`, totalsX + 76, totalsY + 6, { align: 'right' })
      totalsY += 9
    }
    doc.rect(totalsX, totalsY, 80, 9)
    doc.setFontSize(8)
    doc.text('DPH 23 %', totalsX + 4, totalsY + 6)
    doc.text(formatMoney(quoteTotals.vat), totalsX + 76, totalsY + 6, { align: 'right' })
    doc.rect(totalsX, totalsY + 9, 80, 9)
    doc.text('Celkom s DPH', totalsX + 4, totalsY + 15)
    doc.text(formatMoney(quoteTotals.gross), totalsX + 76, totalsY + 15, { align: 'right' })

    const signY = Math.max(y + 46, pageHeight - 36)
    doc.setDrawColor(152, 162, 179)
    doc.line(margin, signY, 92, signY)
    doc.setFontSize(8)
    doc.setTextColor(102, 112, 133)
    doc.text('Vystavil: ITspot s. r. o.', margin, signY + 6)

    doc.setDrawColor(215, 221, 231)
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
    doc.text('www.itspot.sk', margin, pageHeight - 8)
    doc.text('info@itspot.sk', pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text(`Cenova ponuka ${pdfSafeText(source.number)}`, pageWidth - margin, pageHeight - 8, { align: 'right' })

    const safeName = pdfSafeText(`cenova-ponuka-${source.number}-${source.customer || ''}`).replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() || `cenova-ponuka-${source.number}`
    doc.save(`${safeName}.pdf`)
  }

  async function sendQuoteEmail(quote?: Quote) {
    const target = quote || null
    const recipient = target?.contact_email || contactEmail
    const number = target?.quote_number || quoteNumber || generateQuoteNumber()
    const targetTitle = target?.title || title || 'cenová ponuka'
    await downloadQuotePdf(quote)
    const body = [
      'Dobrý deň,',
      '',
      `v prílohe posielame cenovú ponuku ${number}: ${targetTitle}.`,
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
    padding: '12px min(18px, 3vw)',
  }

  const boxStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #dbe3ee',
    borderRadius: 10,
    boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 28,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '4px 7px',
    fontWeight: 800,
    fontSize: 12,
    background: '#fff',
    color: '#0f172a',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    marginBottom: 2,
    color: '#334155',
    fontSize: 10,
    fontWeight: 900,
  }

  const buttonStyle: CSSProperties = {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 28,
    padding: '4px 9px',
    fontSize: 12,
    textDecoration: 'none',
  }

  const primaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    borderColor: '#65a30d',
    background: '#77d20b',
    boxShadow: '0 12px 24px rgba(119,210,11,0.2)',
  }

  const tabButtonStyle = (active: boolean): CSSProperties => ({
    ...buttonStyle,
    borderColor: active ? '#101827' : '#cbd5e1',
    background: active ? '#101827' : '#fff',
    color: active ? '#fff' : '#0f172a',
  })

  const workflowStepStyle = (active: boolean, tone: CSSProperties = {}): CSSProperties => ({
    ...buttonStyle,
    borderColor: active ? '#77d20b' : '#cbd5e1',
    background: active ? '#ecfccb' : '#fff',
    color: active ? '#365314' : '#334155',
    boxShadow: active ? 'inset 0 0 0 1px rgba(119,210,11,0.35)' : 'none',
    ...tone,
  })

  const editingQuote = editingId ? quotes.find((quote) => quote.id === editingId) : null

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <header style={{ ...boxStyle, padding: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BrandLogo size="sm" />
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>Cenové ponuky</h1>
              <div style={{ color: '#64748b', fontWeight: 800, fontSize: 13 }}>Tvorba, evidencia a odosielanie ponúk</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/" style={buttonStyle}>Domov</Link>
            <button type="button" style={primaryButtonStyle} onClick={startNewQuote}>+ Nová ponuka</button>
          </div>
        </header>

        <div style={{ ...boxStyle, padding: 6, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={tabButtonStyle(activeSection === 'create')} onClick={() => setActiveSection('create')}>
            Tvorba ponuky
          </button>
          <button type="button" style={tabButtonStyle(activeSection === 'list')} onClick={() => setActiveSection('list')}>
            Uložené ponuky ({quotes.length})
          </button>
        </div>

        {notice && (
          <div style={{ ...boxStyle, padding: 14, marginBottom: 16, borderColor: notice.type === 'success' ? '#86efac' : '#fecaca', color: notice.type === 'success' ? '#166534' : '#991b1b' }}>
            <strong>{notice.text}</strong>
          </div>
        )}

        {activeSection === 'create' && (
        <section ref={formRef} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, alignItems: 'start' }}>
          <div style={{ ...boxStyle, padding: 8, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ color: '#77d20b', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {editingId ? 'Úprava ponuky' : 'Nová ponuka'}
              </div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Základné údaje</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'repeat(4, minmax(140px, 1fr))', gap: 6 }}>
              <div>
                <label style={labelStyle}>Číslo ponuky</label>
                <input style={inputStyle} value={quoteNumber} onChange={(event) => setQuoteNumber(event.target.value)} placeholder="260901" />
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

            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#64748b', fontSize: 11, fontWeight: 900 }}>Workflow</span>
              {(['draft', 'sent', 'approved'] as Quote['status'][]).map((step) => (
                <button
                  key={step}
                  type="button"
                  style={workflowStepStyle(status === step)}
                  onClick={() => setStatus(step)}
                >
                  {STATUS_LABELS[step]}
                </button>
              ))}
              <button
                type="button"
                style={workflowStepStyle(status === 'rejected', { color: status === 'rejected' ? '#991b1b' : '#334155' })}
                onClick={() => setStatus('rejected')}
              >
                Zamietnutá
              </button>
              {editingQuote && (
                <button
                  type="button"
                  style={{ ...workflowStepStyle(false), borderColor: '#86efac', background: '#dcfce7', color: '#166534' }}
                  onClick={() => void createOrderFromQuote(editingQuote)}
                  disabled={saving}
                >
                  Vytvoriť zákazku
                </button>
              )}
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

            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Kontaktná osoba</label>
                <input style={inputStyle} value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '180px 1fr', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Typ ponuky</label>
                <select style={inputStyle} value={quoteKind} onChange={(event) => changeQuoteKind(event.target.value as QuoteKind)}>
                  {Object.entries(QUOTE_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{quoteKind === 'sale' ? 'Dodanie' : 'Realizácia'}</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 42, resize: 'vertical' }}
                  value={realizationNote}
                  onChange={(event) => setRealizationNote(event.target.value)}
                  placeholder={quoteKind === 'sale' ? MATERIAL_DELIVERY_NOTE : INSTALLATION_DELIVERY_NOTE}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Poznámka a podmienky</label>
              <textarea style={{ ...inputStyle, minHeight: 46, resize: 'vertical' }} value={note} onChange={(event) => setNote(event.target.value)} placeholder={quoteKind === 'sale' ? MATERIAL_TERMS_NOTE : INSTALLATION_TERMS_NOTE} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Zľava</label>
                <select style={inputStyle} value={discountType} onChange={(event) => setDiscountType(event.target.value as 'none' | 'percent' | 'amount')}>
                  <option value="none">Bez zľavy</option>
                  <option value="percent">Percentá %</option>
                  <option value="amount">Suma bez DPH €</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Hodnota zľavy</label>
                <input
                  style={inputStyle}
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  placeholder={discountType === 'percent' ? 'napr. 5' : discountType === 'amount' ? 'napr. 100' : '0'}
                  disabled={discountType === 'none'}
                />
              </div>
            </div>
          </div>

          <div style={{ ...boxStyle, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#77d20b', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Položky</div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Rozpočet ponuky</h2>
              </div>
              <button type="button" style={buttonStyle} onClick={addItem}>+ Pridať položku</button>
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {quoteItemTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  style={{ ...buttonStyle, background: '#f8fafc', color: '#334155' }}
                  onClick={() => addTemplateItem(template)}
                >
                  + {template.name.replace(' u zákazníka', '').replace(' systému', '')}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 3 }}>
              {items.map((item, index) => {
                const itemTotals = getItemTotals(item)
                if (isCompact) {
                  return (
                    <div key={item.id} style={{ display: 'grid', gap: 5, border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, background: '#fff' }}>
                      <div>
                        <label style={labelStyle}>Položka</label>
                        <input style={inputStyle} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Názov položky" />
                        <input style={{ ...inputStyle, minHeight: 26, marginTop: 3, fontSize: 11 }} value={item.note} onChange={(event) => updateItem(index, 'note', event.target.value)} placeholder="Poznámka k položke" />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                          <label style={{ ...buttonStyle, minHeight: 28, background: '#f8fafc', color: '#334155', cursor: 'pointer' }}>
                            Obrázok
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              style={{ display: 'none' }}
                              onChange={(event) => {
                                void uploadQuoteItemImage(index, event.target.files?.[0])
                                event.currentTarget.value = ''
                              }}
                            />
                          </label>
                          <button type="button" style={{ ...buttonStyle, minHeight: 28, background: '#eef2ff', color: '#3730a3' }} onClick={() => setQuoteItemImageUrl(index)}>
                            URL
                          </button>
                          {item.imageUrl && (
                            <>
                              <img src={item.imageUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid #dbe4ef' }} />
                              <button type="button" style={{ ...buttonStyle, minHeight: 28, color: '#991b1b' }} onClick={() => updateItem(index, 'imageUrl', '')}>Odstrániť</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : '0.75fr 0.55fr 0.9fr 0.65fr 1fr 30px', gap: 5, alignItems: 'end' }}>
                        <div>
                          <label style={labelStyle}>Množstvo</label>
                          <input style={inputStyle} value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>MJ</label>
                          <input style={inputStyle} value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Cena bez DPH</label>
                          <input style={inputStyle} value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} placeholder="0,00" />
                        </div>
                        <div>
                          <label style={labelStyle}>DPH %</label>
                          <input style={inputStyle} value={item.vatRate} onChange={(event) => updateItem(index, 'vatRate', event.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Spolu</label>
                          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#f8fafc' }}>{formatMoney(itemTotals.gross)}</div>
                        </div>
                        <button type="button" style={{ ...buttonStyle, minHeight: 28, padding: 0, color: '#991b1b' }} onClick={() => removeItem(index)} disabled={items.length <= 1}>×</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2.35fr 0.5fr 0.38fr 0.68fr 0.42fr 0.72fr 30px', gap: 4, alignItems: 'end', border: '1px solid #e2e8f0', borderRadius: 6, padding: 4, background: index % 2 ? '#fbfdff' : '#fff' }}>
                    <div>
                      {index === 0 && <label style={labelStyle}>Položka</label>}
                      <input style={inputStyle} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Názov položky" />
                      <input style={{ ...inputStyle, minHeight: 24, marginTop: 2, fontSize: 11 }} value={item.note} onChange={(event) => updateItem(index, 'note', event.target.value)} placeholder="Poznámka k položke" />
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                        <label style={{ ...buttonStyle, minHeight: 24, padding: '0 8px', fontSize: 11, background: '#f8fafc', color: '#334155', cursor: 'pointer' }}>
                          Obrázok
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                              void uploadQuoteItemImage(index, event.target.files?.[0])
                              event.currentTarget.value = ''
                            }}
                          />
                        </label>
                        <button type="button" style={{ ...buttonStyle, minHeight: 24, padding: '0 8px', fontSize: 11, background: '#eef2ff', color: '#3730a3' }} onClick={() => setQuoteItemImageUrl(index)}>
                          URL
                        </button>
                        {item.imageUrl && (
                          <>
                            <img src={item.imageUrl} alt="" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 5, border: '1px solid #dbe4ef' }} />
                            <button type="button" style={{ ...buttonStyle, minHeight: 24, padding: '0 8px', fontSize: 11, color: '#991b1b' }} onClick={() => updateItem(index, 'imageUrl', '')}>Preč</button>
                          </>
                        )}
                      </div>
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
                    <button type="button" style={{ ...buttonStyle, minHeight: 28, padding: 0, color: '#991b1b' }} onClick={() => removeItem(index)} disabled={items.length <= 1}>×</button>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 260px', gap: 8, marginTop: 6, alignItems: 'start' }}>
              <div />
              <div style={{ border: '1px solid #dbe3ee', borderRadius: 7, overflow: 'hidden' }}>
                {totals.discount > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 5, borderBottom: '1px solid #dbe3ee', color: '#64748b', fontSize: 12 }}>
                      <span>Pôvodná cena bez DPH</span>
                      <strong>{formatMoney(totals.originalNet)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 5, borderBottom: '1px solid #dbe3ee', color: '#166534', fontSize: 12 }}>
                      <span>Zľava</span>
                      <strong>- {formatMoney(totals.discount)}</strong>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 7, background: '#101827', color: '#fff', alignItems: 'baseline', fontSize: 13 }}>
                  <span>Celkom bez DPH</span>
                  <strong style={{ fontSize: 19 }}>{formatMoney(totals.net)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 5, borderBottom: '1px solid #dbe3ee', fontSize: 12 }}>
                  <span>DPH 23 %</span>
                  <strong>{formatMoney(totals.vat)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 5, color: '#64748b', fontSize: 12 }}>
                  <span>Celkom s DPH</span>
                  <strong>{formatMoney(totals.gross)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" style={primaryButtonStyle} onClick={saveQuote} disabled={saving}>{saving ? 'Ukladám...' : 'Uložiť ponuku'}</button>
              <button type="button" style={buttonStyle} onClick={() => showQuote()}>Ukáž ponuku</button>
              <button type="button" style={buttonStyle} onClick={() => void downloadQuotePdf()}>Ulož PDF</button>
              <button type="button" style={buttonStyle} onClick={() => sendQuoteEmail()}>Odoslať mailom</button>
              {editingId && (
                <button
                  type="button"
                  style={{ ...buttonStyle, borderColor: '#86efac', background: '#dcfce7', color: '#166534' }}
                  onClick={() => {
                    const quote = quotes.find((item) => item.id === editingId)
                    if (quote) void createOrderFromQuote(quote)
                  }}
                  disabled={saving}
                >
                  Vytvoriť zákazku
                </button>
              )}
              {editingId && (
                <button
                  type="button"
                  style={{ ...buttonStyle, borderColor: '#fbbf24', background: '#fef3c7', color: '#92400e' }}
                  onClick={() => {
                    const quote = quotes.find((item) => item.id === editingId)
                    if (quote) openMaterialImport(quote)
                  }}
                  disabled={saving}
                >
                  Pridať do nákupu
                </button>
              )}
              {editingId && <button type="button" style={buttonStyle} onClick={startNewQuote}>Zrušiť úpravu</button>}
            </div>
          </div>
        </section>
        )}

        {activeSection === 'list' && (
        <section style={{ ...boxStyle, padding: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <div style={{ color: '#77d20b', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Evidencia</div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Uložené ponuky</h2>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, width: isNarrow ? '100%' : 240 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hľadať..." />
              <select style={{ ...inputStyle, width: isNarrow ? '100%' : 160 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Všetky stavy</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <div style={{ color: '#64748b', fontWeight: 800 }}>Načítavam...</div> : null}
          {!loading && filteredQuotes.length === 0 ? (
            <div style={{ display: 'grid', gap: 12, color: '#64748b', fontWeight: 800 }}>
              <div>Zatiaľ tu nie sú žiadne ponuky.</div>
              <button type="button" style={{ ...primaryButtonStyle, width: 'fit-content' }} onClick={importFlowiiQuote260802} disabled={saving}>
                {saving ? 'Ukladám...' : 'Uložiť ponuku 260802 z Flowii'}
              </button>
            </div>
          ) : null}

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {!isCompact && filteredQuotes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '105px 1.05fr 1.6fr 142px 118px 88px 350px', gap: 8, alignItems: 'center', background: '#f8fafc', color: '#475569', fontSize: 10, fontWeight: 950, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '7px 8px', borderBottom: '1px solid #e2e8f0' }}>
                <span>Číslo</span>
                <span>Zákazník</span>
                <span>Názov</span>
                <span>Stav</span>
                <span style={{ textAlign: 'right' }}>Bez DPH</span>
                <span>Dátum</span>
                <span style={{ textAlign: 'right' }}>Akcie</span>
              </div>
            )}
            {filteredQuotes.map((quote, index) => {
              const quoteItems = normalizeItems(quote.items)
              const quoteDiscountType = (quote.discount_type === 'percent' || quote.discount_type === 'amount') ? quote.discount_type : 'none'
              const quoteTotals = getQuoteTotals(quoteItems, quoteDiscountType, quote.discount_value ? String(quote.discount_value) : '')

              if (isCompact) {
                return (
                  <div key={quote.id} style={{ display: 'grid', gap: 6, padding: 9, borderTop: index === 0 ? 'none' : '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div>
                        <strong>{quote.quote_number}</strong>
                        <div style={{ fontWeight: 950 }}>{quote.title}</div>
                        <div style={{ color: '#64748b', fontWeight: 800, fontSize: 12 }}>{quote.customer_name || 'Bez zákazníka'} · {formatMoney(quoteTotals.net)} bez DPH</div>
                      </div>
                      <select
                        style={{ ...inputStyle, ...statusStyle[quote.status], minHeight: 34, width: 142, padding: '4px 8px', fontWeight: 950, fontSize: 12 }}
                        value={quote.status}
                        onChange={(event) => void updateQuoteStatus(quote, event.target.value as Quote['status'])}
                        disabled={saving}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <button type="button" style={buttonStyle} onClick={() => startEdit(quote)}>Upraviť</button>
                      <button type="button" style={buttonStyle} onClick={() => duplicateQuote(quote)}>Duplikovať</button>
                      <button type="button" style={buttonStyle} onClick={() => showQuote(quote)}>Ukáž ponuku</button>
                      <button type="button" style={buttonStyle} onClick={() => void downloadQuotePdf(quote)}>Ulož</button>
                      <button type="button" style={buttonStyle} onClick={() => sendQuoteEmail(quote)}>Email</button>
                      <button type="button" style={{ ...buttonStyle, borderColor: '#fbbf24', background: '#fef3c7', color: '#92400e' }} onClick={() => openMaterialImport(quote)} disabled={saving}>Nákup</button>
                      <button type="button" style={{ ...buttonStyle, borderColor: '#86efac', background: '#dcfce7', color: '#166534' }} onClick={() => void createOrderFromQuote(quote)} disabled={saving}>Zákazka</button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={quote.id} style={{ display: 'grid', gridTemplateColumns: '105px 1.05fr 1.6fr 142px 118px 88px 350px', gap: 8, alignItems: 'center', padding: '6px 8px', borderTop: index === 0 ? 'none' : '1px solid #e2e8f0', background: index % 2 ? '#fbfdff' : '#fff' }}>
                  <strong style={{ fontSize: 13 }}>{quote.quote_number}</strong>
                  <div style={{ color: '#334155', fontWeight: 900, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.customer_name || 'Bez zákazníka'}</div>
                  <div style={{ fontWeight: 950, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.title}</div>
                  <select
                    style={{ ...inputStyle, ...statusStyle[quote.status], minHeight: 34, padding: '4px 8px', fontWeight: 950, fontSize: 12 }}
                    value={quote.status}
                    onChange={(event) => void updateQuoteStatus(quote, event.target.value as Quote['status'])}
                    disabled={saving}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <strong style={{ textAlign: 'right', fontSize: 13 }}>{formatMoney(quoteTotals.net)}</strong>
                  <div style={{ color: '#64748b', fontWeight: 800, fontSize: 12 }}>{formatDate(quote.quote_date)}</div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button type="button" style={buttonStyle} onClick={() => startEdit(quote)}>Upraviť</button>
                    <button type="button" style={buttonStyle} onClick={() => duplicateQuote(quote)}>Kópia</button>
                    <button type="button" style={buttonStyle} onClick={() => showQuote(quote)}>Ukáž ponuku</button>
                    <button type="button" style={buttonStyle} onClick={() => void downloadQuotePdf(quote)}>Ulož</button>
                    <button type="button" style={buttonStyle} onClick={() => sendQuoteEmail(quote)}>Email</button>
                    <button type="button" style={{ ...buttonStyle, borderColor: '#fbbf24', background: '#fef3c7', color: '#92400e' }} onClick={() => openMaterialImport(quote)} disabled={saving}>Nákup</button>
                    <button
                      type="button"
                      style={{ ...buttonStyle, borderColor: '#86efac', background: '#dcfce7', color: '#166534' }}
                      onClick={() => void createOrderFromQuote(quote)}
                      disabled={saving}
                    >
                      Zákazka
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        )}

        {materialQuote && (
          <section
            id="quote-material-import"
            style={{
              ...boxStyle,
              padding: 0,
              marginTop: 8,
              overflow: 'hidden',
              borderColor: '#fbbf24',
              boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
            }}
            aria-label="Nákup materiálu z ponuky"
          >
              <div style={{ padding: isNarrow ? 10 : 14, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ color: '#65a30d', fontSize: 12, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nákup materiálu</div>
                  <h3 style={{ margin: '2px 0 0', fontSize: isNarrow ? 18 : 22, fontWeight: 950 }}>Položky z ponuky {materialQuote.quote_number}</h3>
                  <div style={{ marginTop: 3, color: '#64748b', fontWeight: 800, fontSize: 13 }}>
                    Zaškrtni len to, čo treba objednať. Prácu, dopravu alebo veci skladom nechaj vypnuté.
                  </div>
                </div>
                <button type="button" style={buttonStyle} onClick={() => setMaterialQuote(null)}>
                  Zavrieť
                </button>
              </div>

              <div style={{ padding: isNarrow ? 10 : 14, display: 'grid', alignContent: 'start', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => setSelectedMaterialItemIds(normalizeItems(materialQuote.items).filter((item) => item.name.trim()).map((item) => item.id))}
                  >
                    Označiť všetko
                  </button>
                  <button type="button" style={buttonStyle} onClick={() => setSelectedMaterialItemIds([])}>
                    Odznačiť všetko
                  </button>
                </div>

                <div style={{ border: '1px solid #dbe4ef', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '34px minmax(0, 1fr) 74px' : '46px minmax(0, 1.7fr) 95px 90px', gap: 8, padding: '7px 10px', background: '#0f172a', color: '#fff', fontSize: 11, fontWeight: 950, textTransform: 'uppercase' }}>
                    <span></span>
                    <span>Položka</span>
                    <span>Množstvo</span>
                    {!isNarrow && <span>Cena</span>}
                  </div>
                  {normalizeItems(materialQuote.items).filter((item) => item.name.trim()).map((item, index) => {
                    const checked = selectedMaterialItemIds.includes(item.id)
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isNarrow ? '34px minmax(0, 1fr) 74px' : '46px minmax(0, 1.7fr) 95px 90px',
                          gap: 8,
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderTop: index === 0 ? 'none' : '1px solid #e2e8f0',
                          background: checked ? '#f7fee7' : index % 2 ? '#fbfdff' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMaterialItem(item.id)}
                          style={{ width: 18, height: 18 }}
                        />
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: 13, fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isNarrow ? 'normal' : 'nowrap' }}>{item.name}</strong>
                          {item.note && <small style={{ display: 'block', color: '#64748b', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note}</small>}
                        </span>
                        <span style={{ fontWeight: 900 }}>{item.quantity || '1'} {item.unit || 'ks'}</span>
                        {!isNarrow && <span style={{ color: '#64748b', fontWeight: 900 }}>{formatMoney(parseMoney(item.unitPrice))}</span>}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div style={{ padding: isNarrow ? 10 : 14, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ color: '#64748b', fontWeight: 900 }}>
                  Vybrané položky: {selectedMaterialItemIds.length}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={buttonStyle} onClick={() => setMaterialQuote(null)}>
                    Zrušiť
                  </button>
                  <button
                    type="button"
                    style={{ ...primaryButtonStyle, minHeight: 34 }}
                    onClick={addSelectedQuoteItemsToMaterial}
                    disabled={saving}
                  >
                    {saving ? 'Pridávam...' : 'Pridať vybrané do nákupu'}
                  </button>
                </div>
              </div>
          </section>
        )}
      </div>
    </main>
  )
}
