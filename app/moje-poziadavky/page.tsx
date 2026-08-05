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
    case 'rozpracovana':
      return 'V riešení'
    case 'cakame':
      return 'Čaká'
    case 'hotova':
      return 'Hotové'
    case 'fakturovana':
      return 'Zrealizované'
    case 'stornovana':
      return 'Stornované'
    default:
      return item.stav || 'Zákazka'
  }
}

function getStatusColor(item: CustomerLookupItem) {
  if (item.item_type === 'poziadavka') return { background: '#fef3c7', color: '#92400e', border: '#fcd34d' }
  if (item.stav === 'fakturovana' || item.stav === 'hotova') return { background: '#dcfce7', color: '#166534', border: '#86efac' }
  if (item.stav === 'stornovana') return { background: '#fee2e2', color: '#991b1b', border: '#fecaca' }
  return { background: '#dbeafe', color: '#1e40af', border: '#93c5fd' }
}

function cleanPublicDescription(text: string | null) {
  if (!text) return ''
  return text
    .split('\n')
    .filter((line) => !/^Email:/i.test(line.trim()) && !/^Telefón:/i.test(line.trim()) && !/^Telefon:/i.test(line.trim()))
    .join('\n')
    .trim()
}

export default function MyRequestsPage() {
  const [customerName, setCustomerName] = useState('')
  const [portalCode, setPortalCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<CustomerLookupItem[]>([])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setSearched(false)

    const cleanPortalCode = portalCode.replace(/\D/g, '')
    if (!customerName.trim() || cleanPortalCode.length !== 6) {
      setMessage('Zadajte názov firmy alebo meno a prístupový kód zákazníka.')
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
      setItems([])
      return
    }

    setItems(((data || []) as CustomerLookupItem[]).slice(0, 25))
  }

  const inputStyle = {
    width: '100%',
    minHeight: 46,
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.35)',
    padding: '10px 12px',
    fontSize: 15,
    color: '#f8fafc',
    background: 'rgba(15, 23, 42, 0.72)',
    outlineColor: '#84cc16',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 800,
    color: '#dbeafe',
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 70% 0%, rgba(132, 204, 22, 0.18), transparent 32%), linear-gradient(180deg, #05070a 0%, #111827 58%, #05070a 100%)',
        color: '#f8fafc',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '22px 14px',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section
          style={{
            background: 'rgba(15, 23, 42, 0.82)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 18,
            padding: '24px clamp(18px, 4vw, 34px)',
            marginBottom: 14,
            textAlign: 'center',
            boxShadow: '0 20px 42px rgba(0, 0, 0, 0.32)',
          }}
        >
          <img
            src="/logo-new.png"
            alt="ITspot"
            style={{ width: 420, maxWidth: '86vw', height: 150, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }}
          />
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.18 }}>Moje požiadavky</h1>
          <div style={{ marginTop: 10, color: 'rgba(226,232,240,0.72)', fontSize: 15, fontWeight: 800 }}>
            Zadajte názov firmy alebo meno a prístupový kód. Zobrazíme stav vašich požiadaviek a zákaziek.
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          style={{
            background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(2, 6, 23, 0.96))',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 18,
            padding: '22px clamp(16px, 4vw, 30px)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.38)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, alignItems: 'end' }}>
            <div>
              <label style={labelStyle} htmlFor="customer-name">
                Firma alebo meno *
              </label>
              <input
                id="customer-name"
                style={inputStyle}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Názov vašej firmy alebo meno"
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="portal-code">
                Prístupový kód *
              </label>
              <input
                id="portal-code"
                inputMode="numeric"
                maxLength={6}
                style={inputStyle}
                value={portalCode}
                onChange={(event) => setPortalCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                minHeight: 46,
                border: '1px solid #84cc16',
                borderRadius: 12,
                background: '#84cc16',
                color: '#111827',
                padding: '10px 18px',
                fontWeight: 900,
                fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Hľadám...' : 'Zobraziť'}
            </button>
          </div>

          {message && (
            <div style={{ marginTop: 16, borderRadius: 12, padding: 14, border: '1px solid #f87171', background: 'rgba(248, 113, 113, 0.12)', color: '#fecaca', fontWeight: 800 }}>
              {message}
            </div>
          )}
        </form>

        <section style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {searched && items.length === 0 && !message && (
            <div style={{ border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 16, padding: 18, background: 'rgba(15, 23, 42, 0.82)', color: '#cbd5e1', fontWeight: 800 }}>
              Nenašli sme žiadnu požiadavku pre zadaný názov a prístupový kód.
            </div>
          )}

          {items.map((item) => {
            const statusColor = getStatusColor(item)
            return (
              <article
                key={`${item.item_type}-${item.id}`}
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.22)',
                  borderRadius: 16,
                  padding: 18,
                  background: 'rgba(248, 250, 252, 0.98)',
                  color: '#0f172a',
                  boxShadow: '0 14px 32px rgba(0, 0, 0, 0.24)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>{item.nazov || 'Požiadavka'}</h2>
                  <span
                    style={{
                      border: `1px solid ${statusColor.border}`,
                      background: statusColor.background,
                      color: statusColor.color,
                      borderRadius: 999,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {getStatusLabel(item)}
                  </span>
                </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 13, fontWeight: 800 }}>
                  <span>Odoslané: {formatDate(item.created_at)}</span>
                  {item.termin && <span>Termín: {formatDate(item.termin)}</span>}
                  {item.customer_name && <span>Zákazník: {item.customer_name}</span>}
                </div>

                {cleanPublicDescription(item.popis) && (
                  <p style={{ margin: '14px 0 0', whiteSpace: 'pre-wrap', color: '#334155', fontSize: 14, lineHeight: 1.55 }}>
                    {cleanPublicDescription(item.popis)}
                  </p>
                )}
              </article>
            )
          })}
        </section>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#94a3b8', fontSize: 13 }}>
          <Link href="/ziadost" style={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px', textDecoration: 'none', fontWeight: 800 }}>
            Nová požiadavka
          </Link>
          <div>Technická podpora: info@itspot.sk, +421 908 806 691</div>
        </div>
      </div>
    </main>
  )
}
