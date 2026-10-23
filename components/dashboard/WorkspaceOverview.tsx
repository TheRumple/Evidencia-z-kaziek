'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import type { Customer, Order } from '@/lib/dashboard-types'
import { supabase } from '@/lib/supabase'

type SearchRecord = {
  id: string
  kind: 'Poznámka' | 'Zákazník' | 'Zákazka' | 'Ponuka' | 'Obhliadka' | 'Protokol'
  title: string
  detail: string
  href: string
}

type NoteSummary = { id: string; content: string; priority: string; completed: boolean; deleted_at?: string | null }
type QuoteSummary = { id: string; quote_number: string; title: string; customer_name?: string | null; status: string; deleted_at?: string | null }
type InspectionSummary = { id: string; customer_name?: string | null; request_summary?: string | null; site_address?: string | null; deleted_at?: string | null }
type ProtocolSummary = { id: string; protocol_number: string; customer_name?: string | null; customer_order_number?: string | null; deleted_at?: string | null }

type Props = {
  userId: string | null
  customers: Customer[]
  orders: Order[]
  pendingRequestsCount: number
}

export function WorkspaceOverview({ userId, customers, orders, pendingRequestsCount }: Props) {
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [inspections, setInspections] = useState<InspectionSummary[]>([])
  const [protocols, setProtocols] = useState<ProtocolSummary[]>([])

  useEffect(() => {
    if (!userId) return
    let active = true
    async function loadWorkspaceData() {
      const [notesResult, quotesResult, inspectionsResult, protocolsResult] = await Promise.allSettled([
        supabase.from('personal_notes').select('id,content,priority,completed,deleted_at').eq('user_id', userId),
        supabase.from('quotes').select('id,quote_number,title,customer_name,status,deleted_at').eq('user_id', userId),
        supabase.from('inspections').select('id,customer_name,request_summary,site_address,deleted_at').eq('user_id', userId),
        supabase.from('delivery_protocols').select('id,protocol_number,customer_name,customer_order_number,deleted_at').eq('user_id', userId),
      ])
      if (!active) return
      if (notesResult.status === 'fulfilled' && !notesResult.value.error) setNotes((notesResult.value.data || []) as NoteSummary[])
      if (quotesResult.status === 'fulfilled' && !quotesResult.value.error) setQuotes((quotesResult.value.data || []) as QuoteSummary[])
      if (inspectionsResult.status === 'fulfilled' && !inspectionsResult.value.error) setInspections((inspectionsResult.value.data || []) as InspectionSummary[])
      if (protocolsResult.status === 'fulfilled' && !protocolsResult.value.error) setProtocols((protocolsResult.value.data || []) as ProtocolSummary[])
    }
    void loadWorkspaceData()
    return () => { active = false }
  }, [userId])

  const activeNotes = notes.filter((item) => !item.deleted_at)
  const activeQuotes = quotes.filter((item) => !item.deleted_at)
  const activeInspections = inspections.filter((item) => !item.deleted_at)
  const activeProtocols = protocols.filter((item) => !item.deleted_at)
  const urgentNotes = activeNotes.filter((item) => !item.completed && item.priority === 'urgent').length
  const waitingMaterial = orders.filter((item) => item.stav === 'caka').length
  const draftQuotes = activeQuotes.filter((item) => item.status === 'draft').length

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('sk')
    if (needle.length < 2) return []
    const customerName = (customerId: string) => customers.find((customer) => customer.id === customerId)?.nazov || ''
    const records: SearchRecord[] = [
      ...activeNotes.map((item) => ({ id: item.id, kind: 'Poznámka' as const, title: item.content, detail: item.priority === 'urgent' ? 'Súrna poznámka' : 'Poznámka', href: '/poznamky' })),
      ...customers.map((item) => ({ id: item.id, kind: 'Zákazník' as const, title: item.nazov, detail: [item.kontakt, item.email, item.telefon].filter(Boolean).join(' · '), href: '/zakazky' })),
      ...orders.map((item) => ({ id: item.id, kind: 'Zákazka' as const, title: item.nazov, detail: `${customerName(item.customer_id)} · ${item.popis || ''}`, href: '/zakazky' })),
      ...activeQuotes.map((item) => ({ id: item.id, kind: 'Ponuka' as const, title: `${item.quote_number} · ${item.title}`, detail: item.customer_name || '', href: '/cenove-ponuky' })),
      ...activeInspections.map((item) => ({ id: item.id, kind: 'Obhliadka' as const, title: item.request_summary || item.customer_name || 'Obhliadka', detail: [item.customer_name, item.site_address].filter(Boolean).join(' · '), href: '/obhliadky' })),
      ...activeProtocols.map((item) => ({ id: item.id, kind: 'Protokol' as const, title: item.protocol_number || 'Bez čísla', detail: [item.customer_name, item.customer_order_number].filter(Boolean).join(' · '), href: '/odovzdavacie-protokoly' })),
    ]
    return records.filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase('sk').includes(needle)).slice(0, 12)
  }, [activeInspections, activeNotes, activeProtocols, activeQuotes, customers, orders, query])

  const cards = [
    { label: 'Súrne poznámky', value: urgentNotes, href: '/poznamky', accent: '#dc2626' },
    { label: 'Nové požiadavky', value: pendingRequestsCount, href: '/admin/requests', accent: '#ea580c' },
    { label: 'Čaká na materiál', value: waitingMaterial, href: '/zakazky', accent: '#f59e0b' },
    { label: 'Rozpracované ponuky', value: draftQuotes, href: '/cenove-ponuky', accent: '#0284c7' },
  ]

  return <section className="workspaceOverview">
    <div className="workspaceSearch">
      <Search size={17}/>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hľadať v zákazkách, zákazníkoch, ponukách, protokoloch a poznámkach..."/>
      {query.trim().length >= 2 && <div className="workspaceResults">
        {results.length === 0 ? <div className="workspaceNoResult">Nič sa nenašlo.</div> : results.map((item) => <Link key={`${item.kind}-${item.id}`} href={item.href} className="workspaceResult"><span className="workspaceKind">{item.kind}</span><span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span></Link>)}
      </div>}
    </div>
    <div className="workspaceCards">{cards.map((card) => <Link href={card.href} className="workspaceCard" key={card.label} style={{ borderLeftColor: card.accent }}><span>{card.label}</span><strong style={{ color: card.value ? card.accent : '#64748b' }}>{card.value}</strong></Link>)}</div>
    <style jsx>{`
      .workspaceOverview{display:grid;gap:8px;margin-bottom:10px}.workspaceSearch{position:relative;background:#fff;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;padding:0 11px;box-shadow:0 8px 24px rgba(15,23,42,.07);z-index:20}.workspaceSearch :global(svg){color:#64748b;flex:0 0 auto}.workspaceSearch input{width:100%;min-height:42px;border:0;outline:0;padding:8px 9px;font-size:13px;font-weight:800;color:#0f172a}.workspaceResults{position:absolute;left:0;right:0;top:46px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 18px 45px rgba(15,23,42,.18);overflow:hidden;max-height:420px;overflow-y:auto}.workspaceResult{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;padding:9px 11px;border-top:1px solid #e2e8f0;color:#0f172a;text-decoration:none}.workspaceResult:first-child{border-top:0}.workspaceResult:hover{background:#f7fee7}.workspaceResult strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspaceResult small{display:block;color:#64748b;font-size:10px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspaceKind{color:#365314;background:#ecfccb;border-radius:5px;padding:3px 6px;font-size:9px;font-weight:950;text-align:center;align-self:start}.workspaceNoResult{padding:14px;color:#64748b;font-weight:800}.workspaceCards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.workspaceCard{min-height:48px;background:#fff;border:1px solid #dbe4ef;border-left:4px solid;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:7px;text-decoration:none;color:#334155;box-shadow:0 5px 16px rgba(15,23,42,.05)}.workspaceCard span{font-size:11px;font-weight:900}.workspaceCard strong{font-size:22px}@media(max-width:760px){.workspaceCards{grid-template-columns:repeat(2,minmax(0,1fr))}.workspaceResult{grid-template-columns:72px minmax(0,1fr)}.workspaceSearch input{font-size:12px}}
    `}</style>
  </section>
}
