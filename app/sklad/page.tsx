'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, Download, FileJson, History, Plus, Upload } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { getSessionWithTimeout } from '@/lib/auth-timeout'
import type { Customer, Notice, Order } from '@/lib/dashboard-types'
import { formatDate, getTodayDate } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

type WarehouseItem = {
  id: string
  user_id: string
  sku: string | null
  name: string
  category: string | null
  unit: string
  minimum_quantity: number
  active: boolean
  created_at?: string
  updated_at?: string
}

type WarehouseMovement = {
  id: string
  user_id: string
  item_id: string
  import_batch_id: string | null
  movement_date: string
  direction: 'in' | 'out'
  purpose: 'stock' | 'sale' | 'job' | 'internal' | 'inventory' | 'return' | 'writeoff' | 'opening'
  quantity: number
  unit_cost: number
  supplier_name: string | null
  source_invoice: string | null
  customer_id: string | null
  customer_name: string | null
  order_id: string | null
  note: string | null
  created_at?: string
}

type WarehouseInventory = {
  id: string
  inventory_date: string
  location: string
  responsible_name: string | null
  status: 'draft' | 'closed'
  created_at?: string
}

type ImportDestination = 'stock' | 'customer' | 'job' | 'internal' | 'ignore'

type ImportPreviewLine = {
  key: string
  supplierName: string
  invoiceNumber: string
  invoiceDate: string
  sourceFile: string
  name: string
  sku: string
  category: string
  quantity: number
  unit: string
  unitPriceNet: number
  vatRate: number
  destination: ImportDestination
  customerId: string
  customerName: string
  orderId: string
  note: string
}

type InventoryDraftLine = {
  itemId: string
  name: string
  sku: string
  unit: string
  systemQuantity: number
  physicalQuantity: string
  unitCost: number
}

type StockState = { quantity: number; value: number; unitCost: number }

const PURPOSE_LABELS: Record<WarehouseMovement['purpose'], string> = {
  stock: 'Príjem na sklad', sale: 'Predaj', job: 'Spotreba na zákazke', internal: 'Interná spotreba', inventory: 'Inventúra', return: 'Vrátenie', writeoff: 'Odpis', opening: 'Počiatočný stav',
}

const DESTINATION_LABELS: Record<ImportDestination, string> = {
  stock: 'Sklad', customer: 'Predané zákazníkovi', job: 'Spotrebované na zákazke', internal: 'Interná spotreba', ignore: 'Ignorovať',
}

const UNIT_OPTIONS = ['ks', 'm', 'bal', 'sada', 'l', 'kg', 'hod']

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 3 }).format(value)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value)
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function normalizeDestination(value: unknown): ImportDestination {
  const normalized = String(value || 'stock').toLowerCase()
  if (['customer', 'sale', 'predaj', 'predane'].includes(normalized)) return 'customer'
  if (['job', 'order', 'zakazka'].includes(normalized)) return 'job'
  if (['internal', 'interne', 'firma'].includes(normalized)) return 'internal'
  if (['ignore', 'service', 'sluzba'].includes(normalized)) return 'ignore'
  return 'stock'
}

function parseImportPayload(payload: unknown): ImportPreviewLine[] {
  const root = payload as { documents?: unknown[] }
  const documents = Array.isArray(root?.documents) ? root.documents : Array.isArray(payload) ? payload : [payload]
  const result: ImportPreviewLine[] = []

  documents.forEach((rawDocument, documentIndex) => {
    const document = rawDocument as Record<string, unknown>
    const lines = Array.isArray(document?.lines) ? document.lines : []
    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine as Record<string, unknown>
      const name = String(line.name || line.item_name || line.description || '').trim()
      if (!name) return
      result.push({
        key: `${documentIndex}-${lineIndex}-${Date.now()}`,
        supplierName: String(document.supplier_name || document.supplier || '').trim(),
        invoiceNumber: String(document.invoice_number || '').trim(),
        invoiceDate: String(document.invoice_date || getTodayDate()).slice(0, 10),
        sourceFile: String(document.source_file || '').trim(),
        name,
        sku: String(line.sku || line.code || '').trim(),
        category: String(line.category || '').trim(),
        quantity: Math.max(0, toNumber(line.quantity, 1)),
        unit: String(line.unit || 'ks').trim() || 'ks',
        unitPriceNet: Math.max(0, toNumber(line.unit_price_net ?? line.unit_price ?? line.price_net)),
        vatRate: Math.max(0, toNumber(line.vat_rate ?? line.vat, 23)),
        destination: normalizeDestination(line.destination),
        customerId: String(line.customer_id || '').trim(),
        customerName: String(line.customer_name || '').trim(),
        orderId: String(line.order_id || '').trim(),
        note: String(line.note || '').trim(),
      })
    })
  })
  return result
}

