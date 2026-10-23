'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RotateCcw, Trash2 } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { getSessionWithTimeout } from '@/lib/auth-timeout'
import { formatDate } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'

type TrashKind = 'personal_notes' | 'quotes' | 'inspections' | 'delivery_protocols'
type TrashItem = { id: string; kind: TrashKind; title: string; detail: string; deletedAt: string }

const LABELS: Record<TrashKind, string> = {
  personal_notes: 'Poznámka',
  quotes: 'Cenová ponuka',
  inspections: 'Obhliadka',
  delivery_protocols: 'Odovzdávací protokol',
}

export default function TrashPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | TrashKind>('all')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function initialize() {
      const session = await getSessionWithTimeout()
      if (!active) return
      if (!session?.user) { window.location.href = '/login'; return }
      setUserId(session.user.id)
      await loadTrash(session.user.id)
    }
    void initialize()
    return () => { active = false }
  }, [])

  async function loadTrash(currentUserId: string) {
    setLoading(true)
    const [notes, quotes, inspections, protocols] = await Promise.all([
      supabase.from('personal_notes').select('id,content,deleted_at').eq('user_id', currentUserId).not('deleted_at', 'is', null),
      supabase.from('quotes').select('id,quote_number,title,customer_name,deleted_at').eq('user_id', currentUserId).not('deleted_at', 'is', null),
      supabase.from('inspections').select('id,customer_name,request_summary,deleted_at').eq('user_id', currentUserId).not('deleted_at', 'is', null),
      supabase.from('delivery_protocols').select('id,protocol_number,customer_name,deleted_at').eq('user_id', currentUserId).not('deleted_at', 'is', null),
    ])
    const firstError = [notes.error, quotes.error, inspections.error, protocols.error].find(Boolean)
    if (firstError) setNotice('Kôš ešte nie je pripravený. Spusť skript scripts/supabase-productivity-upgrades.sql v Supabase SQL Editore.')
    const next: TrashItem[] = [
      ...(notes.data || []).map((item) => ({ id: item.id, kind: 'personal_notes' as const, title: item.content, detail: '', deletedAt: item.deleted_at || '' })),
      ...(quotes.data || []).map((item) => ({ id: item.id, kind: 'quotes' as const, title: `${item.quote_number} · ${item.title}`, detail: item.customer_name || '', deletedAt: item.deleted_at || '' })),
      ...(inspections.data || []).map((item) => ({ id: item.id, kind: 'inspections' as const, title: item.request_summary || 'Obhliadka', detail: item.customer_name || '', deletedAt: item.deleted_at || '' })),
      ...(protocols.data || []).map((item) => ({ id: item.id, kind: 'delivery_protocols' as const, title: item.protocol_number || 'Bez čísla', detail: item.customer_name || '', deletedAt: item.deleted_at || '' })),
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    setItems(next)
    setLoading(false)
  }

  async function restore(item: TrashItem) {
    if (!userId) return
    const { error } = await supabase.from(item.kind).update({ deleted_at: null }).eq('id', item.id).eq('user_id', userId)
    if (error) { setNotice(`Položku sa nepodarilo obnoviť: ${error.message}`); return }
    setItems((current) => current.filter((entry) => !(entry.kind === item.kind && entry.id === item.id)))
    setNotice('Položka bola obnovená.')
  }

  async function removePermanently(item: TrashItem) {
    if (!userId || !window.confirm('Natrvalo odstrániť túto položku? Tento krok sa už nedá vrátiť.')) return
    const { error } = await supabase.from(item.kind).delete().eq('id', item.id).eq('user_id', userId)
    if (error) { setNotice(`Položku sa nepodarilo odstrániť: ${error.message}`); return }
    setItems((current) => current.filter((entry) => !(entry.kind === item.kind && entry.id === item.id)))
    setNotice('Položka bola natrvalo odstránená.')
  }

  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.kind === filter), [filter, items])

  return <main className="trashPage"><div className="trashShell">
    <header><div className="trashBrand"><BrandLogo size="sm" tone="light"/><div><h1>Kôš</h1><p>Odstránené položky môžeš obnoviť alebo zmazať natrvalo.</p></div></div><Link href="/zakazky">Späť na zákazky</Link></header>
    {notice && <div className="trashNotice">{notice}</div>}
    <section>
      <div className="trashToolbar"><strong>Odstránené položky ({visibleItems.length})</strong><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Všetko</option>{Object.entries(LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      {loading ? <div className="trashEmpty">Načítavam...</div> : visibleItems.length === 0 ? <div className="trashEmpty">Kôš je prázdny.</div> : <div className="trashList">{visibleItems.map((item)=><article key={`${item.kind}-${item.id}`}><span className="trashKind">{LABELS[item.kind]}</span><div><strong>{item.title}</strong>{item.detail&&<small>{item.detail}</small>}</div><time>{formatDate(item.deletedAt)}</time><div className="trashActions"><button onClick={()=>void restore(item)}><RotateCcw size={14}/>Obnoviť</button><button className="danger" onClick={()=>void removePermanently(item)}><Trash2 size={14}/>Natrvalo</button></div></article>)}</div>}
    </section>
  </div><style jsx global>{`
    body{margin:0;background:#eaf0f7;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.trashPage{min-height:100vh;padding:10px}.trashShell{max-width:1180px;margin:0 auto;display:grid;gap:9px}.trashShell header,.trashShell section{background:#fff;border:1px solid #dbe4ef;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.06)}.trashShell header{padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px}.trashBrand{display:flex;align-items:center;gap:12px}.trashBrand h1{margin:0;font-size:19px}.trashBrand p{margin:2px 0 0;color:#64748b;font-size:11px;font-weight:700}.trashShell header>a,.trashActions button{min-height:32px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 10px;background:#fff;color:#0f172a;text-decoration:none;font-weight:900;display:inline-flex;align-items:center;gap:5px;cursor:pointer}.trashToolbar{padding:9px 10px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}.trashToolbar select{min-height:32px;border:1px solid #cbd5e1;border-radius:7px;padding:5px 8px;font-weight:800}.trashList article{display:grid;grid-template-columns:150px minmax(0,1fr) 110px auto;gap:9px;align-items:center;padding:9px 10px;border-top:1px solid #e2e8f0}.trashList article:first-child{border-top:0}.trashList strong,.trashList small{display:block}.trashList small,.trashList time{color:#64748b;font-size:10px}.trashKind{font-size:10px;font-weight:950;color:#475569}.trashActions{display:flex;gap:5px}.trashActions .danger{color:#b91c1c;border-color:#fecaca}.trashEmpty{padding:38px;text-align:center;color:#64748b;font-weight:800}.trashNotice{padding:9px 11px;border:1px solid #bef264;background:#f7fee7;color:#365314;border-radius:8px;font-size:12px;font-weight:900}@media(max-width:700px){.trashList article{grid-template-columns:100px minmax(0,1fr)}.trashList time,.trashActions{grid-column:2}.trashShell header{align-items:flex-start}.trashBrand p{display:none}}
  `}</style></main>
}
