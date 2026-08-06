'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
    case 'obhliadka':
      return 'Potrebná obhliadka'
    case 'caka':
    case 'cakame':
      return 'Čaká na materiál'
    default:
      return item.stav || 'Zákazka'
  }
}

function getStatusColor(item: CustomerLookupItem) {
  if (item.item_type === 'poziadavka') return { background: '#fef3c7', color: '#92400e', border: '#fcd34d', accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.2)' }
  if (item.stav === 'nova') return { background: '#dbeafe', color: '#1e40af', border: '#93c5fd', accent: '#2563eb', glow: 'rgba(37, 99, 235, 0.2)' }
  if (item.stav === 'rozpracovana') return { background: '#dcfce7', color: '#166534', border: '#86efac', accent: '#16a34a', glow: 'rgba(22, 163, 74, 0.24)' }
  if (item.stav === 'obhliadka') return { background: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', accent: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.24)' }
  if (item.stav === 'caka' || item.stav === 'cakame') return { background: '#ffedd5', color: '#9a3412', border: '#fdba74', accent: '#f97316', glow: 'rgba(249, 115, 22, 0.28)' }
  return { background: '#e2e8f0', color: '#334155', border: '#cbd5e1', accent: '#94a3b8', glow: 'rgba(148, 163, 184, 0.18)' }
}

