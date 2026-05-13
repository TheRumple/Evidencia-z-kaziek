'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: string
  nazov: string
  kontakt: string | null
  telefon: string | null
  email: string | null
}

type Order = {
  id: string
  nazov: string
  customer_id: string
  stav: string
  praca: string | null
  popis: string | null
  termin: string | null
  prijatie_zakazky: string | null
  created_at?: string
}


type OrderSubtask = {
  id: string
  order_id: string
  nazov: string
  completed: boolean
}

const STATUSY = [
  { value: 'nova', label: 'Nová' },
  { value: 'rozpracovana', label: 'Rozpracovaná' },
  { value: 'caka', label: 'Čaká na materiál' },
  { value: 'hotova', label: 'Dokončená' },
  { value: 'odovzdana', label: 'Fakturovaná' },
  { value: 'stornovana', label: 'Stornovaná' },
]

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  const dateOnly = date.slice(0, 10)
  const parts = dateOnly.split('-')
  if (parts.length !== 3) return date
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function getStatusLabel(stav: string) {
  return STATUSY.find((s) => s.value === stav)?.label || stav
}

function compareDates(a: string | null | undefined, b: string | null | undefined, ascending = true) {
  if (!a) return ascending ? 1 : -1
  if (!b) return ascending ? -1 : 1
  return ascending 
    ? new Date(a).getTime() - new Date(b).getTime()
    : new Date(b).getTime() - new Date(a).getTime()
}

