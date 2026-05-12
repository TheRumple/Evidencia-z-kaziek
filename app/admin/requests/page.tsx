'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type PendingRequest = {
  id: string
  customer_id: string
  nazov: string
  popis: string
  termin: string | null
  created_at: string
  customers: {
    nazov: string
    user_id: string // 🌟 Načítame user_id admina, ktoré je priradené k zákazníkovi
  } | null
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Stavy pre úpravu požiadavky v modálnom okne
  const [editingRequest, setEditingRequest] = useState<PendingRequest | null>(null)
  const [editNazov, setEditNazov] = useState('')
  const [editPopis, setEditPopis] = useState('')
  const [editTermin, setEditTermin] = useState('')

  useEffect(() => {
    void loadPendingRequests()
  }, [])

  // Načítanie požiadaviek z tabuľky spolu s názvom a user_id zákazníka
  async function loadPendingRequests() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customer_requests')
        .select(`
          id,
          customer_id,
          nazov,
          popis,
          termin,
          created_at,
          customers ( 
            nazov,
            user_id
          )
        `)
        .eq('stav', 'na_schvalenie')
        .order('created_at', { ascending: false })

      if (error) {
        alert(`Chyba pri načítaní požiadaviek: ${error.message}`)
        return
      }
      setRequests((data as any) || [])
    } catch (err: any) {
      alert(`Chyba: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Otvorenie modálneho okna na úpravu
  function openEditModal(req: PendingRequest) {
    setEditingRequest(req)
    setEditNazov(req.nazov)
    setEditPopis(req.popis)
    setEditTermin(req.termin || '')
  }

  // 🚀 Schválenie požiadavky s automatickým priradením user_id a stavu 'nova'
  async function handleApprove(reqId: string, finalNazov: string, finalPopis: string, finalTermin: string) {
    const targetRequest = requests.find(r => r.id === reqId)
    if (!targetRequest) return

    const dnesnyDatum = new Date().toISOString().slice(0, 10)
    // Získame priradené user_id z načítaného zákazníka
    const adminUserId = targetRequest.customers?.user_id || null

    try {
      console.log('Pokus o zápis do orders so priradeným user_id:', adminUserId)

      // 1. Vytvoríme ostrú zákazku v tabuľke 'orders'
      const { error: insertError } = await supabase
        .from('orders')
        .insert([
          {
            customer_id: targetRequest.customer_id,
            user_id: adminUserId, // 🌟 Automaticky priradíme tvoje ID, aby si ju hneď videl
            nazov: finalNazov.trim(),
            popis: finalPopis.trim(),
            termin: finalTermin ? finalTermin : null,
            stav: 'nova', // Interne zapíšeme 'nova', čo zodpovedá tvojmu filtru v hlavnej appke
            prijatie_zakazky: dnesnyDatum
          }
        ])
        .select() // Vynútenie kontroly úspešného zápisu

      // 🚨 PRÍSNA KONTROLA: Ak insert zlyhá, zastavíme kód a čakajúcu požiadavku NEZMAŽEME
      if (insertError) {
        console.error('Supabase Insert Error:', insertError)
        alert(`CHYBA DATABÁZY pri vytváraní zákazky:\n\nKód: ${insertError.code}\nOdkaz: ${insertError.message}\nDetail: ${insertError.details || 'Žiadny'}`)
        return 
      }

      // 2. Až po 100% úspešnom zápise vymažeme požiadavku z dočasných requests
      const { error: deleteError } = await supabase
        .from('customer_requests')
        .delete()
        .eq('id', reqId)

      if (deleteError) {
        alert(`Zákazka bola vytvorená, ale čakajúcu požiadavku sa nepodarilo odstrániť zo zoznamu: ${deleteError.message}`)
      }

      setEditingRequest(null)
      void loadPendingRequests()
      alert('Zákazka bola úspešne schválená a publikovaná klientovi!')

    } catch (err: any) {
      alert(`Systémová neočakávaná chyba: ${err.message}`)
    }
  }

  // ❌ Odmietnutie / Zmazanie požiadavky
  async function handleDelete(reqId: string) {
    if (!confirm('Naozaj chcete túto požiadavku natrvalo zmazať?')) return

    try {
      const { error } = await supabase
        .from('customer_requests')
        .delete()
        .eq('id', reqId)

      if (error) {
        alert(`Chyba pri mazaní: ${error.message}`)
        return
      }
      void loadPendingRequests()
    } catch (err: any) {
      alert(`Chyba: ${err.message}`)
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} (${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')})`
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontFamily: 'sans-serif' }}>Načítavam požiadavky na schválenie...</div>
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#f1f5f9', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        {/* Hlavička adminu s navigačnými prvkami */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>📋 Nové požiadavky od klientov</h1>
            <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: 14 }}>Tu vidíte požiadavky, ktoré čakajú na vaše schválenie a úpravu pred zverejnením.</p>
          </div>
          
          {/* Akčné tlačidlá vpravo hore */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link 
              href="/" 
              style={{ 
                background: '#fff', 
                border: '1px solid #cbd5e1', 
                padding: '8px 14px', 
                borderRadius: 8, 
                cursor: 'pointer', 
                fontSize: 13, 
                fontWeight: 600, 
                color: '#334155',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🏠 Domov
            </Link>
            <button onClick={() => void loadPendingRequests()} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' }}>
              🔄 Obnoviť
            </button>
          </div>
        </div>

        {/* Zoznam čakajúcich požiadaviek */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {requests.length === 0 ? (
            <div style={{ background: '#fff', textAlign: 'center', padding: 50, borderRadius: 16, color: '#64748b', border: '1px solid #e2e8f0' }}>
              🎉 Žiadne nové požiadavky. Všetko máte spracované!
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                
                {/* Horný infopanel požiadavky */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 14, marginBottom: 14 }}>
                  <div>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                      🏢 {req.customers?.nazov || 'Neznámy klient'}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 12 }}>
                      Odoslané: {formatDate(req.created_at)}
                    </span>
                  </div>
                  {req.termin && (
                    <div style={{ fontSize: 13, color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                      📅 Žiadaný termín: {req.termin.split('-').reverse().join('.')}
                    </div>
                  )}
                </div>

                {/* Obsah požiadavky */}
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>{req.nazov}</h3>
                <p style={{ fontSize: 14, color: '#475569', margin: '0 0 20px 0', whiteSpace: 'pre-wrap', lineHeight: 1.5, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  {req.popis}
                </p>

                {/* Akčné tlačidlá */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={() => handleDelete(req.id)}
                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    🗑️ Zmazať
                  </button>
                  <button
                    onClick={() => openEditModal(req)}
                    style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✏️ Upraviť detaily
                  </button>
                  <button
                    onClick={() => handleApprove(req.id, req.nazov, req.popis, req.termin || '')}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)' }}
                  >
                    🚀 Schváliť & Publikovať
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* MODÁLNE OKNO PRE ÚPRAVU PRED SCHVÁLENÍM */}
      {editingRequest && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>✏️ Úprava požiadavky pred publikovaním</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px 0' }}>Upravte texty podľa potreby. Kliknutím na zelené tlačidlo sa požiadavka rovno schváli.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Názov zákazky</label>
                <input
                  type="text" value={editNazov} onChange={(e) => setEditNazov(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, color: '#0f172a' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Popis práce</label>
                <textarea
                  rows={5} value={editPopis} onChange={(e) => setEditPopis(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, resize: 'vertical', color: '#0f172a', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 220 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Termín</label>
                <input
                  type="date" value={editTermin} onChange={(e) => setEditTermin(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, color: '#0f172a' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingRequest(null)} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Zrušiť
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(editingRequest.id, editNazov, editPopis, editTermin)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  💾 Uložiť & Schváliť
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}