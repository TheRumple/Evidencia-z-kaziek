'use client'

import type { CSSProperties } from 'react'
import type { Order, WorkLog } from '@/lib/dashboard-types'
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
}

export function OrderCard({
  order,
  expanded,
  isPinned,
  orderLogs,
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
}: OrderCardProps) {
  const overdue = isOverdue(order)

  return (
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
                  <strong>Poznámky k zákazke:</strong> {order.popis || '-'}
                </div>
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
  )
}
