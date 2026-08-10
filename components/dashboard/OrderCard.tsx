'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CustomerUpdate, Order, WorkLog } from '@/lib/dashboard-types'
import {
  STATUSY,
  formatDate,
  formatTimeShort,
  getStatusBadgeStyle,
  getStatusCardBorder,
  getStatusLabel,
} from '@/lib/dashboard-utils'

type OrderCardProps = {
  order: Order
  expanded: boolean
  isPinned: boolean
  orderLogs: WorkLog[]
  customerUpdates: CustomerUpdate[]
  unseenCustomerUpdatesCount: number
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  dangerButtonStyle: CSSProperties
  greenButtonStyle: CSSProperties
  inputStyle: CSSProperties
  labelStyle: CSSProperties
  deleteOrder: (orderId: string) => void
  exportOrderWorkLogs: (orderId: string) => void
  getCustomerName: (customerId: string) => string
  getOrderKilometres: (orderId: string) => number
  isOverdue: (order: Order) => boolean
  openWorkLogModal: (orderId: string) => void
  startEditOrder: (order: Order) => void
  toggleExpandedOrder: (orderId: string) => void
  togglePinnedOrder: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: string) => void
  deleteCustomerUpdate: (updateId: string) => void
}

function getTextAttachmentUrls(text: string | null | undefined) {
  return Array.from(new Set((text || '').match(/https?:\/\/[^\s)]+/g) || []))
}

function getAttachmentUrls(update: CustomerUpdate) {
  const fromColumn = Array.isArray(update.attachment_urls) ? update.attachment_urls : []
  const fromMessage = getTextAttachmentUrls(update.message)
  return Array.from(new Set([...fromColumn, ...fromMessage]))
}