function getStatusPriority(item: CustomerLookupItem) {
  if (item.stav === 'caka' || item.stav === 'cakame') return 1
  if (item.stav === 'rozpracovana') return 2
  if (item.stav === 'obhliadka') return 3
  if (item.stav === 'nova') return 4
  if (item.item_type === 'poziadavka') return 5
  return 6
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

export default function MyRequestsPage() {
  const [customerName, setCustomerName] = useState('')
  const [portalCode, setPortalCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [items, setItems] = useState<CustomerLookupItem[]>([])
  const [updateOrderId, setUpdateOrderId] = useState('')
  const [updateText, setUpdateText] = useState('')
  const [updateFiles, setUpdateFiles] = useState<File[]>([])
  const [sendingUpdate, setSendingUpdate] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setMessageType('error')
    setSearched(false)

    const cleanPortalCode = portalCode.replace(/\D/g, '')
    if (!customerName.trim() || cleanPortalCode.length !== 4) {
      setMessage('Zadajte názov firmy alebo meno a 4-miestny PIN zákazníka.')
      setMessageType('error')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('lookup_customer_requests', {
      p_customer_name: customerName.trim(),
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

    setItems(
      sortCustomerItems(
        ((data || []) as CustomerLookupItem[]).filter(
          (item) => item.item_type === 'poziadavka' || ['nova', 'rozpracovana', 'obhliadka', 'caka', 'cakame'].includes(item.stav || '')
        )
      ).slice(0, 25)
    )
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
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 72% -8%, rgba(132, 204, 22, 0.22), transparent 30%), radial-gradient(circle at 10% 86%, rgba(59, 130, 246, 0.12), transparent 28%), linear-gradient(180deg, #05070a 0%, #0f172a 56%, #05070a 100%)',
        color: '#f8fafc',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '16px 14px',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <style jsx global>{`
          .customerHeroInner {
            display: grid;
            grid-template-columns: 300px minmax(0, 1fr);
            gap: 18px;
            align-items: center;
          }

          .customerLookupGrid {
            display: grid;
            grid-template-columns: minmax(220px, 1.1fr) minmax(130px, 0.7fr) minmax(170px, 0.8fr);
            gap: 12px;
            align-items: end;
          }

          .customerRequestTop {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
            align-items: start;
          }

          .customerRequestActions {
            display: flex;
            justify-content: flex-end;
          }

          @media (max-width: 760px) {
            .customerHero {
              padding: 14px !important;
              border-radius: 14px !important;
            }

            .customerHeroInner {
              grid-template-columns: 1fr;
              gap: 6px;
              text-align: center;
            }

            .customerHero img {
              width: 220px !important;
              height: 72px !important;
              margin: 0 auto !important;
            }

            .customerHero h1 {
              font-size: 23px !important;
            }

            .customerHero > div {
              font-size: 12px !important;
            }

            .customerLookupForm {
              padding: 12px !important;
              border-radius: 14px !important;
            }

            .customerLookupGrid {
              grid-template-columns: 1fr 112px;
              gap: 9px;
            }

            .customerLookupGrid button {
              grid-column: 1 / -1;
            }

            .customerRequestCard {
              padding: 12px !important;
              border-radius: 12px !important;
            }

            .customerRequestTop {
              grid-template-columns: 1fr;
              gap: 7px;
            }

            .customerRequestActions {
              justify-content: flex-start;
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
            padding: '18px clamp(18px, 3vw, 30px)',
            marginBottom: 12,
            boxShadow: '0 22px 48px rgba(0, 0, 0, 0.34)',
          }}
        >
          <div className="customerHeroInner">
            <img
              src="/logo-new.png"
              alt="ITspot"
              style={{ width: 285, maxWidth: '72vw', height: 92, objectFit: 'contain', display: 'block' }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.08 }}>Moje požiadavky</h1>
              <div style={{ marginTop: 7, color: 'rgba(226,232,240,0.74)', fontSize: 14, fontWeight: 800, lineHeight: 1.4 }}>
                Zadajte názov firmy alebo meno a zákaznícky PIN. Právnu formu ako s.r.o. písať nemusíte.
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
                Firma alebo meno *
              </label>
              <input
                id="customer-name"
                style={inputStyle}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Napr. názov firmy bez s.r.o. alebo meno"
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="portal-code">
                PIN *
              </label>
              <input
                id="portal-code"
                inputMode="numeric"
                maxLength={4}
                style={inputStyle}
                value={portalCode}
                onChange={(event) => setPortalCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
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

          {items.map((item) => {
            const statusColor = getStatusColor(item)
            const requesterName = getRequesterName(item.popis, '')
            return (
              <article
                key={`${item.item_type}-${item.id}`}
                className="customerRequestCard"
                style={{
                  border: `2px solid ${statusColor.border}`,
                  borderLeft: `7px solid ${statusColor.accent}`,
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))',
                  color: '#0f172a',
                  boxShadow: `0 12px 24px rgba(0, 0, 0, 0.2), 0 0 0 3px ${statusColor.glow}`,
                }}
              >
                <div className="customerRequestTop">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.16 }}>{item.nazov || 'Požiadavka'}</h2>
                      <span
                        style={{
                          border: `1px solid ${statusColor.border}`,
                          background: statusColor.background,
                          color: statusColor.color,
                          borderRadius: 999,
                          padding: '5px 10px',
                          fontSize: 11,
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {getStatusLabel(item)}
                      </span>
                    </div>

                    <div style={{ marginTop: 7, display: 'flex', gap: 10, flexWrap: 'wrap', color: '#64748b', fontSize: 12, fontWeight: 800 }}>
                      <span>Odoslané: {formatDate(item.created_at)}</span>
                      {item.termin && <span>Termín: {formatDate(item.termin)}</span>}
                      {requesterName && <span>Žiadateľ: {requesterName}</span>}
                    </div>
                  </div>

                  {item.item_type === 'zakazka' && updateOrderId !== item.id && (
                    <div className="customerRequestActions">
                      <button
                        type="button"
                        onClick={() => setUpdateOrderId(item.id)}
                        style={{ border: `1px solid ${statusColor.border}`, background: statusColor.background, color: statusColor.color, borderRadius: 10, padding: '7px 12px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Upraviť
                      </button>
                    </div>
                  )}
                </div>

                {item.public_message && (
                  <div style={{ marginTop: 9, borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', padding: 9, fontSize: 13, lineHeight: 1.35, whiteSpace: 'pre-wrap', fontWeight: 800 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Správa od ITspot</div>
                    {item.public_message}
                  </div>
                )}

                {item.item_type === 'zakazka' && (
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
        </section>

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#94a3b8', fontSize: 12 }}>
          <Link href="/ziadost" style={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px', textDecoration: 'none', fontWeight: 800 }}>
            Nová požiadavka
          </Link>
          <div>Technická podpora: info@itspot.sk, +421 908 806 691</div>
        </div>
      </div>
    </main>
  )
}
