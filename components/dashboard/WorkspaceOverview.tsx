'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BriefcaseBusiness, ChevronRight, ClipboardList, FileCheck2, FileText, Search, StickyNote, UserRound, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  onSelectOrderSearch: (value: string) => void
}

const SEARCH_KINDS: { kind: SearchRecord['kind']; label: string; icon: LucideIcon; color: string; background: string }[] = [
  { kind: 'Zákazka', label: 'Zákazky', icon: BriefcaseBusiness, color: '#1d4ed8', background: '#dbeafe' },
  { kind: 'Zákazník', label: 'Zákazníci', icon: UserRound, color: '#047857', background: '#d1fae5' },
  { kind: 'Ponuka', label: 'Cenové ponuky', icon: FileText, color: '#0369a1', background: '#e0f2fe' },
  { kind: 'Poznámka', label: 'Poznámky', icon: StickyNote, color: '#a16207', background: '#fef3c7' },
  { kind: 'Obhliadka', label: 'Obhliadky', icon: ClipboardList, color: '#7e22ce', background: '#f3e8ff' },
  { kind: 'Protokol', label: 'Odovzdávacie protokoly', icon: FileCheck2, color: '#be123c', background: '#ffe4e6' },
]

export function WorkspaceOverview({ userId, customers, orders, pendingRequestsCount, onSelectOrderSearch }: Props) {
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
    return records
      .filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase('sk').includes(needle))
      .sort((a, b) => {
        const titleA = a.title.toLocaleLowerCase('sk')
        const titleB = b.title.toLocaleLowerCase('sk')
        const scoreA = titleA.startsWith(needle) ? 0 : titleA.includes(needle) ? 1 : 2
        const scoreB = titleB.startsWith(needle) ? 0 : titleB.includes(needle) ? 1 : 2
        return scoreA - scoreB || a.title.localeCompare(b.title, 'sk')
      })
  }, [activeInspections, activeNotes, activeProtocols, activeQuotes, customers, orders, query])

  const groupedResults = useMemo(() => SEARCH_KINDS.map((config) => ({ ...config, items: results.filter((item) => item.kind === config.kind).slice(0, 5) })).filter((group) => group.items.length > 0), [results])

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
      {query && <button type="button" className="workspaceClear" title="Vymazať hľadanie" onClick={() => setQuery('')}><X size={15}/></button>}
      {query.trim().length >= 2 && <div className="workspaceResults">
        <div className="workspaceResultsTitle"><strong>Výsledky hľadania</strong><span>{results.length}</span></div>
        {results.length === 0 ? <div className="workspaceNoResult"><Search size={20}/><span>Nič sa nenašlo. Skús názov firmy, číslo ponuky alebo časť poznámky.</span></div> : groupedResults.map((group) => {
          const GroupIcon = group.icon
          return <section className="workspaceResultGroup" key={group.kind}>
            <div className="workspaceGroupTitle" style={{ color: group.color }}><span style={{ background: group.background }}><GroupIcon size={14}/></span><strong>{group.label}</strong><small>{results.filter((item) => item.kind === group.kind).length}</small></div>
            {group.items.map((item) => <Link key={`${item.kind}-${item.id}`} href={item.href} className="workspaceResult" onClick={() => { setQuery(''); if (item.kind === 'Zákazka' || item.kind === 'Zákazník') onSelectOrderSearch(item.title) }}><span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span><ChevronRight size={16}/></Link>)}
          </section>
        })}
      </div>}
    </div>
    <div className="workspaceCards">{cards.map((card) => <Link href={card.href} className="workspaceCard" key={card.label} style={{ borderLeftColor: card.accent }}><span>{card.label}</span><strong style={{ color: card.value ? card.accent : '#64748b' }}>{card.value}</strong></Link>)}</div>
    <style jsx>{`
      .workspaceOverview{display:grid;gap:8px;margin-bottom:10px}.workspaceSearch{position:relative;background:#fff;border:1px solid #94a3b8;border-radius:8px;display:flex;align-items:center;padding:0 10px;box-shadow:0 8px 24px rgba(15,23,42,.08);z-index:20}.workspaceSearch>svg{color:#475569;flex:0 0 auto}.workspaceSearch input{width:100%;min-height:44px;border:0;outline:0;padding:8px 9px;font-size:13px;font-weight:800;color:#0f172a}.workspaceClear{width:29px;height:29px;border:0;border-radius:6px;background:#f1f5f9;color:#475569;display:grid;place-items:center;cursor:pointer}.workspaceResults{position:absolute;left:0;right:0;top:49px;background:#f8fafc;border:1px solid #94a3b8;border-radius:8px;box-shadow:0 22px 55px rgba(15,23,42,.24);overflow-y:auto;max-height:min(620px,72vh);padding:7px}.workspaceResultsTitle{display:flex;align-items:center;justify-content:space-between;padding:5px 7px 9px;color:#334155;font-size:12px}.workspaceResultsTitle span{min-width:25px;height:22px;border-radius:999px;background:#0f172a;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:950}.workspaceResultGroup{background:#fff;border:1px solid #dbe4ef;border-radius:7px;margin-top:6px;overflow:hidden}.workspaceGroupTitle{display:flex;align-items:center;gap:7px;padding:7px 9px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px}.workspaceGroupTitle>span{width:27px;height:27px;border-radius:6px;display:grid;place-items:center}.workspaceGroupTitle small{margin-left:auto;min-width:20px;text-align:center;color:#64748b}.workspaceResult{display:grid;grid-template-columns:minmax(0,1fr) 20px;align-items:center;gap:10px;padding:9px 11px;border-top:1px solid #edf2f7;color:#0f172a;text-decoration:none;min-height:42px}.workspaceResult:first-of-type{border-top:0}.workspaceResult:hover{background:#f7fee7}.workspaceResult>svg{color:#94a3b8}.workspaceResult strong{display:block;font-size:12px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspaceResult small{display:block;color:#64748b;font-size:10px;line-height:1.3;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspaceNoResult{padding:24px 14px;color:#64748b;font-weight:800;display:flex;align-items:center;justify-content:center;gap:9px;text-align:center}.workspaceCards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.workspaceCard{min-height:48px;background:#fff;border:1px solid #dbe4ef;border-left:4px solid;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:7px;text-decoration:none;color:#334155;box-shadow:0 5px 16px rgba(15,23,42,.05)}.workspaceCard span{font-size:11px;font-weight:900}.workspaceCard strong{font-size:22px}@media(max-width:760px){.workspaceCards{grid-template-columns:repeat(2,minmax(0,1fr))}.workspaceSearch input{font-size:12px}.workspaceResults{left:-1px;right:-1px}.workspaceResult strong{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
    `}</style>
  </section>
}
