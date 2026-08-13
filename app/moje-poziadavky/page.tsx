'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SAVED_CUSTOMER_ACCESS_KEY = 'itspot_customer_contact_access'

type CustomerLookupItem = {
  item_type: 'poziadavka' | 'zakazka'
  id: string
  nazov: string | null
  popis: string | null
  stav: string | null
  termin: string | null
  created_at: string | null
  customer_name: string | null
  public_message?: string | null
  requester_email?: string | null
  progress_percent?: number | null
}

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const cleanDate = date.slice(0, 10)
  const parts = cleanDate.split('-')
  if (parts.length !== 3) return cleanDate
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function getStatusLabel(item: CustomerLookupItem) {
  if (item.item_type === 'poziadavka') return 'Prijatá požiadavka'

  switch (item.stav) {
    case 'nova':
      return 'Nová zákazka'
    case 'rozpracovana':
      return 'Rozpracovaná'
    case 'cenova_ponuka':
      return 'Pripravujeme cenovú ponuku'
    case 'obhliadka':
      return 'Potrebná obhliadka'
    case 'caka':
    case 'cakame':
      return 'Čaká na materiál'
    case 'hotova':
      return 'Dokončená'
    default:
      return item.stav || 'Zákazka'
  }
}

function getStatusColor(item: CustomerLookupItem) {
  if (item.item_type === 'poziadavka') return { background: '#fef3c7', color: '#92400e', border: '#fcd34d', accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.2)' }
  if (item.stav === 'nova') return { background: '#dbeafe', color: '#1e40af', border: '#93c5fd', accent: '#2563eb', glow: 'rgba(37, 99, 235, 0.2)' }
  if (item.stav === 'rozpracovana') return { background: '#dcfce7', color: '#166534', border: '#86efac', accent: '#16a34a', glow: 'rgba(22, 163, 74, 0.24)' }
  if (item.stav === 'cenova_ponuka') return { background: '#e0f2fe', color: '#075985', border: '#7dd3fc', accent: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.2)' }
  if (item.stav === 'obhliadka') return { background: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', accent: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.24)' }
  if (item.stav === 'caka' || item.stav === 'cakame') return { background: '#ffedd5', color: '#9a3412', border: '#fdba74', accent: '#f97316', glow: 'rgba(249, 115, 22, 0.28)' }
  if (item.stav === 'hotova') return { background: '#cffafe', color: '#155e75', border: '#67e8f9', accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.18)' }
  return { background: '#e2e8f0', color: '#334155', border: '#cbd5e1', accent: '#94a3b8', glow: 'rgba(148, 163, 184, 0.18)' }
}

function getStatusPriority(item: CustomerLookupItem) {
  if (item.stav === 'caka' || item.stav === 'cakame') return 1
  if (item.stav === 'rozpracovana') return 2
  if (item.stav === 'cenova_ponuka') return 3
  if (item.stav === 'obhliadka') return 4
  if (item.stav === 'nova') return 5
  if (item.item_type === 'poziadavka') return 5
  if (item.stav === 'hotova') return 6
  return 7
}

function normalizeProgress(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return 0
  return Math.max(0, Math.min(100, Math.round(Number(value) / 10) * 10))
}

function sortCustomerItems(itemsToSort: CustomerLookupItem[]) {
  return [...itemsToSort].sort((a, b) => {
    const priorityDiff = getStatusPriority(a) - getStatusPriority(b)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  })
}

function getRequesterName(text: string | null, fallback: string | null) {
  if (!text) return fallback || ''
  return text.match(/^Žiadateľ:\s*(.+)$/im)?.[1]?.trim() || text.match(/^Meno:\s*(.+)$/im)?.[1]?.trim() || fallback || ''
}

function getAttachmentUrls(text: string | null | undefined) {
  return Array.from(new Set((text || '').match(/https?:\/\/[^\s)]+/g) || []))
}

