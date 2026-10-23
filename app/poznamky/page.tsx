'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, Pencil, Pin, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { normalizeNoteRuns, noteRunsToText, RichNoteEditor } from '@/components/notes/RichNoteEditor'
import type { NoteRun, NoteTextColor } from '@/components/notes/RichNoteEditor'
import { getSessionWithTimeout } from '@/lib/auth-timeout'
import { formatDate } from '@/lib/dashboard-utils'
import { supabase } from '@/lib/supabase'
import { useFormDraft } from '@/lib/use-form-draft'

type NotePriority = 'normal' | 'important' | 'urgent'
type NoteFilter = 'active' | 'urgent' | 'important' | 'done'

type PersonalNote = {
  id: string
  user_id: string
  content: string
  priority: NotePriority
  text_color: NoteTextColor
  content_runs: unknown
  is_pinned?: boolean
  sort_order?: number
  deleted_at?: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

const PRIORITIES: { value: NotePriority; label: string; color: string; background: string }[] = [
  { value: 'normal', label: 'Bežná', color: '#475569', background: '#f1f5f9' },
  { value: 'important', label: 'Dôležitá', color: '#9a3412', background: '#ffedd5' },
  { value: 'urgent', label: 'Súrna', color: '#b91c1c', background: '#fee2e2' },
]

const FILTERS: { value: NoteFilter; label: string }[] = [
  { value: 'active', label: 'Aktívne' },
  { value: 'urgent', label: 'Súrne' },
  { value: 'important', label: 'Dôležité' },
  { value: 'done', label: 'Hotové' },
]

const PRIORITY_ORDER: Record<NotePriority, number> = { urgent: 0, important: 1, normal: 2 }

function priorityConfig(priority: NotePriority) {
  return PRIORITIES.find((item) => item.value === priority) || PRIORITIES[0]
}

function formatCreatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatDate(value)
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function NotesPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [notes, setNotes] = useState<PersonalNote[]>([])
  const [quickRuns, setQuickRuns] = useState<NoteRun[]>([])
  const [quickPriority, setQuickPriority] = useState<NotePriority>('normal')
  const [filter, setFilter] = useState<NoteFilter>('active')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingRuns, setEditingRuns] = useState<NoteRun[]>([])
  const [editingPriority, setEditingPriority] = useState<NotePriority>('normal')

  const quickText = useMemo(() => noteRunsToText(quickRuns), [quickRuns])
  const editingText = useMemo(() => noteRunsToText(editingRuns), [editingRuns])
  const draftValue = useMemo(() => ({ quickRuns, quickPriority }), [quickPriority, quickRuns])
  const { clearDraft, lastSavedAt } = useFormDraft(
    userId ? `quick-note:${userId}` : null,
    draftValue,
    (draft) => {
      if (!Array.isArray(draft?.quickRuns)) return
      setQuickRuns(normalizeNoteRuns(draft.quickRuns))
      setQuickPriority(draft.quickPriority || 'normal')
    },
    Boolean(quickText.trim()),
  )

  useEffect(() => {
    let mounted = true
    async function initialize() {
      const session = await getSessionWithTimeout()
      if (!mounted) return
      if (!session?.user) { router.replace('/login'); return }
      setUserId(session.user.id)
      setCheckingAuth(false)
    }
    void initialize()
    return () => { mounted = false }
  }, [router])

  useEffect(() => {
    if (!userId) return
    void loadNotes(userId)
  }, [userId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function loadNotes(currentUserId: string) {
    setLoading(true)
    const { data, error } = await supabase.from('personal_notes').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      setNotice({ type: 'error', text: error.code === '42P01' ? 'Poznámky ešte nemajú databázovú tabuľku. Spusť skript scripts/supabase-personal-notes.sql v Supabase SQL Editore.' : `Poznámky sa nenačítali: ${error.message}` })
      return
    }
    setNotes(((data || []) as PersonalNote[]).filter((note) => !note.deleted_at))
  }

  const filteredNotes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('sk')
    return notes
      .filter((note) => {
        if (filter === 'done' && !note.completed) return false
        if (filter !== 'done' && note.completed) return false
        if (filter === 'urgent' && note.priority !== 'urgent') return false
        if (filter === 'important' && note.priority !== 'important') return false
        return !needle || note.content.toLocaleLowerCase('sk').includes(needle)
      })
      .sort((a, b) => {
        if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1
        const orderA = a.sort_order || new Date(a.created_at).getTime()
        const orderB = b.sort_order || new Date(b.created_at).getTime()
        if (orderA !== orderB) return orderB - orderA
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      })
  }, [filter, notes, search])

  const counts = useMemo(() => ({
    active: notes.filter((note) => !note.completed).length,
    urgent: notes.filter((note) => !note.completed && note.priority === 'urgent').length,
    important: notes.filter((note) => !note.completed && note.priority === 'important').length,
    done: notes.filter((note) => note.completed).length,
  }), [notes])

  async function addNote() {
    if (!userId || !quickText.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase.from('personal_notes').insert([{ user_id: userId, content: quickText.trim(), priority: quickPriority, text_color: 'black', content_runs: quickRuns, sort_order: Date.now(), is_pinned: false }]).select().single()
    setSaving(false)
    if (error || !data) { setNotice({ type: 'error', text: `Poznámka sa neuložila: ${error?.message || 'neznáma chyba'}` }); return }
    setNotes((current) => [data as PersonalNote, ...current])
    setQuickRuns([])
    setQuickPriority('normal')
    clearDraft()
    setFilter('active')
  }

  function beginEdit(note: PersonalNote) {
    setEditingId(note.id)
    setEditingRuns(normalizeNoteRuns(note.content_runs, note.content, note.text_color || 'black'))
    setEditingPriority(note.priority)
  }

  async function saveEdit(note: PersonalNote) {
    if (!userId || !editingText.trim() || saving) return
    setSaving(true)
    const updatedAt = new Date().toISOString()
    const { data, error } = await supabase.from('personal_notes').update({ content: editingText.trim(), priority: editingPriority, text_color: 'black', content_runs: editingRuns, updated_at: updatedAt }).eq('id', note.id).eq('user_id', userId).select().single()
    setSaving(false)
    if (error || !data) { setNotice({ type: 'error', text: `Poznámka sa neupravila: ${error?.message || 'neznáma chyba'}` }); return }
    setNotes((current) => current.map((item) => item.id === note.id ? data as PersonalNote : item))
    setEditingId('')
  }

  async function toggleCompleted(note: PersonalNote) {
    if (!userId || saving) return
    const completed = !note.completed
    if (completed && !window.confirm('Označiť túto poznámku ako hotovú? Potom ju nájdeš vo filtri Hotové.')) return
    const patch = { completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, ...patch } : item))
    const { error } = await supabase.from('personal_notes').update(patch).eq('id', note.id).eq('user_id', userId)
    if (error) {
      setNotes((current) => current.map((item) => item.id === note.id ? note : item))
      setNotice({ type: 'error', text: `Stav poznámky sa nezmenil: ${error.message}` })
    }
  }

  async function togglePinned(note: PersonalNote) {
    if (!userId || saving) return
    const patch = { is_pinned: !note.is_pinned, sort_order: Date.now(), updated_at: new Date().toISOString() }
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, ...patch } : item))
    const { error } = await supabase.from('personal_notes').update(patch).eq('id', note.id).eq('user_id', userId)
    if (error) {
      setNotes((current) => current.map((item) => item.id === note.id ? note : item))
      setNotice({ type: 'error', text: `Pripnutie sa nezmenilo: ${error.message}` })
    }
  }

  async function moveNote(note: PersonalNote, direction: 'up' | 'down') {
    if (!userId || saving) return
    const index = filteredNotes.findIndex((item) => item.id === note.id)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const target = filteredNotes[targetIndex]
    if (index < 0 || !target || Boolean(target.is_pinned) !== Boolean(note.is_pinned)) return
    const noteOrder = note.sort_order || new Date(note.created_at).getTime()
    const targetOrder = target.sort_order || new Date(target.created_at).getTime()
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, sort_order: targetOrder } : item.id === target.id ? { ...item, sort_order: noteOrder } : item))
    const [first, second] = await Promise.all([
      supabase.from('personal_notes').update({ sort_order: targetOrder }).eq('id', note.id).eq('user_id', userId),
      supabase.from('personal_notes').update({ sort_order: noteOrder }).eq('id', target.id).eq('user_id', userId),
    ])
    if (first.error || second.error) {
      setNotes((current) => current.map((item) => item.id === note.id ? { ...item, sort_order: noteOrder } : item.id === target.id ? { ...item, sort_order: targetOrder } : item))
      setNotice({ type: 'error', text: `Poradie sa neuložilo: ${first.error?.message || second.error?.message}` })
    }
  }

  async function deleteNote(note: PersonalNote) {
    if (!userId || !window.confirm('Presunúť túto poznámku do koša?')) return
    const previous = notes
    setNotes((current) => current.filter((item) => item.id !== note.id))
    const { error } = await supabase.from('personal_notes').update({ deleted_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', userId)
    if (error) { setNotes(previous); setNotice({ type: 'error', text: `Poznámka sa neodstránila: ${error.message}` }) }
  }

  const buttonStyle: CSSProperties = { minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 7, padding: '7px 11px', background: '#fff', color: '#0f172a', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }

  if (checkingAuth) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontWeight: 900 }}>Načítavam...</main>

  return <main className="notesPage">
    <style jsx global>{`
      body{margin:0;background:#eaf0f7;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.notesPage{min-height:100vh;padding:10px}.notesShell{max-width:1180px;margin:0 auto;display:grid;gap:9px}.notesHeader,.notesComposer,.notesList{background:#fff;border:1px solid #dbe4ef;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.06)}.notesHeader{padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px}.notesBrand{display:flex;align-items:center;gap:12px}.notesBrand h1{margin:0;font-size:19px}.notesBrand p{margin:2px 0 0;color:#64748b;font-size:11px;font-weight:700}.notesComposer{padding:12px;display:grid;gap:8px}.composerFooter,.notesToolbar,.priorityPicker,.noteActions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.composerFooter{justify-content:space-between}.priorityButton{min-height:32px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 10px;font-weight:900;cursor:pointer}.notesToolbar{padding:8px 10px;border-bottom:1px solid #dbe4ef}.filterButton{min-height:31px;border:1px solid transparent;border-radius:7px;padding:5px 9px;background:transparent;color:#475569;font-weight:900;cursor:pointer}.filterButton.active{background:#0f172a;color:#fff}.filterButton span{margin-left:5px;opacity:.75}.searchBox{margin-left:auto;position:relative}.searchBox svg{position:absolute;left:9px;top:8px;color:#64748b}.searchBox input{width:230px;min-height:32px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 9px 6px 30px;font-weight:700}.noteRow{display:grid;grid-template-columns:90px minmax(0,1fr) 130px auto;gap:8px;align-items:start;padding:9px 10px;border-top:1px solid #e2e8f0;border-left:4px solid transparent}.noteRow:first-of-type{border-top:0}.noteRow.urgent{border-left-color:#dc2626}.noteRow.important{border-left-color:#f97316}.noteRow.normal{border-left-color:#94a3b8}.priorityTag{display:inline-flex;justify-content:center;border-radius:999px;padding:4px 7px;font-size:10px;font-weight:950}.noteContent{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.4;font-weight:750}.noteDone .noteContent{text-decoration:line-through;color:#64748b!important}.noteDate{color:#64748b;font-size:10px;font-weight:700;line-height:1.4}.iconButton{width:31px;height:31px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;display:grid;place-items:center;cursor:pointer;color:#334155}.doneButton{min-height:31px;border:1px solid #bbf7d0;border-radius:7px;padding:5px 8px;background:#f0fdf4;color:#166534;font-weight:900;cursor:pointer;display:inline-flex;gap:5px;align-items:center}.editArea{display:grid;gap:7px}.notesEmpty{padding:38px;text-align:center;color:#64748b;font-weight:800}.notesNotice{padding:9px 11px;border-radius:8px;font-size:12px;font-weight:900}.notesNotice.success{background:#f7fee7;color:#365314;border:1px solid #bef264}.notesNotice.error{background:#fff1f2;color:#991b1b;border:1px solid #fecaca}@media(max-width:760px){.notesPage{padding:6px}.notesHeader{align-items:flex-start}.notesBrand p{display:none}.noteRow{grid-template-columns:80px minmax(0,1fr)}.noteDate{grid-column:1/3}.noteActions{grid-column:1/3}.searchBox{width:100%;margin-left:0}.searchBox input{width:100%;box-sizing:border-box}.composerFooter{align-items:flex-start;flex-direction:column}.composerFooter>button{width:100%}}
    `}</style>
    <div className="notesShell">
      <header className="notesHeader"><div className="notesBrand"><BrandLogo size="sm" tone="light"/><div><h1>Moje poznámky</h1><p>Rýchly pracovný zápisník</p></div></div><Link href="/zakazky" style={buttonStyle}>Zákazky a evidencia</Link></header>
      {notice && <div className={`notesNotice ${notice.type}`}>{notice.text}</div>}
      <section className="notesComposer">
        <RichNoteEditor runs={quickRuns} onChange={setQuickRuns} onSubmit={() => void addNote()} autoFocus/>
        <div className="composerFooter"><div><div className="priorityPicker">{PRIORITIES.map((priority) => <button key={priority.value} type="button" className="priorityButton" onClick={() => setQuickPriority(priority.value)} style={{ color: priority.color, background: quickPriority === priority.value ? priority.background : '#fff', borderColor: quickPriority === priority.value ? priority.color : '#cbd5e1' }}>{priority.label}</button>)}</div>{lastSavedAt && quickText.trim() && <small style={{ display:'block', marginTop:5, color:'#64748b', fontWeight:700 }}>Rozpísaná poznámka je uložená automaticky</small>}</div><button type="button" style={{...buttonStyle,background:'#84cc16',borderColor:'#65a30d'}} disabled={!quickText.trim() || saving} onClick={() => void addNote()}><Plus size={16}/>{saving?'Ukladám...':'Pridať poznámku'}</button></div>
      </section>
      <section className="notesList">
        <div className="notesToolbar">{FILTERS.map((item) => <button key={item.value} type="button" className={`filterButton ${filter===item.value?'active':''}`} onClick={() => setFilter(item.value)}>{item.label}<span>{counts[item.value]}</span></button>)}<div className="searchBox"><Search size={15}/><input placeholder="Hľadať v poznámkach..." value={search} onChange={(event) => setSearch(event.target.value)}/></div></div>
        {loading ? <div className="notesEmpty">Načítavam poznámky...</div> : filteredNotes.length === 0 ? <div className="notesEmpty">V tomto zozname zatiaľ nie sú žiadne poznámky.</div> : filteredNotes.map((note) => {
          const priority = priorityConfig(note.priority)
          const isEditing = editingId === note.id
          const displayRuns = normalizeNoteRuns(note.content_runs, note.content, note.text_color || 'black')
          const noteIndex = filteredNotes.findIndex((item) => item.id === note.id)
          const canMoveUp = noteIndex > 0 && Boolean(filteredNotes[noteIndex - 1]?.is_pinned) === Boolean(note.is_pinned)
          const canMoveDown = noteIndex < filteredNotes.length - 1 && Boolean(filteredNotes[noteIndex + 1]?.is_pinned) === Boolean(note.is_pinned)
          return <article key={note.id} className={`noteRow ${note.priority} ${note.completed?'noteDone':''}`}><span className="priorityTag" style={{color:priority.color,background:priority.background}}>{priority.label}</span>{isEditing?<div className="editArea"><RichNoteEditor runs={editingRuns} onChange={setEditingRuns} compact/><div className="priorityPicker">{PRIORITIES.map((item)=><button key={item.value} type="button" className="priorityButton" style={{color:item.color,background:editingPriority===item.value?item.background:'#fff'}} onClick={()=>setEditingPriority(item.value)}>{item.label}</button>)}</div></div>:<div className="noteContent">{displayRuns.map((run,index)=><span key={`${note.id}-${index}`} style={{color:({black:'#0f172a',red:'#b91c1c',green:'#15803d',blue:'#1d4ed8'} as const)[run.color]}}>{run.text}</span>)}</div>}<div className="noteDate">{formatCreatedAt(note.created_at)}{note.updated_at!==note.created_at&&<><br/>upravené</>}</div><div className="noteActions"><button type="button" className="iconButton" title={note.is_pinned?'Odopnúť':'Pripnúť navrch'} style={{color:note.is_pinned?'#4d7c0f':'#334155',background:note.is_pinned?'#ecfccb':'#fff'}} onClick={()=>void togglePinned(note)}><Pin size={15}/></button><button type="button" className="iconButton" title="Posunúť vyššie" disabled={!canMoveUp} onClick={()=>void moveNote(note,'up')}><ArrowUp size={15}/></button><button type="button" className="iconButton" title="Posunúť nižšie" disabled={!canMoveDown} onClick={()=>void moveNote(note,'down')}><ArrowDown size={15}/></button>{isEditing?<><button type="button" className="iconButton" title="Uložiť" onClick={()=>void saveEdit(note)}><Save size={15}/></button><button type="button" className="iconButton" title="Zrušiť" onClick={()=>setEditingId('')}><X size={15}/></button></>:<button type="button" className="iconButton" title="Upraviť" onClick={()=>beginEdit(note)}><Pencil size={15}/></button>}<button type="button" className="doneButton" title={note.completed?'Vrátiť medzi aktívne':'Označiť ako hotové'} onClick={()=>void toggleCompleted(note)}><Check size={14}/>{note.completed?'Vrátiť':'Hotovo'}</button><button type="button" className="iconButton" title="Presunúť do koša" style={{color:'#b91c1c',borderColor:'#fecaca'}} onClick={()=>void deleteNote(note)}><Trash2 size={15}/></button></div></article>
        })}
      </section>
    </div>
  </main>
}