function getStatusBadgeStyle(stav: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    nova: { background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' },
    rozpracovana: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    caka: { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' },
    hotova: { background: '#ccfbf1', color: '#115e59', border: '1px solid #99f6e4' },
    odovzdana: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
    stornovana: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  }
  return map[stav] || {}
}

function getStatusCardBorder(stav: string, isPriority: boolean): CSSProperties {
  if (isPriority) {
    return { borderLeft: '7px solid #eab308', boxShadow: '0 0 0 1px #fef08a' }
  }
  const map: Record<string, CSSProperties> = {
    nova: { borderLeft: '7px solid #818cf8' },
    rozpracovana: { borderLeft: '7px solid #fbbf24' },
    caka: { borderLeft: '7px solid #fb923c' },
    hotova: { borderLeft: '7px solid #2dd4bf' },
    odovzdana: { borderLeft: '7px solid #34d399' },
    stornovana: { borderLeft: '7px solid #f87171' },
  }
  return map[stav] || {}
}

export default function CustomerPortalPage() {
  const searchParams = useSearchParams()
  const customerIdParam = searchParams.get('customer_id')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [subtasks, setSubtasks] = useState<OrderSubtask[]>([])
  
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([])
  const [priorityOrderIds, setPriorityOrderIds] = useState<string[]>([])
  const [priorityError, setPriorityError] = useState(false)

  // Stavy pre formulár
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [formNazov, setFormNazov] = useState('')
  const [formPopis, setFormPopis] = useState('')
  const [formTermin, setFormTermin] = useState('')
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)

  const [sortBy, setSortBy] = useState<'najnovsie' | 'abeceda' | 'termin'>('najnovsie')

  // Stavy pre hover efekty
  const [isBtnHovered, setIsBtnHovered] = useState(false)
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (!customerIdParam) {
      setLoading(false)
      setErrorMsg('Chýba identifikačný kľúč zákazníka.')
      return
    }
    void loadCustomerData(customerIdParam)
  }, [customerIdParam])

  async function loadCustomerData(targetCustomerId: string) {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data: customerData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', targetCustomerId)
        .single()

      if (custError || !customerData) {
        setErrorMsg(`Nepodarilo sa overiť profil zákazníka.`)
        return
      }
      setCustomer(customerData as Customer)

      const { data: ordersData, error: ordError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', targetCustomerId)
        .neq('stav', 'odovzdana')

      if (ordError) {
        setErrorMsg(`Chyba pri načítaní zákaziek.`)
        return
      }
      setOrders((ordersData || []) as Order[])

      const orderIds = (ordersData || []).map((o) => o.id)

      if (orderIds.length > 0) {
        const { data: subtasksData } = await supabase
          .from('order_subtasks')
          .select('*')
          .in('order_id', orderIds)

        setSubtasks((subtasksData || []) as OrderSubtask[])
      }

    } catch (e: any) {
      setErrorMsg(`Chyba autorizácie: Spojenie so serverom bolo prerušené.`)
    } finally {
      setLoading(false)
    }
  }

  function toggleExpandOrder(orderId: string) {
    setExpandedOrderIds((curr) =>
      curr.includes(orderId) ? curr.filter((id) => id !== orderId) : [...curr, orderId]
    )
  }

  function togglePriority(orderId: string, e: React.MouseEvent) {
    e.stopPropagation() 
    setPriorityError(false)

    setPriorityOrderIds((curr) => {
      if (curr.includes(orderId)) {
        return curr.filter((id) => id !== orderId)
      }
      if (curr.length >= 3) {
        setPriorityError(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return curr
      }
      return [...curr, orderId]
    })
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer || !formNazov.trim() || !formPopis.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('customer_requests')
        .insert([
          {
            customer_id: customer.id,
            nazov: formNazov.trim(),
            popis: formPopis.trim(),
            termin: formTermin ? formTermin : null,
            stav: 'na_schvalenie'
          }
        ])

      if (error) {
        alert(`Nepodarilo sa odoslať požiadavku: ${error.message}`)
        return
      }

      setIsPopupOpen(false)
      setFormNazov('')
      setFormPopis('')
      setFormTermin('')
      
      setShowSuccessNotification(true)
      setTimeout(() => setShowSuccessNotification(false), 8000)

    } catch (err: any) {
      alert(`Chyba spojenia: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const sortedOrders = [...orders].sort((a, b) => {
    const aPriority = priorityOrderIds.includes(a.id)
    const bPriority = priorityOrderIds.includes(b.id)

    if (aPriority && !bPriority) return -1
    if (!aPriority && bPriority) return 1

    if (sortBy === 'abeceda') return a.nazov.localeCompare(b.nazov, 'sk')
    if (sortBy === 'termin') return compareDates(a.termin, b.termin, true)
    return compareDates(a.prijatie_zakazky || a.created_at, b.prijatie_zakazky || b.created_at, false)
  })

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: '#0f172a', letterSpacing: '-0.02em' }}>ITspot s.r.o.</div>
        <div style={{ fontSize: 16, color: '#64748b' }}>Zabezpečujem šifrované pripojenie a načítavam zákaznícku zónu...</div>
      </div>
    )
  }

  if (errorMsg || !customer) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', color: '#ef4444', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: '#fff', padding: '36px 44px', borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxWidth: 500 }}>
          <strong style={{ fontSize: 20, color: '#1e293b', display: 'block', marginBottom: 14 }}>Prístup zamietnutý</strong>
          <span style={{ fontSize: 16, color: '#64748b', display: 'block', marginBottom: 24 }}>
            {errorMsg || 'Identita zákazníka nemohla byť overená. Skontrolujte prosím prístupový odkaz.'}
          </span>
          <div style={{ fontSize: 14, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            ITspot s.r.o. | Podpora: ivanic@itspot.sk
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '40px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      
      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        
        {/* Hlavička aplikácie */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: '1 1 450px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 800, padding: '4px 10px', borderRadius: 5, letterSpacing: '0.02em' }}>
                ITspot s.r.o.
              </span>
              <span style={{ fontSize: 15, color: '#64748b', fontWeight: 600 }}>
                • Klientsky portál
              </span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              {customer.nazov}
            </h1>
            <p style={{ color: '#64748b', fontSize: 16, margin: 0, lineHeight: '1.6' }}>
              Sledujte reálny stav vašich zákaziek, označte kľúčové priority alebo pridajte novú požiadavku.
            </p>
          </div>

          <button
            onClick={() => setIsPopupOpen(true)}
            onMouseEnter={() => setIsBtnHovered(true)}
            onMouseLeave={() => setIsBtnHovered(false)}
            style={{
              background: isBtnHovered ? '#4338ca' : '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '16px 28px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: isBtnHovered ? '0 6px 18px rgba(79, 70, 229, 0.35)' : '0 4px 14px rgba(79, 70, 229, 0.2)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              transform: isBtnHovered ? 'translateY(-1px)' : 'none'
            }}
          >
            ✉ Nová požiadavka
          </button>
        </div>

        {/* Upozornenie na prekročenie limitu priorít */}
        {priorityError && (
          <div style={{ background: '#fef9c3', color: '#713f12', padding: '16px 20px', borderRadius: 12, fontSize: 16, fontWeight: 600, marginBottom: 24, border: '1px solid #fef08a', boxShadow: '0 2px 4px rgba(113,63,18,0.05)' }}>
            ⚠️ Môžete si zvoliť maximálne 3 prioritné zákazky naraz. Ak chcete označiť túto, zrušte najskôr prioritu pri inej zákazke.
          </div>
        )}

        {/* Úspešná notifikácia formulára */}
        {showSuccessNotification && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '18px 22px', borderRadius: 12, fontSize: 16, fontWeight: 600, marginBottom: 24, border: '1px solid #a7f3d0' }}>
            ✓ Vaša požiadavka bola úspešne zaregistrovaná. Akonáhle ju technici ITspot s.r.o. schvália, uvidíte ju v zozname.
          </div>
        )}

        {/* Filtre a radenie */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12, padding: '0 4px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#475569', margin: 0 }}>
            Aktuálne riešené projekty a zákazky ({orders.length})
            {priorityOrderIds.length > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: '#eab308', marginLeft: 10 }}>({priorityOrderIds.length}/3 zvolené priority)</span>}
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label htmlFor="sorting-select" style={{ fontSize: 15, color: '#64748b', fontWeight: 600 }}>Zoradiť:</label>
            <select
              id="sorting-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600, color: '#334155', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
            >
              <option value="najnovsie">Najnovšie prijaté</option>
              <option value="abeceda">Názvu (A-Z)</option>
              <option value="termin">Termínu dokončenia</option>
            </select>
          </div>
        </div>

        {/* Zoznam zákaziek */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sortedOrders.length === 0 ? (
            <div style={{ background: '#fff', textAlign: 'center', padding: 56, borderRadius: 16, border: '1px solid #e2e8f0', color: '#64748b', fontSize: 16 }}>
              Momentálne pre Vás neevidujeme žiadne aktívne zákazky.
            </div>
          ) : (
            sortedOrders.map((order) => {
              const isExpanded = expandedOrderIds.includes(order.id)
              const isPriority = priorityOrderIds.includes(order.id)
              const isCardHovered = hoveredOrderId === order.id

              return (
                <div 
                  key={order.id} 
                  onMouseEnter={() => order.popis && setHoveredOrderId(order.id)}
                  onMouseLeave={() => setHoveredOrderId(null)}
                  style={{ 
                    background: isPriority ? '#fefce8' : '#fff', 
                    borderRadius: 14, 
                    boxShadow: isCardHovered ? '0 6px 16px rgba(0,0,0,0.04)' : '0 1px 3px rgba(0,0,0,0.02)', 
                    border: isPriority ? '1px solid #fef08a' : '1px solid #e2e8f0', 
                    overflow: 'hidden', 
                    transition: 'all 0.2s ease',
                    transform: isCardHovered && !isExpanded ? 'translateX(3px)' : 'none',
                    ...getStatusCardBorder(order.stav, isPriority) 
                  }}
                >
                  <div 
                    onClick={() => order.popis && toggleExpandOrder(order.id)} 
                    style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, cursor: order.popis ? 'pointer' : 'default' }}
                  >
                    <div style={{ flex: '1 1 320px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      {/* Prioritná hviezdička */}
                      <button 
                        onClick={(e) => togglePriority(order.id, e)}
                        title={isPriority ? "Zrušiť vysokú prioritu" : "Označiť ako vysokú prioritu (Max 3)"}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: 26,
                          cursor: 'pointer',
                          color: isPriority ? '#eab308' : '#cbd5e1',
                          padding: 0,
                          lineHeight: 1,
                          marginTop: -2,
                          transition: 'color 0.15s ease'
                        }}
                      >
                        {isPriority ? '★' : '☆'}
                      </button>

                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 10, lineHeight: '1.4' }}>
                          {order.nazov}
                          {isPriority && <span style={{ background: '#fef08a', color: '#713f12', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.02em' }}>Vysoká priorita</span>}
                        </h3>
                        <div style={{ display: 'flex', gap: 20, fontSize: 14, color: '#64748b', flexWrap: 'wrap' }}>
                          <span>📅 Prijaté: <strong style={{ color: '#475569' }}>{formatDate(order.prijatie_zakazky)}</strong></span>
                          {order.termin && <span>⏱ Termín: <strong style={{ color: '#475569' }}>{formatDate(order.termin)}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 6, letterSpacing: '0.02em', ...getStatusBadgeStyle(order.stav) }}>
                        {getStatusLabel(order.stav)}
                      </span>
                      {order.popis && <span style={{ fontSize: 14, color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>▼</span>}
                    </div>
                  </div>
                  
                  {isExpanded && order.popis && (
                    <div style={{ padding: '24px 28px', borderTop: isPriority ? '1px solid #fef08a' : '1px solid #f1f5f9', background: isPriority ? '#fffde7' : '#f8fafc' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popis požiadavky / rozsah prác:</span>
                      <p style={{ fontSize: 15, color: '#334155', margin: '6px 0 0 0', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{order.popis}</p>

                      {subtasks.filter((s) => s.order_id === order.id).length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#64748b',
                              marginBottom: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            Podúlohy
                          </div>

                          <div style={{ display: 'grid', gap: 10 }}>
                            {subtasks
                              .filter((s) => s.order_id === order.id)
                              .map((subtask) => (
                                <div
                                  key={subtask.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: subtask.completed ? '#ecfdf5' : '#fff',
                                    border: subtask.completed
                                      ? '1px solid #a7f3d0'
                                      : '1px solid #e2e8f0',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 999,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: subtask.completed ? '#10b981' : '#e2e8f0',
                                      color: '#fff',
                                      fontSize: 12,
                                      fontWeight: 900,
                                    }}
                                  >
                                    {subtask.completed ? '✓' : ''}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 600,
                                      color: subtask.completed ? '#065f46' : '#334155',
                                      textDecoration: subtask.completed ? 'line-through' : 'none',
                                    }}
                                  >
                                    {subtask.nazov}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* SPODNÁ ČASŤ (KONTAKTY + FOOTER) */}
      <div style={{ maxWidth: 960, margin: '64px auto 0 auto', width: '100%' }}>
        
        {/* Kontaktné údaje */}
        <div style={{ background: '#ffffff', borderRadius: 16, padding: '28px 36px', marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Technická podpora a manažment projektov
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, fontSize: 15, color: '#475569' }}>
            <div>📞 Správa zákaziek: <strong style={{ color: '#0f172a' }}>+421 908 806 691</strong></div>
            <div>✉️ E-mail: <strong style={{ color: '#0f172a' }}>ivanic@itspot.sk</strong></div>
            <div>📍 Sídlo spoločnosti: <strong style={{ color: '#0f172a' }}>Brehy 530, 968 01 Brehy</strong></div>
          </div>
        </div>

        {/* Pätka */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
          © {new Date().getFullYear()} <strong>ITspot s.r.o.</strong> • Všetky práva vyhradené. Klientska zóna v1.3.
        </div>
      </div>

      {/* POPUP FORMULÁR */}
      {isPopupOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, zIndex: 999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', position: 'relative' }}>
            
            <button onClick={() => setIsPopupOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', fontSize: 24, color: '#94a3b8', cursor: 'pointer', padding: 4 }}>✕</button>

            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>✉️ Nová požiadavka na ITspot s.r.o.</h3>
            <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 28px 0', lineHeight: '1.5' }}>Zadajte špecifikáciu úloh. Požiadavka bude automaticky nahratá do nášho interného dispečingu.</p>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Názov zákazky / Objektu *</label>
                <input
                  type="text" required placeholder="Napr. Výmena rozvádzača v hale B..." value={formNazov}
                  onChange={(e) => setFormNazov(e.target.value)}
                  style={{ padding: '13px 16px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', color: '#0f172a', background: '#ffffff', outlineColor: '#4f46e5' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Podrobný popis práce *</label>
                <textarea
                  required rows={4} placeholder="Popíšte rozsah úloh, ktoré od ITspot s.r.o. požadujete zrealizovať..." value={formPopis}
                  onChange={(e) => setFormPopis(e.target.value)}
                  style={{ padding: '13px 16px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', color: '#0f172a', background: '#ffffff', outlineColor: '#4f46e5', lineHeight: '1.6' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 240 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Požadovaný termín splnenia</label>
                <input
                  type="date" value={formTermin}
                  onChange={(e) => setFormTermin(e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', color: '#0f172a', background: '#ffffff', outlineColor: '#4f46e5' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                <button type="button" onClick={() => setIsPopupOpen(false)} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Zrušiť
                </button>
                <button
                  type="submit" disabled={submitting}
                  style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(79, 70, 229, 0.15)', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Odosiela sa...' : '🚀 Odoslať do ITspot s.r.o.'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}