function stripAttachmentUrls(text: string) {
  const attachmentBlockIndex = text.toLowerCase().indexOf('prílohy:')
  const textWithoutAttachmentBlock = attachmentBlockIndex >= 0 ? text.slice(0, attachmentBlockIndex) : text

  return textWithoutAttachmentBlock
    .split('\n')
    .filter((line) => !/^[-\s]*https?:\/\//i.test(line.trim()) && !/^[-\s]*$/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp)(\?|#|$)/i.test(url) || /customer-request-files\/(ziadosti|doplnene)\//i.test(url)
}

export function OrderCard({
  order,
  expanded,
  isPinned,
  orderLogs,
  customerUpdates,
  unseenCustomerUpdatesCount,
  boxStyle,
  buttonStyle,
  dangerButtonStyle,
  greenButtonStyle,
  inputStyle,
  labelStyle,
  deleteOrder,
  exportOrderWorkLogs,
  getCustomerName,
  getOrderKilometres,
  isOverdue,
  openWorkLogModal,
  startEditOrder,
  toggleExpandedOrder,
  togglePinnedOrder,
  updateOrderStatus,
  deleteCustomerUpdate,
}: OrderCardProps) {
  const overdue = isOverdue(order)
  const orderAttachmentUrls = getTextAttachmentUrls(order.popis)
  const orderImageUrls = orderAttachmentUrls.filter(isImageUrl)
  const cleanOrderDescription = stripAttachmentUrls(order.popis || '')
  const allGalleryImages = useMemo(() => {
    const updateImages = customerUpdates.flatMap((update) => getAttachmentUrls(update).filter(isImageUrl))
    return Array.from(new Set([...orderImageUrls, ...updateImages]))
  }, [customerUpdates, orderImageUrls])
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const galleryOpen = galleryIndex !== null && allGalleryImages.length > 0
  const activeGalleryIndex = galleryIndex ?? 0
  const activeGalleryImage = allGalleryImages[activeGalleryIndex] || ''

  useEffect(() => {
    if (!galleryOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setGalleryIndex(null)
      }
      if (event.key === 'ArrowRight') {
        setGalleryIndex((current) => (current === null ? 0 : (current + 1) % allGalleryImages.length))
      }
      if (event.key === 'ArrowLeft') {
        setGalleryIndex((current) => (current === null ? 0 : (current - 1 + allGalleryImages.length) % allGalleryImages.length))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [allGalleryImages.length, galleryOpen])

  function openGallery(url: string) {
    const index = allGalleryImages.indexOf(url)
    setGalleryIndex(index >= 0 ? index : 0)
  }

  function goToPreviousImage() {
    setGalleryIndex((current) => (current === null ? 0 : (current - 1 + allGalleryImages.length) % allGalleryImages.length))
  }

  function goToNextImage() {
    setGalleryIndex((current) => (current === null ? 0 : (current + 1) % allGalleryImages.length))
  }

  return (
    <>
      <div
        className={`orderCard ${expanded ? 'orderCardExpanded' : ''} ${overdue ? 'orderCardOverdue' : ''}`}
        style={{
          borderRadius: 14,
          border: overdue ? '1px solid #fecdd3' : '1px solid #e2e8f0',
          background: overdue
            ? 'linear-gradient(135deg, #fff7f7 0%, #ffffff 76%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          overflow: 'hidden',
          boxShadow: expanded ? '0 18px 34px rgba(15, 23, 42, 0.12)' : '0 7px 18px rgba(15, 23, 42, 0.06)',
          ...getStatusCardBorder(order.stav),
        }}
      >
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggleExpandedOrder(order.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleExpandedOrder(order.id)
          }
        }}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-expanded={expanded}
      >
        <div className="orderRowSummary">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                togglePinnedOrder(order.id)
              }}
              aria-label={isPinned ? 'Odopnúť zákazku' : 'Pripnúť zákazku'}
              title={isPinned ? 'Odopnúť zákazku' : 'Pripnúť zákazku'}
              style={{
                border: '1px solid #cbd5e1',
                background: isPinned ? '#84cc16' : '#fff',
                color: isPinned ? '#111827' : '#64748b',
                width: 34,
                height: 34,
                minWidth: 34,
                borderRadius: 11,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 800,
                boxShadow: isPinned ? '0 8px 18px rgba(132, 204, 22, 0.26)' : 'none',
              }}
            >
              {isPinned ? '★' : '☆'}
            </button>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="orderCardTitle">{order.nazov}</div>
                {overdue && (
                  <span
                    style={{
                      background: '#fff1f2',
                      color: '#be123c',
                      border: '1px solid #fecdd3',
                      borderRadius: 999,
                      padding: '2px 7px',
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    Po termíne
                  </span>
                )}
                {isPinned && (
                  <span
                    style={{
                      background: '#fff7ed',
                      color: '#c2410c',
                      border: '1px solid #fdba74',
                      borderRadius: 999,
                      padding: '2px 7px',
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    Pripnuté
                  </span>
                )}
                {unseenCustomerUpdatesCount > 0 && (
                  <span
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: '1px solid #fca5a5',
                      borderRadius: 999,
                      padding: '2px 7px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  >
                    Nová úprava {unseenCustomerUpdatesCount}
                  </span>
                )}
              </div>
              <div className="orderCardCustomer">{getCustomerName(order.customer_id)}</div>
            </div>
          </div>

          <div className="orderRowMeta">
            <div className="orderMetaChip" style={getStatusBadgeStyle(order.stav)}>
              <span className="orderMetaLabel" style={{ color: 'inherit', opacity: 0.82 }}>
                Stav
              </span>
              <strong>{getStatusLabel(order.stav)}</strong>
            </div>

            <div className="orderMetaChip">
              <span className="orderMetaLabel">Termín</span>
              <strong style={{ color: overdue ? '#be123c' : '#0f172a' }}>{formatDate(order.termin)}</strong>
            </div>

            <div
              className="orderExpandIcon"
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                border: '1px solid #cbd5e1',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: '#475569',
                background: '#fff',
              }}
            >
              {expanded ? '−' : '+'}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: 10,
            borderTop: '1px solid #e2e8f0',
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          <div className="orderDetailGrid">
            <div style={{ ...boxStyle, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>Základné informácie</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div>
                  <strong>Zákazník:</strong> {getCustomerName(order.customer_id)}
                </div>
                <div>
                  <strong>Prijatie:</strong> {formatDate(order.prijatie_zakazky)}
                </div>
                <div>
                  <strong>Termín:</strong> {formatDate(order.termin)}
                </div>
                <div>
                  <strong>Výkazy:</strong> {orderLogs.length}
                </div>
                <div>
                  <strong>Kilometre spolu:</strong> {getOrderKilometres(order.id).toFixed(0)} km
                </div>
                <div>
                  <strong>Poznámky k zákazke:</strong>
                  {cleanOrderDescription ? (
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{cleanOrderDescription}</div>
                  ) : (
                    <span> -</span>
                  )}
                </div>
                {orderAttachmentUrls.length > 0 && (
                  <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 10, padding: 10 }}>
                    <strong>Prílohy od zákazníka:</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {orderAttachmentUrls.map((url, index) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 900, fontSize: 13 }}>
                            Príloha {index + 1}
                          </a>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {orderImageUrls.map((url) => (
                          <button
                            key={`order-preview-${url}`}
                            type="button"
                            onClick={() => openGallery(url)}
                            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            aria-label="Otvoriť prílohu v galérii"
                          >
                            <img
                              src={url}
                              alt="Príloha od zákazníka"
                              style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 8, border: '1px solid #bfdbfe', display: 'block' }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {order.public_message && (
                  <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 10, padding: 10 }}>
                    <strong>Správa pre zákazníka:</strong>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#166534' }}>{order.public_message}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...boxStyle, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>Výkazy a poznámky</div>
              {orderLogs.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {orderLogs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: 10,
                        background: '#fff',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13 }}>
                        {formatDate(log.datum)} · {log.nazov_vykazu || 'Bez názvu'} · {Number(log.hodiny || 0).toFixed(1)} h ·{' '}
                        {Number(log.kilometre || 0).toFixed(0)} km
                      </div>
                      <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                        {formatTimeShort(log.start_time)} – {formatTimeShort(log.end_time)}
                      </div>
                      <div style={{ marginTop: 4, color: '#334155', fontSize: 13, whiteSpace: 'pre-wrap' }}>{log.praca_popis}</div>
                    </div>
                  ))}
                  {orderLogs.length > 3 && <div style={{ color: '#64748b', fontSize: 12 }}>Ďalšie záznamy nájdeš po kliknutí na Výkaz / poznámka.</div>}
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>Zatiaľ bez výkazu alebo poznámky.</div>
              )}
            </div>
          </div>

          {customerUpdates.length > 0 && (
            <div style={{ ...boxStyle, padding: 12, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Doplnené od zákazníka</div>
                {unseenCustomerUpdatesCount > 0 && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 900 }}>
                    Nové
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {customerUpdates.map((update) => {
                  const attachmentUrls = getAttachmentUrls(update)
                  const cleanMessage = stripAttachmentUrls(update.message)
                  return (
                    <div key={update.id} style={{ border: '1px solid #dbeafe', borderRadius: 10, padding: 10, background: '#eff6ff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>{formatDate(update.created_at || null)}</div>
                        <button
                          type="button"
                          onClick={() => deleteCustomerUpdate(update.id)}
                          style={{
                            border: '1px solid #fecaca',
                            background: '#fff1f2',
                            color: '#be123c',
                            borderRadius: 8,
                            padding: '4px 8px',
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          Zmazať
                        </button>
                      </div>
                      {cleanMessage && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#0f172a' }}>{cleanMessage}</div>}
                      {attachmentUrls.length > 0 && (
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {attachmentUrls.map((url, index) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 800, fontSize: 13 }}>
                                Príloha {index + 1}
                              </a>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {attachmentUrls.filter(isImageUrl).map((url) => (
                              <button
                                key={`preview-${url}`}
                                type="button"
                                onClick={() => openGallery(url)}
                                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                                aria-label="Otvoriť prílohu v galérii"
                              >
                                <img
                                  src={url}
                                  alt="Príloha od zákazníka"
                                  style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 8, border: '1px solid #bfdbfe', display: 'block' }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor={`status-${order.id}`}>
              Stav zákazky
            </label>
            <select
              id={`status-${order.id}`}
              value={order.stav}
              onChange={(event) => updateOrderStatus(order.id, event.target.value)}
              style={{
                ...inputStyle,
                ...getStatusBadgeStyle(order.stav),
                fontWeight: 800,
              }}
            >
              {STATUSY.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" style={greenButtonStyle} onClick={() => openWorkLogModal(order.id)}>
              Výkaz / poznámka
            </button>
            <button type="button" style={buttonStyle} onClick={() => startEditOrder(order)}>
              Upraviť
            </button>
            <button type="button" style={buttonStyle} onClick={() => exportOrderWorkLogs(order.id)}>
              Export PDF
            </button>
            <button type="button" style={dangerButtonStyle} onClick={() => deleteOrder(order.id)}>
              Zmazať
            </button>
          </div>
        </div>
      )}
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
            background: 'rgba(2, 6, 23, 0.88)',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            gap: 12,
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: '#fff' }}>
            <div style={{ fontWeight: 900 }}>
              Príloha {activeGalleryIndex + 1} / {allGalleryImages.length}
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

          <div
            onClick={(event) => event.stopPropagation()}
            style={{ position: 'relative', minHeight: 0, display: 'grid', placeItems: 'center' }}
          >
            {allGalleryImages.length > 1 && (
              <button
                type="button"
                onClick={goToPreviousImage}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 54,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(15,23,42,0.68)',
                  color: '#fff',
                  fontSize: 30,
                  cursor: 'pointer',
                }}
                aria-label="Predošlá príloha"
              >
                ‹
              </button>
            )}

            <img
              src={activeGalleryImage}
              alt="Príloha od zákazníka"
              style={{
                maxWidth: 'calc(100vw - 100px)',
                maxHeight: 'calc(100vh - 150px)',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 14,
                boxShadow: '0 24px 80px rgba(0,0,0,0.48)',
                background: '#fff',
              }}
            />

            {allGalleryImages.length > 1 && (
              <button
                type="button"
                onClick={goToNextImage}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 54,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(15,23,42,0.68)',
                  color: '#fff',
                  fontSize: 30,
                  cursor: 'pointer',
                }}
                aria-label="Ďalšia príloha"
              >
                ›
              </button>
            )}
          </div>

          <div
            onClick={(event) => event.stopPropagation()}
            style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            {allGalleryImages.map((url, index) => (
              <button
                key={`gallery-thumb-${url}`}
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
                aria-label={`Zobraziť prílohu ${index + 1}`}
              >
                <img
                  src={url}
                  alt=""
                  style={{ width: 54, height: 40, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