function stripAttachmentUrls(text: string | null | undefined) {
  const value = text || ''
  const attachmentBlockIndex = value.toLowerCase().indexOf('prílohy:')
  const textWithoutAttachmentBlock = attachmentBlockIndex >= 0 ? value.slice(0, attachmentBlockIndex) : value

  return textWithoutAttachmentBlock
    .split('\n')
    .filter((line) => !/^[-\s]*https?:\/\//i.test(line.trim()) && !/^[-\s]*$/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getCustomerDescription(text: string | null | undefined) {
  const cleaned = stripAttachmentUrls(text)
  return cleaned
    .split('\n')
    .filter((line) => !/^(Žiadateľ|Email):/i.test(line.trim()))
    .join('\n')
    .trim()
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp)(\?|#|$)/i.test(url) || /customer-request-files\/(ziadosti|doplnene)\//i.test(url)
}

export default function MyRequestsPage() {
  const [customerName, setCustomerName] = useState('')
  const [portalCode, setPortalCode] = useState('')
  const [rememberAccess, setRememberAccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [items, setItems] = useState<CustomerLookupItem[]>([])
  const [updateOrderId, setUpdateOrderId] = useState('')
  const [updateText, setUpdateText] = useState('')
  const [updateFiles, setUpdateFiles] = useState<File[]>([])
  const [sendingUpdate, setSendingUpdate] = useState(false)
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([])
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const galleryOpen = galleryIndex !== null && galleryImages.length > 0
  const activeGalleryIndex = galleryIndex ?? 0
  const activeGalleryImage = galleryImages[activeGalleryIndex] || ''

  useEffect(() => {
    try {
      const savedAccess = window.localStorage.getItem(SAVED_CUSTOMER_ACCESS_KEY)
      if (!savedAccess) return

      const parsed = JSON.parse(savedAccess) as { customerName?: string; email?: string; portalCode?: string }
      const savedName = (parsed.email || parsed.customerName || '').trim()
      const savedCode = (parsed.portalCode || '').replace(/\D/g, '').slice(0, 4)
      if (!savedName || savedCode.length !== 4) return

      setCustomerName(savedName)
      setPortalCode(savedCode)
      setRememberAccess(true)
      void loadCustomerRequests(savedName, savedCode, true)
    } catch {
      window.localStorage.removeItem(SAVED_CUSTOMER_ACCESS_KEY)
    }
  }, [])

  useEffect(() => {
    if (!galleryOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setGalleryIndex(null)
      if (event.key === 'ArrowRight') setGalleryIndex((current) => (current === null ? 0 : (current + 1) % galleryImages.length))
      if (event.key === 'ArrowLeft') setGalleryIndex((current) => (current === null ? 0 : (current - 1 + galleryImages.length) % galleryImages.length))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [galleryImages.length, galleryOpen])

  const allItemImageUrls = useMemo(() => {
    return Array.from(new Set(items.flatMap((item) => getAttachmentUrls(item.popis).filter(isImageUrl))))
  }, [items])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, CustomerLookupItem[]>()
    for (const item of items) {
      const customerNameValue = item.customer_name || 'Nezaradené'
      groups.set(customerNameValue, [...(groups.get(customerNameValue) || []), item])
    }

    return Array.from(groups.entries())
      .map(([customerNameValue, groupItems]) => ({
        customerName: customerNameValue,
        items: sortCustomerItems(groupItems),
      }))
      .sort((a, b) => a.customerName.localeCompare(b.customerName, 'sk'))
  }, [items])

  function toggleItemDetail(itemKey: string) {
    setExpandedItemIds((current) => (current.includes(itemKey) ? [] : [itemKey]))
  }

  function openGallery(url: string) {
    const imageUrls = allItemImageUrls.length > 0 ? allItemImageUrls : [url]
    const index = imageUrls.indexOf(url)
    setGalleryImages(imageUrls)
    setGalleryIndex(index >= 0 ? index : 0)
  }

  function goToPreviousImage() {
    setGalleryIndex((current) => (current === null ? 0 : (current - 1 + galleryImages.length) % galleryImages.length))
  }

  function goToNextImage() {
    setGalleryIndex((current) => (current === null ? 0 : (current + 1) % galleryImages.length))
  }

  function clearSavedAccess() {
    window.localStorage.removeItem(SAVED_CUSTOMER_ACCESS_KEY)
    setRememberAccess(false)
    setMessage('Uložené prístupové údaje boli odstránené z tohto zariadenia.')
    setMessageType('success')
  }

  async function loadCustomerRequests(name: string, code: string, isAutomatic = false) {
    setMessage('')
    setMessageType('error')
    setSearched(false)

    const cleanCustomerName = name.trim()
    const cleanPortalCode = code.replace(/\D/g, '').slice(0, 4)
    if (!cleanCustomerName || !cleanCustomerName.includes('@') || cleanPortalCode.length !== 4) {
      setMessage('Zadajte prihlasovací email a 4-miestny PIN.')
      setMessageType('error')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('lookup_customer_requests', {
      p_customer_name: cleanCustomerName,
      p_portal_code: cleanPortalCode,
    })
    setLoading(false)
    setSearched(true)

    if (error) {
      setMessage('Vyhľadanie zatiaľ nie je aktívne. Je potrebné spustiť SQL skript pre zákaznícky prehľad v Supabase.')
      setMessageType('error')
      setItems([])
      return
    }

    if (rememberAccess || isAutomatic) {
      window.localStorage.setItem(
        SAVED_CUSTOMER_ACCESS_KEY,
        JSON.stringify({ email: cleanCustomerName, portalCode: cleanPortalCode, savedAt: new Date().toISOString() })
      )
    } else {
      window.localStorage.removeItem(SAVED_CUSTOMER_ACCESS_KEY)
    }

    setItems(
      sortCustomerItems(
        ((data || []) as CustomerLookupItem[]).filter(
          (item) => item.item_type === 'poziadavka' || ['nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova'].includes(item.stav || '')
        )
      ).slice(0, 25)
    )
    setExpandedItemIds([])
    setUpdateOrderId('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await loadCustomerRequests(customerName, portalCode)
  }

  async function submitOrderUpdate(orderId: string) {
    const cleanPortalCode = portalCode.replace(/\D/g, '')
    if (!updateText.trim()) {
      setMessage('Napíšte prosím, čo chcete k zákazke doplniť.')
      setMessageType('error')
      return
    }

    if (cleanPortalCode.length !== 4) {
      setMessage('Pre doplnenie informácií je potrebný platný 4-miestny PIN.')
      setMessageType('error')
      return
    }

    if (updateFiles.length > 5) {
      setMessage('Priložiť môžete najviac 5 súborov.')
      setMessageType('error')
      return
    }

    const allowedAttachmentTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    const invalidAttachment = updateFiles.find((file) => !allowedAttachmentTypes.includes(file.type) || file.size > 8 * 1024 * 1024)
    if (invalidAttachment) {
      setMessage('Prílohy môžu byť len obrázky alebo PDF, maximálne 8 MB na súbor.')
      setMessageType('error')
      return
    }

    setSendingUpdate(true)
    setMessage('')
    setMessageType('error')

    try {
      const uploadedAttachmentUrls: string[] = []
      for (const file of updateFiles) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const filePath = `doplnene/${orderId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('customer-request-files')
          .upload(filePath, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('customer-request-files').getPublicUrl(filePath)
        if (data.publicUrl) uploadedAttachmentUrls.push(data.publicUrl)
      }

      const messageWithAttachments = [
        updateText.trim(),
        uploadedAttachmentUrls.length ? '' : '',
        uploadedAttachmentUrls.length ? 'Prílohy:' : '',
        ...uploadedAttachmentUrls.map((url) => `- ${url}`),
      ]
        .filter(Boolean)
        .join('\n')

      const { error } = await supabase.rpc('add_customer_order_update', {
        p_order_id: orderId,
        p_portal_code: cleanPortalCode,
        p_message: messageWithAttachments,
        p_attachment_urls: uploadedAttachmentUrls,
      })

      if (error) throw error

      setUpdateOrderId('')
      setUpdateText('')
      setUpdateFiles([])
      setMessage('Vaša úprava bola odoslaná.')
      setMessageType('success')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Neznáma chyba.'
      setMessage(`Doplnenie sa nepodarilo odoslať. Detail: ${text}`)
      setMessageType('error')
    } finally {
      setSendingUpdate(false)
    }
  }

  const inputStyle = {
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.35)',
    padding: '8px 11px',
    fontSize: 14,
    color: '#f8fafc',
    background: 'rgba(15, 23, 42, 0.72)',
    outlineColor: '#84cc16',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 5,
    fontSize: 12,
    fontWeight: 800,
    color: '#dbeafe',
  }

  return (
    <main
      className="customerPage"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 72% -8%, rgba(132, 204, 22, 0.22), transparent 30%), radial-gradient(circle at 10% 86%, rgba(59, 130, 246, 0.12), transparent 28%), linear-gradient(180deg, #05070a 0%, #0f172a 56%, #05070a 100%)',
        color: '#f8fafc',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '16px 14px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1040, margin: '0 auto', overflowX: 'hidden' }}>
        <style jsx global>{`
          .customerPage,
          .customerPage * {
            box-sizing: border-box;
          }

          .customerHeroInner {
            text-align: center;
          }

          .customerHeroSubtitle {
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          .customerLookupGrid {
            display: grid;
            grid-template-columns: minmax(220px, 1.1fr) minmax(130px, 0.7fr) minmax(170px, 0.8fr);
            gap: 12px;
            align-items: end;
          }

          .customerRequestTop {
            display: grid;
            grid-template-columns: minmax(220px, 1fr) minmax(150px, 0.55fr) minmax(120px, 0.45fr) minmax(160px, 0.65fr) auto;
            gap: 10px;
            align-items: center;
          }

          .customerRequestActions {
            display: flex;
            justify-content: flex-end;
          }

          .customerEditButton {
            border-radius: 10px;
            padding: 7px 12px;
            font-weight: 900;
            cursor: pointer;
            white-space: nowrap;
          }

          .customerRequestTitle {
            margin: 0;
            font-size: 15px;
            font-weight: 900;
            line-height: 1.12;
            overflow-wrap: anywhere;
          }

          .customerRequestMeta {
            margin-top: 4px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            color: #64748b;
            font-size: 11px;
            font-weight: 800;
          }

          .customerStatusBadge {
            justify-self: start;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: 900;
            white-space: nowrap;
          }

          .customerProgressCell {
            min-width: 0;
            display: grid;
            grid-template-columns: minmax(54px, 1fr) 34px;
            gap: 7px;
            align-items: center;
          }

          .customerProgressTrack {
            height: 8px;
            border-radius: 999px;
            background: #e2e8f0;
            overflow: hidden;
            box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12);
          }

          .customerProgressFill {
            display: block;
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, #84cc16, #16a34a);
          }

          .customerProgressValue {
            color: #334155;
            font-size: 11px;
            font-weight: 900;
            text-align: right;
            white-space: nowrap;
          }

          .customerDueCell {
            color: #475569;
            font-size: 11px;
            font-weight: 900;
            display: grid;
            gap: 2px;
          }

          .customerDueCell span {
            white-space: nowrap;
          }

          .customerDetailGrid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(240px, 0.7fr);
            gap: 10px;
            margin-top: 10px;
          }

          .customerDetailBox {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 12px;
            padding: 10px;
          }

          .customerDetailLabel {
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 5px;
          }

          @media (max-width: 760px) {
            .customerPage {
              padding: 10px 10px 8px !important;
            }

            .customerHero {
              padding: 8px 12px 14px !important;
              border-radius: 14px !important;
              margin-bottom: 8px !important;
              box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28) !important;
            }

            .customerHeroInner {
              text-align: center;
            }

            .customerHero img {
              width: min(320px, 100%) !important;
              max-width: 100% !important;
              height: 112px !important;
              margin: -8px auto -10px !important;
            }

            .customerHero h1 {
              font-size: 22px !important;
            }

            .customerHeroSubtitle {
              font-size: 12px !important;
              line-height: 1.22 !important;
              margin-top: 4px !important;
            }

            .customerLookupForm {
              padding: 10px !important;
              border-radius: 14px !important;
              box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24) !important;
              overflow: hidden;
            }

            .customerLookupGrid {
              grid-template-columns: 1fr 112px;
              gap: 8px;
            }

            .customerLookupGrid label {
              margin-bottom: 4px !important;
            }

            .customerLookupGrid input {
              min-height: 38px !important;
              padding: 7px 10px !important;
            }

            .customerLookupGrid button {
              grid-column: 1 / -1;
              min-height: 38px !important;
              padding: 7px 14px !important;
            }

            .customerRequestCard {
              padding: 12px !important;
              border-radius: 12px !important;
            }

            .customerRequestTop {
              grid-template-columns: minmax(0, 1fr) auto;
              gap: 7px;
            }

            .customerStatusBadge,
            .customerProgressCell,
            .customerDueCell {
              grid-column: 1 / -1;
            }

            .customerProgressCell {
              grid-template-columns: minmax(80px, 1fr) 38px;
            }

            .customerRequestActions {
              justify-content: flex-start;
            }

            .customerEditButton {
              padding: 5px 8px !important;
              border-radius: 8px !important;
              font-size: 12px !important;
              background: transparent !important;
              box-shadow: none !important;
            }

            .customerDetailGrid {
              grid-template-columns: 1fr;
              gap: 8px;
            }

            .customerFooter {
              display: grid !important;
              grid-template-columns: 1fr !important;
              justify-content: stretch !important;
              align-items: stretch !important;
              margin-top: 8px !important;
              gap: 8px !important;
            }

            .customerFooter a {
              display: flex !important;
              width: 100% !important;
              justify-content: center !important;
              padding: 7px 10px !important;
            }

            .customerFooter div {
              text-align: center;
              overflow-wrap: anywhere;
            }
          }

          @media (max-width: 460px) {
            .customerLookupGrid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <section
          className="customerHero"
          style={{
            background:
              'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.78)), radial-gradient(circle at 82% 18%, rgba(132, 204, 22, 0.14), transparent 24%)',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: 18,
            padding: '14px clamp(18px, 3vw, 30px) 20px',
            marginBottom: 12,
            boxShadow: '0 22px 48px rgba(0, 0, 0, 0.34)',
          }}
        >
          <div className="customerHeroInner">
            <img
              src="/logo-new.png"
              alt="ITspot"
              style={{
                width: 560,
                maxWidth: '88vw',
                height: 180,
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto -12px',
                filter: 'drop-shadow(0 0 18px rgba(132, 204, 22, 0.24)) drop-shadow(0 12px 28px rgba(0, 0, 0, 0.3))',
              }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: 27, fontWeight: 900, lineHeight: 1.04 }}>Moje požiadavky</h1>
              <div className="customerHeroSubtitle" style={{ marginTop: 5, color: 'rgba(226,232,240,0.74)', fontSize: 14, fontWeight: 800, lineHeight: 1.32 }}>
                Zadajte email a zákaznícky PIN, ktorý ste dostali od ITspot.
              </div>
            </div>
          </div>
        </section>

        <form
          className="customerLookupForm"
          onSubmit={handleSubmit}
          style={{
            background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(2, 6, 23, 0.96))',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 16,
            padding: '14px clamp(14px, 3vw, 22px)',
            boxShadow: '0 18px 42px rgba(0, 0, 0, 0.28)',
          }}
        >
          <div className="customerLookupGrid">
            <div>
              <label style={labelStyle} htmlFor="customer-name">
                Email *
              </label>
              <input
                id="customer-name"
                type="email"
                autoComplete="email"
                style={inputStyle}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="portal-code">
                PIN *
              </label>
              <input
                id="portal-code"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={4}
                style={inputStyle}
                value={portalCode}
                onChange={(event) => setPortalCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                minHeight: 40,
                border: '1px solid #84cc16',
                borderRadius: 11,
                background: 'linear-gradient(135deg, #84cc16, #65a30d)',
                color: '#111827',
                padding: '8px 16px',
                fontWeight: 900,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Hľadám...' : 'Zobraziť'}
            </button>
          </div>

          <div
            className="customerAccessActions"
            style={{
              marginTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              color: '#cbd5e1',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberAccess}
                onChange={(event) => {
                  const checked = event.target.checked
                  setRememberAccess(checked)
                  if (!checked) window.localStorage.removeItem(SAVED_CUSTOMER_ACCESS_KEY)
                }}
                style={{ width: 16, height: 16, accentColor: '#84cc16' }}
              />
              Zapamätať údaje na tomto zariadení
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {rememberAccess && (
                <button
                  type="button"
                  onClick={clearSavedAccess}
                  style={{
                    color: '#cbd5e1',
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'transparent',
                    borderRadius: 10,
                    padding: '7px 10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Zabudnúť údaje
                </button>
              )}
            </div>
          </div>

          {message && (
            <div
              style={{
                marginTop: 10,
                borderRadius: 12,
                padding: 10,
                border: messageType === 'success' ? '1px solid #84cc16' : '1px solid #f87171',
                background: messageType === 'success' ? 'rgba(132, 204, 22, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                color: messageType === 'success' ? '#bef264' : '#fecaca',
                fontWeight: 800,
              }}
            >
              {message}
            </div>
          )}
        </form>

        <section style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {searched && items.length === 0 && !message && (
            <div style={{ border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 16, padding: 18, background: 'rgba(15, 23, 42, 0.82)', color: '#cbd5e1', fontWeight: 800 }}>
              Nenašli sme žiadnu požiadavku pre zadaný názov a prístupový kód.
            </div>
          )}

          {groupedItems.map((group) => (
            <div key={group.customerName} style={{ display: 'grid', gap: 8 }}>
              <div
                style={{
                  border: '1px solid rgba(132, 204, 22, 0.28)',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(20, 83, 45, 0.74))',
                  color: '#f8fafc',
                  borderRadius: 14,
                  padding: '10px 13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900 }}>{group.customerName}</div>
                <div style={{ color: '#bef264', fontSize: 12, fontWeight: 900 }}>
                  {group.items.length} {group.items.length === 1 ? 'položka' : group.items.length < 5 ? 'položky' : 'položiek'}
                </div>
              </div>

              {group.items.map((item) => {
                const statusColor = getStatusColor(item)
                const requesterName = getRequesterName(item.popis, '')
                const itemKey = `${item.item_type}-${item.id}`
                const expanded = expandedItemIds.includes(itemKey)
                const attachmentUrls = getAttachmentUrls(item.popis)
                const imageUrls = attachmentUrls.filter(isImageUrl)
                const cleanDescription = getCustomerDescription(item.popis)
                const canUpdate = item.item_type === 'zakazka' && item.stav !== 'hotova'
                return (
                  <article
                    key={itemKey}
                    className="customerRequestCard"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      const target = event.target as HTMLElement
                      if (target.closest('button, a, input, textarea, select, label, .customerDetailGrid')) return
                      toggleItemDetail(itemKey)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      const target = event.target as HTMLElement
                      if (target.closest('button, a, input, textarea, select, label, .customerDetailGrid')) return
                      event.preventDefault()
                      toggleItemDetail(itemKey)
                    }}
                    style={{
                      border: `2px solid ${statusColor.border}`,
                      borderLeft: `6px solid ${statusColor.accent}`,
                      borderRadius: 12,
                      padding: '9px 11px',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))',
                      color: '#0f172a',
                      boxShadow: `0 8px 18px rgba(0, 0, 0, 0.16), 0 0 0 2px ${statusColor.glow}`,
                      cursor: 'pointer',
                    }}
                  >
                <div className="customerRequestTop">
                  <div>
                    <h2 className="customerRequestTitle">{item.nazov || 'Požiadavka'}</h2>
                    <div className="customerRequestMeta">
                      <span style={{ color: '#166534' }}>Firma: {item.customer_name || group.customerName}</span>
                      <span>Odoslané: {formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  <span
                    className="customerStatusBadge"
                    style={{
                      border: `1px solid ${statusColor.border}`,
                      background: statusColor.background,
                      color: statusColor.color,
                    }}
                  >
                    {getStatusLabel(item)}
                  </span>

                  {item.item_type === 'zakazka' ? (
                    <div className="customerProgressCell" title={`Dokončené na ${normalizeProgress(item.progress_percent)} %`}>
                      <div className="customerProgressTrack">
                        <span className="customerProgressFill" style={{ width: `${normalizeProgress(item.progress_percent)}%` }} />
                      </div>
                      <strong className="customerProgressValue">{normalizeProgress(item.progress_percent)}%</strong>
                    </div>
                  ) : (
                    <div className="customerProgressCell" style={{ color: '#64748b', fontSize: 11, fontWeight: 900 }}>-</div>
                  )}

                  <div className="customerDueCell">
                    {item.termin && <span>Termín: {formatDate(item.termin)}</span>}
                    {requesterName && <span>Žiadateľ: {requesterName}</span>}
                  </div>

                  <div className="customerRequestActions" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {canUpdate && updateOrderId !== item.id && (
                      <button
                        className="customerEditButton"
                        type="button"
                        onClick={() => setUpdateOrderId(item.id)}
                        style={{ border: `1px solid ${statusColor.border}`, background: statusColor.background, color: statusColor.color }}
                      >
                        Doplniť
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="customerDetailGrid">
                    <div className="customerDetailBox">
                      <div className="customerDetailLabel">Vaša požiadavka</div>
                      <div style={{ color: '#0f172a', fontSize: 13, lineHeight: 1.42, whiteSpace: 'pre-wrap', fontWeight: 700 }}>
                        {cleanDescription || 'Bez popisu.'}
                      </div>
                    </div>

                    <div className="customerDetailBox">
                      <div className="customerDetailLabel">Prílohy</div>
                      {attachmentUrls.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>Bez príloh.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {imageUrls.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {imageUrls.map((url) => (
                                <button
                                  key={`customer-image-${itemKey}-${url}`}
                                  type="button"
                                  onClick={() => openGallery(url)}
                                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                                  aria-label="Otvoriť fotku v galérii"
                                >
                                  <img
                                    src={url}
                                    alt="Príloha"
                                    style={{ width: 82, height: 62, objectFit: 'cover', borderRadius: 9, border: '1px solid #cbd5e1', display: 'block' }}
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {attachmentUrls.map((url, index) => (
                              <a key={`customer-file-${itemKey}-${url}`} href={url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontSize: 13, fontWeight: 900 }}>
                                Príloha {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {item.public_message && (
                      <div className="customerDetailBox" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                        <div className="customerDetailLabel" style={{ color: '#166534' }}>Aktuálny stav od ITspot</div>
                        <div style={{ color: '#166534', fontSize: 13, lineHeight: 1.42, whiteSpace: 'pre-wrap', fontWeight: 800 }}>
                          {item.public_message}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canUpdate && (
                  <div style={{ marginTop: 8 }}>
                    {updateOrderId === item.id ? (
                      <div style={{ display: 'grid', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                        <textarea
                          rows={4}
                          style={{ width: '100%', borderRadius: 10, border: '1px solid #cbd5e1', padding: 9, fontSize: 14, color: '#0f172a', fontFamily: 'inherit', resize: 'vertical' }}
                          placeholder="Napíšte úpravu alebo doplnenie, napr. rozmery, čas dostupnosti alebo upresnenie poruchy."
                          value={updateText}
                          onChange={(event) => setUpdateText(event.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label
                            htmlFor={`update-files-${item.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#0f172a',
                              borderRadius: 10,
                              padding: '7px 10px',
                              fontWeight: 900,
                              cursor: 'pointer',
                            }}
                          >
                            Pridať fotku alebo súbor
                          </label>
                          <input
                            id={`update-files-${item.id}`}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(event) => setUpdateFiles(Array.from(event.target.files || []).slice(0, 5))}
                            style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}
                          />
                          <span style={{ color: '#64748b', fontSize: 13, fontWeight: 800 }}>
                            {updateFiles.length > 0 ? `${updateFiles.length} súborov vybraných` : 'Bez prílohy'}
                          </span>
                        </div>
                        {updateFiles.length > 0 && (
                          <div style={{ display: 'grid', gap: 4, color: '#475569', fontSize: 12, fontWeight: 800 }}>
                            {updateFiles.map((file) => (
                              <div key={`${file.name}-${file.size}`}>• {file.name}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            disabled={sendingUpdate}
                            onClick={() => void submitOrderUpdate(item.id)}
                            style={{ border: '1px solid #84cc16', background: '#84cc16', color: '#111827', borderRadius: 10, padding: '7px 10px', fontWeight: 900, cursor: sendingUpdate ? 'not-allowed' : 'pointer' }}
                          >
                            {sendingUpdate ? 'Odosielam...' : 'Odoslať úpravu'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUpdateOrderId('')
                              setUpdateText('')
                              setUpdateFiles([])
                            }}
                            style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 10, padding: '7px 10px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Zrušiť
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                  </article>
                )
              })}
            </div>
          ))}
        </section>

        <div className="customerFooter" style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: '#94a3b8', fontSize: 13 }}>
          <Link href="https://www.itspot.sk/" style={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px', textDecoration: 'none', fontWeight: 800 }}>
            Späť na itspot.sk
          </Link>

          <Link href="/ziadost" style={{ color: '#111827', border: '1px solid #84cc16', background: '#84cc16', boxShadow: '0 10px 24px rgba(132, 204, 22, 0.22)', borderRadius: 12, padding: '9px 14px', textDecoration: 'none', fontWeight: 900 }}>
            Nová požiadavka
          </Link>

          <div>Technická podpora: info@itspot.sk, +421 908 806 691</div>
        </div>
      </div>

      {galleryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Galéria príloh"
          onClick={() => setGalleryIndex(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            background: 'rgba(2, 6, 23, 0.9)',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            gap: 12,
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: '#fff' }}>
            <div style={{ fontWeight: 900 }}>
              Fotka {activeGalleryIndex + 1} / {galleryImages.length}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setGalleryIndex(null)
              }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 24,
                lineHeight: 1,
                cursor: 'pointer',
              }}
              aria-label="Zavrieť galériu"
            >
              ×
            </button>
          </div>

          <div onClick={(event) => event.stopPropagation()} style={{ position: 'relative', minHeight: 0, display: 'grid', placeItems: 'center' }}>
            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={goToPreviousImage}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 42,
                  height: 54,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(15,23,42,0.68)',
                  color: '#fff',
                  fontSize: 30,
                  cursor: 'pointer',
                }}
                aria-label="Predošlá fotka"
              >
                ‹
              </button>
            )}

            <img
              src={activeGalleryImage}
              alt="Príloha"
              style={{
                maxWidth: 'calc(100vw - 92px)',
                maxHeight: 'calc(100vh - 150px)',
                objectFit: 'contain',
                borderRadius: 14,
                boxShadow: '0 24px 80px rgba(0,0,0,0.48)',
                background: '#fff',
              }}
            />

            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={goToNextImage}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 42,
                  height: 54,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(15,23,42,0.68)',
                  color: '#fff',
                  fontSize: 30,
                  cursor: 'pointer',
                }}
                aria-label="Ďalšia fotka"
              >
                ›
              </button>
            )}
          </div>

          <div onClick={(event) => event.stopPropagation()} style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {galleryImages.map((url, index) => (
              <button
                key={`customer-gallery-thumb-${url}`}
                type="button"
                onClick={() => setGalleryIndex(index)}
                style={{
                  border: index === activeGalleryIndex ? '2px solid #84cc16' : '2px solid rgba(255,255,255,0.22)',
                  background: 'transparent',
                  padding: 0,
                  borderRadius: 10,
                  cursor: 'pointer',
                  opacity: index === activeGalleryIndex ? 1 : 0.66,
                }}
                aria-label={`Zobraziť fotku ${index + 1}`}
              >
                <img src={url} alt="" style={{ width: 54, height: 40, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
