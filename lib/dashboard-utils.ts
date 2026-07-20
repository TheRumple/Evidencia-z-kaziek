import type { CSSProperties } from 'react'

export const STATUSY = [
  { value: 'nova', label: 'Nová' },
  { value: 'rozpracovana', label: 'Rozpracovaná' },
  { value: 'caka', label: 'Čaká na materiál' },
  { value: 'hotova', label: 'Dokončená' },
  { value: 'odovzdana', label: 'Fakturovaná' },
  { value: 'stornovana', label: 'Stornovaná' },
]

export const AKTIVNE_STATUSY = ['nova', 'rozpracovana', 'caka', 'hotova']

export function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const dateOnly = date.slice(0, 10)
  const parts = dateOnly.split('-')
  if (parts.length !== 3) return date
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

export function getStatusLabel(stav: string) {
  return STATUSY.find((s) => s.value === stav)?.label || stav
}

export function getStatusBadgeStyle(stav: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    nova: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
    rozpracovana: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    caka: { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' },
    hotova: { background: '#cffafe', color: '#155e75', border: '1px solid #67e8f9' },
    odovzdana: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
    stornovana: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  }
  return map[stav] || {}
}

export function getStatusCardBorder(stav: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    nova: { borderLeft: '6px solid #60a5fa' },
    rozpracovana: { borderLeft: '6px solid #fbbf24' },
    caka: { borderLeft: '6px solid #fb923c' },
    hotova: { borderLeft: '6px solid #22d3ee' },
    odovzdana: { borderLeft: '6px solid #34d399' },
    stornovana: { borderLeft: '6px solid #f87171' },
  }
  return map[stav] || {}
}

export function escapeCsvValue(value: string | number | null | undefined) {
  const safe = String(value ?? '')
  if (safe.includes('"') || safe.includes(';') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function parseHoursInput(value: string) {
  const normalized = value.replace(',', '.').trim()
  const num = Number(normalized)
  if (!Number.isFinite(num)) return NaN
  return num
}

export function formatTimeShort(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function isoToLocalInputValue(isoValue: string | null | undefined) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function calculateHoursFromTimes(startValue: string, endValue: string) {
  if (!startValue || !endValue) return NaN
  const start = new Date(startValue).getTime()
  const end = new Date(endValue).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return NaN
  return (end - start) / 1000 / 60 / 60
}

export function pdfSafeText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function loadImageAsDataUrl(src: string) {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Nepodarilo sa načítať obrázok: ${src}`)
  }
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error(`Nepodarilo sa spracovať obrázok: ${src}`))
    }
    reader.onerror = () => reject(new Error(`Nepodarilo sa načítať obrázok: ${src}`))
    reader.readAsDataURL(blob)
  })
}

export async function loadFirstAvailableImage(paths: string[]) {
  for (const path of paths) {
    try {
      return await loadImageAsDataUrl(path)
    } catch {
      // skus dalsiu moznost
    }
  }
  return null
}