export default function WarehousePage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [activeTab, setActiveTab] = useState<'stock' | 'movement' | 'import' | 'history' | 'inventory' | 'export'>('stock')
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [movements, setMovements] = useState<WarehouseMovement[]>([])
  const [inventories, setInventories] = useState<WarehouseInventory[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [showItemForm, setShowItemForm] = useState(false)
  const [itemForm, setItemForm] = useState({ sku: '', name: '', category: '', unit: 'ks', minimumQuantity: '0' })
  const [movementForm, setMovementForm] = useState({ itemId: '', direction: 'in' as 'in' | 'out', purpose: 'stock' as WarehouseMovement['purpose'], quantity: '1', unitCost: '0', date: getTodayDate(), supplierName: '', invoiceNumber: '', customerId: '', orderId: '', note: '' })
  const [importLines, setImportLines] = useState<ImportPreviewLine[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [inventoryMeta, setInventoryMeta] = useState({ date: getTodayDate(), location: 'ITspot sklad', responsibleName: '', note: '' })
  const [inventoryLines, setInventoryLines] = useState<InventoryDraftLine[]>([])

  const boxStyle: CSSProperties = { background: '#fff', border: '1px solid #dbe4ef', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.07)' }
  const inputStyle: CSSProperties = { width: '100%', minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 7, padding: '5px 8px', fontSize: 12, fontWeight: 800, color: '#0f172a', background: '#fff' }
  const buttonStyle: CSSProperties = { minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 7, padding: '5px 9px', background: '#fff', color: '#0f172a', fontWeight: 900, fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }

  useEffect(() => {
    let mounted = true
    async function initAuth() {
      const session = await getSessionWithTimeout()
      if (!mounted) return
      if (!session?.user) { router.replace('/login'); return }
      setUserId(session.user.id)
      setCheckingAuth(false)
    }
    void initAuth()
    return () => { mounted = false }
  }, [router])

  useEffect(() => { if (userId) void loadData(userId) }, [userId])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function loadData(currentUserId: string) {
    setLoading(true)
    const [itemsResult, movementsResult, inventoriesResult, customersResult, ordersResult] = await Promise.all([
      supabase.from('warehouse_items').select('*').eq('user_id', currentUserId).order('name'),
      supabase.from('warehouse_movements').select('*').eq('user_id', currentUserId).order('movement_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('warehouse_inventories').select('*').eq('user_id', currentUserId).order('inventory_date', { ascending: false }),
      supabase.from('customers').select('*').eq('user_id', currentUserId).order('nazov'),
      supabase.from('orders').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
    ])
    setLoading(false)
    if (itemsResult.error || movementsResult.error || inventoriesResult.error) {
      const error = itemsResult.error || movementsResult.error || inventoriesResult.error
      if (error?.code === '42P01') {
        setSetupRequired(true)
        setNotice({ type: 'error', text: 'Sklad ešte nemá databázové tabuľky. Spusť skript scripts/supabase-warehouse.sql v Supabase SQL Editore.' })
      } else setNotice({ type: 'error', text: `Sklad: ${error?.message}` })
    } else {
      setSetupRequired(false)
      setItems((itemsResult.data || []) as WarehouseItem[])
      setMovements((movementsResult.data || []) as WarehouseMovement[])
      setInventories((inventoriesResult.data || []) as WarehouseInventory[])
    }
    if (!customersResult.error) setCustomers((customersResult.data || []) as Customer[])
    if (!ordersResult.error) setOrders((ordersResult.data || []) as Order[])
  }

  const stockByItem = useMemo(() => {
    const result = new Map<string, StockState>()
    movements.forEach((movement) => {
      const state = result.get(movement.item_id) || { quantity: 0, value: 0, unitCost: 0 }
      const sign = movement.direction === 'in' ? 1 : -1
      state.quantity += sign * Number(movement.quantity)
      state.value += sign * Number(movement.quantity) * Number(movement.unit_cost)
      state.unitCost = state.quantity > 0 ? Math.max(0, state.value) / state.quantity : 0
      result.set(movement.item_id, state)
    })
    return result
  }, [movements])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => !query || `${item.sku || ''} ${item.name} ${item.category || ''}`.toLowerCase().includes(query))
  }, [items, search])

  const summary = useMemo(() => {
    let value = 0
    let low = 0
    items.forEach((item) => {
      const state = stockByItem.get(item.id) || { quantity: 0, value: 0 }
      value += Math.max(0, state.value)
      if (Number(item.minimum_quantity) > 0 && state.quantity <= Number(item.minimum_quantity)) low += 1
    })
    return { cards: items.length, value, low, movements: movements.length }
  }, [items, movements.length, stockByItem])

  function customerName(customerId: string | null, fallback?: string | null) {
    return customers.find((customer) => customer.id === customerId)?.nazov || fallback || ''
  }

  function orderName(orderId: string | null) {
    return orders.find((order) => order.id === orderId)?.nazov || ''
  }

  function selectMovementItem(itemId: string) {
    const state = stockByItem.get(itemId)
    setMovementForm((current) => ({ ...current, itemId, unitCost: state?.unitCost ? String(state.unitCost.toFixed(4)) : current.unitCost }))
  }

  async function saveItem() {
    if (!userId || !itemForm.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('warehouse_items').insert([{ user_id: userId, sku: itemForm.sku.trim() || null, name: itemForm.name.trim(), category: itemForm.category.trim() || null, unit: itemForm.unit || 'ks', minimum_quantity: toNumber(itemForm.minimumQuantity) }]).select().single()
    setSaving(false)
    if (error) { setNotice({ type: 'error', text: `Skladová karta sa neuložila: ${error.message}` }); return }
    setItems((current) => [...current.filter((item) => item.id !== (data as WarehouseItem).id), data as WarehouseItem].sort((a, b) => a.name.localeCompare(b.name, 'sk')))
    setItemForm({ sku: '', name: '', category: '', unit: 'ks', minimumQuantity: '0' })
    setShowItemForm(false)
    setNotice({ type: 'success', text: 'Skladová karta bola vytvorená.' })
  }

  async function saveMovement() {
    if (!userId || !movementForm.itemId) { setNotice({ type: 'error', text: 'Vyber skladovú položku.' }); return }
    const quantity = toNumber(movementForm.quantity)
    if (quantity <= 0) { setNotice({ type: 'error', text: 'Množstvo musí byť väčšie ako nula.' }); return }
    const state = stockByItem.get(movementForm.itemId) || { quantity: 0, value: 0, unitCost: 0 }
    if (movementForm.direction === 'out' && quantity > state.quantity) {
      setNotice({ type: 'error', text: `Na sklade je iba ${formatQuantity(state.quantity)}. Výdaj by vytvoril mínusový stav.` })
      return
    }
    const customer = customers.find((entry) => entry.id === movementForm.customerId)
    setSaving(true)
    const { data, error } = await supabase.from('warehouse_movements').insert([{ user_id: userId, item_id: movementForm.itemId, movement_date: movementForm.date, direction: movementForm.direction, purpose: movementForm.purpose, quantity, unit_cost: movementForm.direction === 'out' && !toNumber(movementForm.unitCost) ? state.unitCost : toNumber(movementForm.unitCost), supplier_name: movementForm.supplierName.trim() || null, source_invoice: movementForm.invoiceNumber.trim() || null, customer_id: movementForm.customerId || null, customer_name: customer?.nazov || null, order_id: movementForm.orderId || null, note: movementForm.note.trim() || null }]).select().single()
    setSaving(false)
    if (error) { setNotice({ type: 'error', text: `Pohyb sa neuložil: ${error.message}` }); return }
    setMovements((current) => [data as WarehouseMovement, ...current])
    setMovementForm((current) => ({ ...current, quantity: '1', supplierName: '', invoiceNumber: '', customerId: '', orderId: '', note: '' }))
    setNotice({ type: 'success', text: movementForm.direction === 'in' ? 'Príjem bol uložený.' : 'Výdaj bol uložený.' })
  }

  async function deleteMovement(movement: WarehouseMovement) {
    if (!userId || !window.confirm('Naozaj chceš zmazať tento skladový pohyb? Stav skladu sa prepočíta.')) return
    const { error } = await supabase.from('warehouse_movements').delete().eq('id', movement.id).eq('user_id', userId)
    if (error) { setNotice({ type: 'error', text: `Pohyb sa nezmazal: ${error.message}` }); return }
    setMovements((current) => current.filter((entry) => entry.id !== movement.id))
    setNotice({ type: 'success', text: 'Pohyb bol zmazaný.' })
  }

  async function loadImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const lines = parseImportPayload(parsed)
      if (!lines.length) throw new Error('V súbore nie sú žiadne položky.')
      setImportLines(lines.map((line) => {
        const matchedCustomer = customers.find((customer) => customer.nazov.toLowerCase() === line.customerName.toLowerCase())
        return { ...line, customerId: line.customerId || matchedCustomer?.id || '' }
      }))
      setImportFileName(file.name)
      setNotice({ type: 'success', text: `Načítaných ${lines.length} položiek. Pred zaúčtovaním ich skontroluj.` })
    } catch (error) {
      setNotice({ type: 'error', text: `Import sa nepodarilo načítať: ${error instanceof Error ? error.message : 'neplatný JSON'}` })
    } finally {
      event.target.value = ''
    }
  }

  function updateImportLine(key: string, patch: Partial<ImportPreviewLine>) {
    setImportLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line))
  }

  async function postImport() {
    if (!userId) return
    const activeLines = importLines.filter((line) => line.destination !== 'ignore' && line.quantity > 0)
    if (!activeLines.length) { setNotice({ type: 'error', text: 'Nie je vybraná žiadna položka na zaúčtovanie.' }); return }
    const missingCustomer = activeLines.find((line) => line.destination === 'customer' && !line.customerId && !line.customerName)
    if (missingCustomer) { setNotice({ type: 'error', text: `Pri položke „${missingCustomer.name}“ vyber zákazníka.` }); return }

    const invoiceNumbers = [...new Set(activeLines.map((line) => line.invoiceNumber).filter(Boolean))]
    if (invoiceNumbers.length) {
      const { data: duplicates } = await supabase.from('warehouse_movements').select('source_invoice').eq('user_id', userId).in('source_invoice', invoiceNumbers).limit(1)
      if (duplicates?.length && !window.confirm('Niektoré číslo faktúry už v sklade existuje. Chceš napriek tomu pokračovať?')) return
    }

    setSaving(true)
    const batchName = importFileName || `Import ${getTodayDate()}`
    const { data: batch, error: batchError } = await supabase.from('warehouse_import_batches').insert([{ user_id: userId, batch_name: batchName, supplier_name: [...new Set(activeLines.map((line) => line.supplierName).filter(Boolean))].join(', ') || null, invoice_number: invoiceNumbers.join(', ') || null, invoice_date: activeLines[0]?.invoiceDate || null, source_files: [...new Set(activeLines.map((line) => line.sourceFile).filter(Boolean))], imported_lines: importLines }]).select().single()
    if (batchError) { setSaving(false); setNotice({ type: 'error', text: `Import sa neuložil: ${batchError.message}` }); return }

    const itemCache = [...items]
    const movementRows: Record<string, unknown>[] = []
    for (const line of activeLines) {
      let item = itemCache.find((entry) => line.sku ? entry.sku?.toLowerCase() === line.sku.toLowerCase() : entry.name.toLowerCase() === line.name.toLowerCase())
      if (!item) {
        const { data, error } = await supabase.from('warehouse_items').insert([{ user_id: userId, sku: line.sku || null, name: line.name, category: line.category || null, unit: line.unit }]).select().single()
        if (error || !data) { setSaving(false); setNotice({ type: 'error', text: `Položka „${line.name}“ sa nevytvorila: ${error?.message}` }); return }
        item = data as WarehouseItem
        itemCache.push(item)
      }
      const common = { user_id: userId, item_id: item.id, import_batch_id: batch.id, movement_date: line.invoiceDate || getTodayDate(), quantity: line.quantity, unit_cost: line.unitPriceNet, supplier_name: line.supplierName || null, source_invoice: line.invoiceNumber || null, note: line.note || null }
      movementRows.push({ ...common, direction: 'in', purpose: 'stock' })
      if (line.destination !== 'stock') {
        const customer = customers.find((entry) => entry.id === line.customerId)
        movementRows.push({ ...common, direction: 'out', purpose: line.destination === 'customer' ? 'sale' : line.destination, customer_id: line.customerId || null, customer_name: customer?.nazov || line.customerName || null, order_id: line.orderId || null })
      }
    }
    const { error: movementError } = await supabase.from('warehouse_movements').insert(movementRows)
    setSaving(false)
    if (movementError) { setNotice({ type: 'error', text: `Pohyby sa nevytvorili: ${movementError.message}` }); return }
    setImportLines([])
    setImportFileName('')
    await loadData(userId)
    setActiveTab('stock')
    setNotice({ type: 'success', text: `Import je zaúčtovaný. Vytvorených bolo ${movementRows.length} skladových pohybov.` })
  }

  function downloadImportTemplate() {
    const template = { version: 1, batch_name: '2026-10', documents: [{ supplier_name: 'Dodávateľ, s.r.o.', invoice_number: 'FV2026001', invoice_date: getTodayDate(), source_file: 'faktura.pdf', lines: [{ name: 'Dahua 4 Mpx IP kamera', sku: 'IPC-XXXX', category: 'Kamery', quantity: 2, unit: 'ks', unit_price_net: 120.5, vat_rate: 23, destination: 'stock', customer_name: '', note: '' }] }] }
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'itspot-sklad-import-vzor.json'; anchor.click(); URL.revokeObjectURL(url)
  }

  function prepareInventory() {
    setInventoryLines(items.filter((item) => item.active).map((item) => {
      const state = stockByItem.get(item.id) || { quantity: 0, unitCost: 0 }
      return { itemId: item.id, name: item.name, sku: item.sku || '', unit: item.unit, systemQuantity: state.quantity, physicalQuantity: String(state.quantity), unitCost: state.unitCost }
    }))
  }

  async function closeInventory() {
    if (!userId || !inventoryLines.length) return
    if (!window.confirm('Uzavrieť inventúru a vytvoriť skladové korekcie pre zistené rozdiely?')) return
    setSaving(true)
    const { data: inventory, error } = await supabase.from('warehouse_inventories').insert([{ user_id: userId, inventory_date: inventoryMeta.date, location: inventoryMeta.location.trim() || 'ITspot sklad', responsible_name: inventoryMeta.responsibleName.trim() || null, note: inventoryMeta.note.trim() || null, status: 'closed', closed_at: new Date().toISOString() }]).select().single()
    if (error || !inventory) { setSaving(false); setNotice({ type: 'error', text: `Inventúra sa neuložila: ${error?.message}` }); return }
    const lines = inventoryLines.map((line) => ({ user_id: userId, inventory_id: inventory.id, item_id: line.itemId, system_quantity: line.systemQuantity, physical_quantity: toNumber(line.physicalQuantity), unit_cost: line.unitCost }))
    const { error: linesError } = await supabase.from('warehouse_inventory_lines').insert(lines)
    if (linesError) { setSaving(false); setNotice({ type: 'error', text: `Riadky inventúry sa neuložili: ${linesError.message}` }); return }
    const corrections = inventoryLines.flatMap((line) => {
      const difference = toNumber(line.physicalQuantity) - line.systemQuantity
      if (Math.abs(difference) < 0.0001) return []
      return [{ user_id: userId, item_id: line.itemId, movement_date: inventoryMeta.date, direction: difference > 0 ? 'in' : 'out', purpose: 'inventory', quantity: Math.abs(difference), unit_cost: line.unitCost, note: `Inventúra ${formatDate(inventoryMeta.date)}` }]
    })
    if (corrections.length) {
      const { error: correctionsError } = await supabase.from('warehouse_movements').insert(corrections)
      if (correctionsError) { setSaving(false); setNotice({ type: 'error', text: `Inventúrne korekcie sa nevytvorili: ${correctionsError.message}` }); return }
    }
    setSaving(false)
    setInventoryLines([])
    await loadData(userId)
    setNotice({ type: 'success', text: `Inventúra bola uzavretá. Korekcie: ${corrections.length}.` })
  }

  function exportStock() {
    downloadCsv(`sklad-stav-${getTodayDate()}.csv`, [['Kód', 'Položka', 'Kategória', 'MJ', 'Množstvo', 'Priemerná nákupná cena bez DPH', 'Hodnota bez DPH'], ...items.map((item) => { const state = stockByItem.get(item.id) || { quantity: 0, unitCost: 0, value: 0 }; return [item.sku, item.name, item.category, item.unit, state.quantity, state.unitCost.toFixed(4), Math.max(0, state.value).toFixed(2)] })])
  }

  function exportMovements() {
    downloadCsv(`sklad-pohyby-${getTodayDate()}.csv`, [['Dátum', 'Smer', 'Účel', 'Kód', 'Položka', 'Množstvo', 'MJ', 'Cena/MJ bez DPH', 'Hodnota', 'Dodávateľ', 'Faktúra', 'Zákazník', 'Zákazka', 'Poznámka'], ...movements.map((movement) => { const item = items.find((entry) => entry.id === movement.item_id); return [movement.movement_date, movement.direction === 'in' ? 'Príjem' : 'Výdaj', PURPOSE_LABELS[movement.purpose], item?.sku, item?.name, movement.quantity, item?.unit, movement.unit_cost, Number(movement.quantity) * Number(movement.unit_cost), movement.supplier_name, movement.source_invoice, customerName(movement.customer_id, movement.customer_name), orderName(movement.order_id), movement.note] })])
  }

  function printInventory() {
    const rows = (inventoryLines.length ? inventoryLines : items.map((item) => { const state = stockByItem.get(item.id) || { quantity: 0, unitCost: 0 }; return { itemId: item.id, name: item.name, sku: item.sku || '', unit: item.unit, systemQuantity: state.quantity, physicalQuantity: String(state.quantity), unitCost: state.unitCost } }))
    const popup = window.open('', '_blank')
    if (!popup) { setNotice({ type: 'error', text: 'Prehliadač zablokoval okno pre tlač.' }); return }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Inventúrny súpis</title><style>body{font-family:Arial;padding:24px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#eee}.num{text-align:right}.sign{margin-top:50px;display:flex;justify-content:space-between}.sign div{width:42%;border-top:1px solid #111;padding-top:6px}@media print{body{padding:0}}</style></head><body><h1>Inventúrny súpis zásob</h1><p><strong>ITspot s. r. o.</strong><br>Dátum inventúry: ${formatDate(inventoryMeta.date)}<br>Miesto uloženia: ${inventoryMeta.location}<br>Zodpovedná osoba: ${inventoryMeta.responsibleName || '________________'}</p><table><thead><tr><th>Kód</th><th>Položka</th><th>MJ</th><th>Evidenčný stav</th><th>Fyzický stav</th><th>Rozdiel</th><th>Cena/MJ</th><th>Hodnota fyzického stavu</th></tr></thead><tbody>${rows.map((line) => { const physical = toNumber(line.physicalQuantity); return `<tr><td>${line.sku}</td><td>${line.name}</td><td>${line.unit}</td><td class="num">${formatQuantity(line.systemQuantity)}</td><td class="num">${formatQuantity(physical)}</td><td class="num">${formatQuantity(physical - line.systemQuantity)}</td><td class="num">${formatMoney(line.unitCost)}</td><td class="num">${formatMoney(physical * line.unitCost)}</td></tr>` }).join('')}</tbody></table><div class="sign"><div>Zodpovedná osoba</div><div>Osoba vykonávajúca inventúru</div></div><script>window.onload=()=>window.print()</script></body></html>`)
    popup.document.close()
  }

  if (checkingAuth) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontWeight: 900 }}>Načítavam...</main>

  const tabs = [
    { id: 'stock', label: 'Stav skladu', icon: Boxes }, { id: 'movement', label: 'Príjem / výdaj', icon: ArrowDownToLine }, { id: 'import', label: 'Import dokladov', icon: Upload }, { id: 'history', label: 'Pohyby', icon: History }, { id: 'inventory', label: 'Inventúra', icon: ClipboardCheck }, { id: 'export', label: 'Export', icon: Download },
  ] as const

  return (
    <main className="warehousePage">
      <style jsx global>{`
        body{margin:0;background:#eaf0f7;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.warehousePage{min-height:100vh;padding:10px}.warehouseShell{max-width:1540px;margin:0 auto;display:grid;gap:9px}.warehouseHero{padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:linear-gradient(135deg,#0b1120 0%,#172033 70%,#365314 100%)!important;color:#fff;border:0!important}.warehouseHero h1,.warehouseSection h2{margin:0;font-weight:950}.warehouseHero p{margin:3px 0 0;color:#cbd5e1;font-size:12px;font-weight:700}.warehouseActions,.warehouseRow,.warehouseFilters{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.warehouseStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.warehouseStat{padding:8px 10px;border-left:4px solid #84cc16!important;display:flex;justify-content:space-between;align-items:center}.warehouseStat span{color:#64748b;font-size:10px;font-weight:950;text-transform:uppercase}.warehouseStat strong{font-size:20px}.warehouseTabs{padding:5px;display:flex;gap:4px;overflow-x:auto}.warehouseTab{min-height:34px;border:0;border-radius:7px;padding:6px 10px;background:transparent;color:#475569;display:inline-flex;gap:6px;align-items:center;white-space:nowrap;font-size:12px;font-weight:950;cursor:pointer}.warehouseTab.active{background:#0f172a;color:#fff}.warehouseSection{padding:10px;display:grid;gap:9px}.warehouseSectionHead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.warehouseKicker{color:#65a30d;font-size:10px;font-weight:950;text-transform:uppercase}.warehouseGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.warehouseField{display:grid;gap:3px}.warehouseField label{color:#475569;font-size:10px;font-weight:950}.warehouseTableWrap{overflow:auto;border:1px solid #dbe4ef;border-radius:8px}.warehouseTable{width:100%;border-collapse:collapse;min-width:900px;font-size:12px}.warehouseTable th{position:sticky;top:0;background:#eef2f7;color:#334155;padding:7px;text-align:left;font-size:10px;text-transform:uppercase;z-index:1}.warehouseTable td{padding:6px 7px;border-top:1px solid #e2e8f0;vertical-align:middle}.warehouseTable tbody tr:nth-child(even){background:#f8fafc}.warehouseTable .num{text-align:right;font-variant-numeric:tabular-nums}.warehouseTable .strong{font-weight:950}.warehouseLow{color:#b45309;background:#fffbeb!important}.warehouseEmpty{padding:30px;text-align:center;color:#64748b;font-weight:800}.warehouseBadge{display:inline-flex;border:1px solid #cbd5e1;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:950}.warehouseIn{background:#dcfce7;color:#166534;border-color:#86efac}.warehouseOut{background:#fee2e2;color:#991b1b;border-color:#fca5a5}.warehouseImportHelp{padding:10px;border:1px dashed #94a3b8;border-radius:8px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.45}.warehouseImportFile{position:relative;overflow:hidden}.warehouseImportFile input{position:absolute;inset:0;opacity:0;cursor:pointer}.warehouseInventoryMeta{display:grid;grid-template-columns:160px 1fr 1fr 1.4fr;gap:7px}.warehouseSetup{padding:14px;background:#fff7ed!important;border-color:#fdba74!important;color:#9a3412;font-weight:850}.warehouseNotice{padding:9px 11px;font-size:12px;font-weight:900}.warehouseNotice.success{background:#f7fee7!important;border-color:#bef264!important;color:#365314}.warehouseNotice.error{background:#fff1f2!important;border-color:#fecaca!important;color:#991b1b}.warehouseExportGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.warehouseExportCard{border:1px solid #dbe4ef;border-radius:8px;padding:12px;display:grid;gap:8px}.warehouseExportCard h3{margin:0;font-size:15px}.warehouseExportCard p{margin:0;color:#64748b;font-size:12px;line-height:1.4}@media(max-width:1000px){.warehouseStats,.warehouseExportGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.warehouseGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.warehouseInventoryMeta{grid-template-columns:1fr 1fr}}@media(max-width:650px){.warehousePage{padding:6px}.warehouseHero{align-items:flex-start;flex-direction:column}.warehouseStats,.warehouseExportGrid,.warehouseGrid,.warehouseInventoryMeta{grid-template-columns:1fr}.warehouseStat strong{font-size:17px}.warehouseSection{padding:7px}}
      `}</style>
      <div className="warehouseShell">
        <header className="warehouseHero" style={boxStyle}><div className="warehouseRow"><BrandLogo size="sm" tone="dark"/><div><h1>Sklad</h1><p>Príjem, výdaj, import dokladov a inventúra.</p></div></div><div className="warehouseActions"><Link href="/material" style={buttonStyle}>Na objednanie</Link><Link href="/" style={buttonStyle}>Domov</Link></div></header>
        {notice && <div className={`warehouseNotice ${notice.type}`} style={boxStyle}>{notice.text}</div>}
        {setupRequired && <div className="warehouseSetup" style={boxStyle}>V Supabase SQL Editore spusti celý súbor <strong>scripts/supabase-warehouse.sql</strong>. Potom obnov túto stránku.</div>}

        <section className="warehouseStats"><div className="warehouseStat" style={boxStyle}><span>Skladové karty</span><strong>{summary.cards}</strong></div><div className="warehouseStat" style={boxStyle}><span>Hodnota bez DPH</span><strong>{formatMoney(summary.value)}</strong></div><div className="warehouseStat" style={boxStyle}><span>Pod minimom</span><strong>{summary.low}</strong></div><div className="warehouseStat" style={boxStyle}><span>Pohyby</span><strong>{summary.movements}</strong></div></section>
        <nav className="warehouseTabs" style={boxStyle}>{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`warehouseTab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}><Icon size={15}/>{label}</button>)}</nav>

        {activeTab === 'stock' && <section className="warehouseSection" style={boxStyle}><div className="warehouseSectionHead"><div><div className="warehouseKicker">Aktuálny stav</div><h2>Skladové karty</h2></div><div className="warehouseFilters"><input style={{...inputStyle,width:250}} placeholder="Hľadať názov alebo kód..." value={search} onChange={(event)=>setSearch(event.target.value)}/><button type="button" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}} onClick={()=>setShowItemForm((current)=>!current)}><Plus size={14}/>Nová karta</button></div></div>{showItemForm&&<div className="warehouseGrid"><div className="warehouseField"><label>Kód / SKU</label><input style={inputStyle} value={itemForm.sku} onChange={(e)=>setItemForm({...itemForm,sku:e.target.value})}/></div><div className="warehouseField"><label>Názov</label><input style={inputStyle} value={itemForm.name} onChange={(e)=>setItemForm({...itemForm,name:e.target.value})}/></div><div className="warehouseField"><label>Kategória</label><input style={inputStyle} value={itemForm.category} onChange={(e)=>setItemForm({...itemForm,category:e.target.value})}/></div><div className="warehouseField"><label>MJ</label><select style={inputStyle} value={itemForm.unit} onChange={(e)=>setItemForm({...itemForm,unit:e.target.value})}>{UNIT_OPTIONS.map((unit)=><option key={unit}>{unit}</option>)}</select></div><div className="warehouseField"><label>Minimálny stav</label><div className="warehouseRow"><input style={inputStyle} type="number" step="0.001" value={itemForm.minimumQuantity} onChange={(e)=>setItemForm({...itemForm,minimumQuantity:e.target.value})}/><button type="button" style={buttonStyle} disabled={saving||!itemForm.name.trim()} onClick={()=>void saveItem()}>Uložiť</button></div></div></div>}<div className="warehouseTableWrap">{loading?<div className="warehouseEmpty">Načítavam...</div>:filteredItems.length===0?<div className="warehouseEmpty">Sklad je zatiaľ prázdny.</div>:<table className="warehouseTable"><thead><tr><th>Kód</th><th>Položka</th><th>Kategória</th><th>MJ</th><th className="num">Množstvo</th><th className="num">Cena/MJ</th><th className="num">Hodnota</th><th></th></tr></thead><tbody>{filteredItems.map((item)=>{const state=stockByItem.get(item.id)||{quantity:0,unitCost:0,value:0};const low=Number(item.minimum_quantity)>0&&state.quantity<=Number(item.minimum_quantity);return <tr key={item.id} className={low?'warehouseLow':''}><td>{item.sku||'-'}</td><td className="strong">{item.name}</td><td>{item.category||'-'}</td><td>{item.unit}</td><td className="num strong">{formatQuantity(state.quantity)}</td><td className="num">{formatMoney(state.unitCost)}</td><td className="num strong">{formatMoney(Math.max(0,state.value))}</td><td><button type="button" style={buttonStyle} onClick={()=>{setMovementForm((current)=>({...current,itemId:item.id,unitCost:state.unitCost.toFixed(4)}));setActiveTab('movement')}}>Pohyb</button></td></tr>})}</tbody></table>}</div></section>}

        {activeTab === 'movement' && <section className="warehouseSection" style={boxStyle}><div><div className="warehouseKicker">Ručný doklad</div><h2>Príjem alebo výdaj</h2></div><div className="warehouseGrid"><div className="warehouseField"><label>Položka</label><select style={inputStyle} value={movementForm.itemId} onChange={(e)=>selectMovementItem(e.target.value)}><option value="">Vyber položku</option>{items.map((item)=><option key={item.id} value={item.id}>{item.sku?`${item.sku} – `:''}{item.name}</option>)}</select></div><div className="warehouseField"><label>Smer</label><select style={inputStyle} value={movementForm.direction} onChange={(e)=>setMovementForm({...movementForm,direction:e.target.value as 'in'|'out',purpose:e.target.value==='in'?'stock':'sale'})}><option value="in">Príjem</option><option value="out">Výdaj</option></select></div><div className="warehouseField"><label>Účel</label><select style={inputStyle} value={movementForm.purpose} onChange={(e)=>setMovementForm({...movementForm,purpose:e.target.value as WarehouseMovement['purpose']})}>{Object.entries(PURPOSE_LABELS).filter(([key])=>movementForm.direction==='in'?['stock','return','opening','inventory'].includes(key):['sale','job','internal','return','writeoff','inventory'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className="warehouseField"><label>Množstvo</label><input style={inputStyle} type="number" step="0.001" min="0" value={movementForm.quantity} onChange={(e)=>setMovementForm({...movementForm,quantity:e.target.value})}/></div><div className="warehouseField"><label>Cena/MJ bez DPH</label><input style={inputStyle} type="number" step="0.0001" min="0" value={movementForm.unitCost} onChange={(e)=>setMovementForm({...movementForm,unitCost:e.target.value})}/></div><div className="warehouseField"><label>Dátum</label><input style={inputStyle} type="date" value={movementForm.date} onChange={(e)=>setMovementForm({...movementForm,date:e.target.value})}/></div><div className="warehouseField"><label>Dodávateľ</label><input style={inputStyle} value={movementForm.supplierName} onChange={(e)=>setMovementForm({...movementForm,supplierName:e.target.value})}/></div><div className="warehouseField"><label>Číslo faktúry / dokladu</label><input style={inputStyle} value={movementForm.invoiceNumber} onChange={(e)=>setMovementForm({...movementForm,invoiceNumber:e.target.value})}/></div><div className="warehouseField"><label>Zákazník</label><select style={inputStyle} value={movementForm.customerId} onChange={(e)=>setMovementForm({...movementForm,customerId:e.target.value})}><option value="">Bez zákazníka</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.nazov}</option>)}</select></div><div className="warehouseField"><label>Zákazka</label><select style={inputStyle} value={movementForm.orderId} onChange={(e)=>setMovementForm({...movementForm,orderId:e.target.value})}><option value="">Bez zákazky</option>{orders.map((order)=><option key={order.id} value={order.id}>{order.nazov}</option>)}</select></div><div className="warehouseField" style={{gridColumn:'span 4'}}><label>Poznámka</label><input style={inputStyle} value={movementForm.note} onChange={(e)=>setMovementForm({...movementForm,note:e.target.value})}/></div><div className="warehouseField"><label>&nbsp;</label><button type="button" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}} disabled={saving} onClick={()=>void saveMovement()}>{movementForm.direction==='in'?<ArrowDownToLine size={15}/>:<ArrowUpFromLine size={15}/>}Uložiť pohyb</button></div></div></section>}

        {activeTab === 'import' && <section className="warehouseSection" style={boxStyle}><div className="warehouseSectionHead"><div><div className="warehouseKicker">Mesačná dávka</div><h2>Import dokladov</h2></div><div className="warehouseActions"><button type="button" style={buttonStyle} onClick={downloadImportTemplate}><FileJson size={14}/>Vzor JSON</button><label className="warehouseImportFile" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}}><Upload size={14}/>Načítať JSON<input type="file" accept="application/json,.json" onChange={(event)=>void loadImportFile(event)}/></label></div></div><div className="warehouseImportHelp">Sem nahráš JSON, ktorý pripravím z dodávateľských PDF. Pred potvrdením môžeš pri každej položke zmeniť cieľ a vybrať zákazníka alebo zákazku. Import nikdy nezaúčtuje služby označené ako <strong>Ignorovať</strong>.</div>{importLines.length>0&&<><div className="warehouseTableWrap"><table className="warehouseTable" style={{minWidth:1250}}><thead><tr><th>Doklad</th><th>Položka</th><th>Kód</th><th className="num">Množstvo</th><th>MJ</th><th className="num">Cena bez DPH</th><th>Cieľ</th><th>Zákazník</th><th>Zákazka</th></tr></thead><tbody>{importLines.map((line)=><tr key={line.key}><td><strong>{line.invoiceNumber||'-'}</strong><br/><small>{line.supplierName}</small></td><td className="strong">{line.name}</td><td>{line.sku||'-'}</td><td className="num"><input style={{...inputStyle,width:80,textAlign:'right'}} type="number" step="0.001" value={line.quantity} onChange={(e)=>updateImportLine(line.key,{quantity:toNumber(e.target.value)})}/></td><td>{line.unit}</td><td className="num"><input style={{...inputStyle,width:95,textAlign:'right'}} type="number" step="0.0001" value={line.unitPriceNet} onChange={(e)=>updateImportLine(line.key,{unitPriceNet:toNumber(e.target.value)})}/></td><td><select style={{...inputStyle,width:190}} value={line.destination} onChange={(e)=>updateImportLine(line.key,{destination:e.target.value as ImportDestination})}>{Object.entries(DESTINATION_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td><td><select style={{...inputStyle,width:180}} value={line.customerId} disabled={!['customer','job'].includes(line.destination)} onChange={(e)=>updateImportLine(line.key,{customerId:e.target.value})}><option value="">Bez zákazníka</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.nazov}</option>)}</select></td><td><select style={{...inputStyle,width:190}} value={line.orderId} disabled={line.destination!=='job'} onChange={(e)=>updateImportLine(line.key,{orderId:e.target.value})}><option value="">Bez zákazky</option>{orders.map((order)=><option key={order.id} value={order.id}>{order.nazov}</option>)}</select></td></tr>)}</tbody></table></div><div className="warehouseRow" style={{justifyContent:'space-between'}}><strong>{importFileName} · {importLines.length} položiek</strong><div className="warehouseActions"><button type="button" style={buttonStyle} onClick={()=>{setImportLines([]);setImportFileName('')}}>Zrušiť</button><button type="button" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}} disabled={saving} onClick={()=>void postImport()}>{saving?'Zaúčtovávam...':'Zaúčtovať import'}</button></div></div></>}</section>}

        {activeTab === 'history' && <section className="warehouseSection" style={boxStyle}><div><div className="warehouseKicker">Auditná stopa</div><h2>Skladové pohyby</h2></div><div className="warehouseTableWrap">{movements.length===0?<div className="warehouseEmpty">Zatiaľ tu nie sú pohyby.</div>:<table className="warehouseTable" style={{minWidth:1150}}><thead><tr><th>Dátum</th><th>Smer</th><th>Položka</th><th>Účel</th><th className="num">Množstvo</th><th className="num">Cena/MJ</th><th>Doklad</th><th>Zákazník / zákazka</th><th>Poznámka</th><th></th></tr></thead><tbody>{movements.map((movement)=>{const item=items.find((entry)=>entry.id===movement.item_id);return <tr key={movement.id}><td>{formatDate(movement.movement_date)}</td><td><span className={`warehouseBadge ${movement.direction==='in'?'warehouseIn':'warehouseOut'}`}>{movement.direction==='in'?'Príjem':'Výdaj'}</span></td><td className="strong">{item?.name||'Neznáma položka'}</td><td>{PURPOSE_LABELS[movement.purpose]}</td><td className="num strong">{formatQuantity(Number(movement.quantity))} {item?.unit}</td><td className="num">{formatMoney(Number(movement.unit_cost))}</td><td>{movement.source_invoice||'-'}<br/><small>{movement.supplier_name}</small></td><td>{customerName(movement.customer_id,movement.customer_name)||'-'}<br/><small>{orderName(movement.order_id)}</small></td><td>{movement.note||'-'}</td><td><button type="button" style={{...buttonStyle,color:'#b91c1c'}} onClick={()=>void deleteMovement(movement)}>Zmazať</button></td></tr>})}</tbody></table>}</div></section>}

        {activeTab === 'inventory' && <section className="warehouseSection" style={boxStyle}><div className="warehouseSectionHead"><div><div className="warehouseKicker">Fyzická kontrola</div><h2>Inventúra</h2></div>{!inventoryLines.length&&<button type="button" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}} onClick={prepareInventory}><ClipboardCheck size={14}/>Začať inventúru</button>}</div><div className="warehouseInventoryMeta"><div className="warehouseField"><label>Dátum</label><input style={inputStyle} type="date" value={inventoryMeta.date} onChange={(e)=>setInventoryMeta({...inventoryMeta,date:e.target.value})}/></div><div className="warehouseField"><label>Miesto uloženia</label><input style={inputStyle} value={inventoryMeta.location} onChange={(e)=>setInventoryMeta({...inventoryMeta,location:e.target.value})}/></div><div className="warehouseField"><label>Zodpovedná osoba</label><input style={inputStyle} value={inventoryMeta.responsibleName} onChange={(e)=>setInventoryMeta({...inventoryMeta,responsibleName:e.target.value})}/></div><div className="warehouseField"><label>Poznámka</label><input style={inputStyle} value={inventoryMeta.note} onChange={(e)=>setInventoryMeta({...inventoryMeta,note:e.target.value})}/></div></div>{inventoryLines.length>0?<><div className="warehouseTableWrap"><table className="warehouseTable"><thead><tr><th>Kód</th><th>Položka</th><th>MJ</th><th className="num">Evidovaný stav</th><th className="num">Fyzický stav</th><th className="num">Rozdiel</th><th className="num">Cena/MJ</th></tr></thead><tbody>{inventoryLines.map((line)=><tr key={line.itemId}><td>{line.sku||'-'}</td><td className="strong">{line.name}</td><td>{line.unit}</td><td className="num">{formatQuantity(line.systemQuantity)}</td><td className="num"><input style={{...inputStyle,width:100,textAlign:'right'}} type="number" step="0.001" value={line.physicalQuantity} onChange={(e)=>setInventoryLines((current)=>current.map((entry)=>entry.itemId===line.itemId?{...entry,physicalQuantity:e.target.value}:entry))}/></td><td className="num strong">{formatQuantity(toNumber(line.physicalQuantity)-line.systemQuantity)}</td><td className="num">{formatMoney(line.unitCost)}</td></tr>)}</tbody></table></div><div className="warehouseRow" style={{justifyContent:'space-between'}}><button type="button" style={buttonStyle} onClick={printInventory}>Tlačiť súpis</button><div className="warehouseActions"><button type="button" style={buttonStyle} onClick={()=>setInventoryLines([])}>Zrušiť</button><button type="button" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}} disabled={saving} onClick={()=>void closeInventory()}>{saving?'Ukladám...':'Uzavrieť inventúru'}</button></div></div></>:<div className="warehouseEmpty">Klikni na „Začať inventúru“. Aplikácia načíta evidovaný stav a ty doplníš fyzicky spočítané množstvo.</div>}{inventories.length>0&&<div><strong>Posledné inventúry:</strong> {inventories.slice(0,5).map((inventory)=><span key={inventory.id} className="warehouseBadge" style={{marginLeft:6}}>{formatDate(inventory.inventory_date)} · {inventory.location}</span>)}</div>}</section>}

        {activeTab === 'export' && <section className="warehouseSection" style={boxStyle}><div><div className="warehouseKicker">Účtovníctvo</div><h2>Export skladu</h2></div><div className="warehouseExportGrid"><article className="warehouseExportCard"><Boxes size={22}/><h3>Stav skladu</h3><p>Skladové karty, množstvo, priemerná nákupná cena a hodnota zásob bez DPH.</p><button type="button" style={buttonStyle} onClick={exportStock}><Download size={14}/>Stiahnuť CSV</button></article><article className="warehouseExportCard"><History size={22}/><h3>Všetky pohyby</h3><p>Príjmy a výdaje vrátane dokladov, dodávateľov, zákazníkov a zákaziek.</p><button type="button" style={buttonStyle} onClick={exportMovements}><Download size={14}/>Stiahnuť CSV</button></article><article className="warehouseExportCard"><ClipboardCheck size={22}/><h3>Inventúrny súpis</h3><p>Prehľad evidovaného a fyzického stavu pripravený na tlač alebo uloženie do PDF.</p><button type="button" style={buttonStyle} onClick={printInventory}>Tlačiť / uložiť PDF</button></article></div></section>}
      </div>
    </main>
  )
}
