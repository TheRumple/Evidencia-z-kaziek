'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type PendingRequest = {
  id: string
  customer_id: string | null
  nazov: string
  popis: string
  termin: string | null
  created_at: string
  customers: {
    nazov: string
    user_id: string
  } | null
}

type Customer = {
  id: string
  nazov: string
  user_id: string
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Stavy pre úpravu požiadavky v modálnom okne
  const [editingRequest, setEditingRequest] = useState<PendingRequest | null>(null)
  const [editNazov, setEditNazov] = useState('')
  const [editPopis, setEditPopis] = useState('')
  const [editTermin, setEditTermin] = useState('')
  const [editCustomerId, setEditCustomerId] = useState('')

  useEffect(() => {
    void loadPendingRequests()
  }, [])

  // Načítanie požiadaviek z tabuľky spolu s názvom a user_id zákazníka
  async function loadPendingRequests() {
    setLoading(true)
    try {
      const [{ data, error }, { data: customersData, error: customersError }] = await Promise.all([
        supabase
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
        .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('id, nazov, user_id')
          .order('nazov', { ascending: true }),
      ])

      if (error) {
        alert(`Chyba pri načítaní požiadaviek: ${error.message}`)
        return
      }
      if (customersError) {
        alert(`Chyba pri načítaní zákazníkov: ${customersError.message}`)
        return
      }

      const nextRequests = ((data as any) || []) as PendingRequest[]
      setRequests(nextRequests)
      setCustomers(((customersData as any) || []) as Customer[])
      setSelectedCustomerIds((current) => {
        const next = { ...current }
        for (const req of nextRequests) {
          if (!next[req.id] && req.customer_id) next[req.id] = req.customer_id
        }
        return next
      })
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
    setEditCustomerId(selectedCustomerIds[req.id] || req.customer_id || '')
  }

  // 🚀 Schválenie požiadavky s automatickým priradením user_id a stavu 'nova'
  async function handleApprove(reqId: string, finalNazov: string, finalPopis: string, finalTermin: string, assignedCustomerId?: string) {
    const targetRequest = requests.find(r => r.id === reqId)
    if (!targetRequest) return

    const finalCustomerId = assignedCustomerId || selectedCustomerIds[reqId] || targetRequest.customer_id || ''
    const selectedCustomer = customers.find((customer) => customer.id === finalCustomerId)
    if (!selectedCustomer) {
      alert('Najprv priraďte požiadavku ku konkrétnemu zákazníkovi.')
      return
    }

    const dnesnyDatum = new Date().toISOString().slice(0, 10)
    const adminUserId = selectedCustomer.user_id

    try {
      console.log('Pokus o zápis do orders so priradeným user_id:', adminUserId)

      // 1. Vytvoríme ostrú zákazku v tabuľke 'orders'
      const { error: insertError } = await supabase
        .from('orders')
        .insert([
          {
            customer_id: selectedCustomer.id,
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
      openCustomerEmail(targetRequest, 'approved', finalNazov.trim(), selectedCustomer.nazov)
      alert('Zákazka bola úspešne schválená a publikovaná klientovi!')

    } catch (err: any) {
      alert(`Systémová neočakávaná chyba: ${err.message}`)
    }
  }

  function getRequestEmail(req: PendingRequest) {
    const labeledEmail = req.popis.match(/^Email:\s*(.+)$/im)?.[1]?.trim()
    const anyEmail = req.popis.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    return labeledEmail || anyEmail || ''
  }

  function getRequestName(req: PendingRequest) {
    return req.popis.match(/^Meno:\s*(.+)$/im)?.[1]?.trim() || ''
  }

  function openMailDraft(to: string, subject: string, body: string) {
    if (!to) {
      alert('V požiadavke nie je nájdený email zákazníka.')
      return
    }

    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  function openCustomerEmail(req: PendingRequest, type: 'received' | 'approved' | 'rejected', orderName = req.nazov, customerName = '') {
    const email = getRequestEmail(req)
    const name = getRequestName(req)
    const greeting = name ? `Dobrý deň ${name},` : 'Dobrý deň,'

    if (type === 'received') {
      openMailDraft(
        email,
        `ITspot - prijali sme vašu požiadavku`,
        `${greeting}

potvrdzujeme prijatie vašej požiadavky:
${req.nazov}

Požiadavku preveríme a ozveme sa vám s ďalším postupom.

S pozdravom
ITspot s.r.o.`
      )
      return
    }

    if (type === 'approved') {
      openMailDraft(
        email,
        `ITspot - požiadavka bola schválená`,
        `${greeting}

vaša požiadavka bola schválená a zaradená medzi zákazky.

Zákazka: ${orderName}
${customerName ? `Zákazník: ${customerName}` : ''}

V prípade potreby vás budeme kontaktovať s ďalším postupom.

S pozdravom
ITspot s.r.o.`
      )
      return
    }

    const reason = window.prompt('Dôvod zamietnutia do emailu:', 'Požiadavku momentálne nevieme zaradiť do realizácie.')
    if (reason === null) return

    openMailDraft(
      email,
      `ITspot - požiadavka bola zamietnutá`,
      `${greeting}

vašu požiadavku sme preverili, ale momentálne ju nevieme zaradiť do realizácie.

Požiadavka: ${req.nazov}
Dôvod: ${reason.trim() || 'Požiadavku momentálne nevieme zaradiť do realizácie.'}

S pozdravom
ITspot s.r.o.`
    )
  }

  // ❌ Odmietnutie / Zmazanie požiadavky
  async function handleDelete(reqId: string, withEmail = false) {
    const targetRequest = requests.find(r => r.id === reqId)
    if (!targetRequest) return
    if (!confirm(withEmail ? 'Otvoriť email o zamietnutí a zmazať požiadavku?' : 'Naozaj chcete túto požiadavku natrvalo zmazať?')) return

    if (withEmail) {
      openCustomerEmail(targetRequest, 'rejected')
    }

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
            <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: 14 }}>Po schválení alebo zamietnutí sa otvorí pripravený email v poštovom klientovi.</p>
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

                <div style={{ marginBottom: 16, maxWidth: 360 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>
                    Priradiť ku zákazníkovi
                  </label>
                  <select
                    value={selectedCustomerIds[req.id] || req.customer_id || ''}
                    onChange={(event) =>
                      setSelectedCustomerIds((current) => ({
                        ...current,
                        [req.id]: event.target.value,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      background: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    <option value="">Vyberte zákazníka</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.nazov}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Akčné tlačidlá */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={() => openCustomerEmail(req, 'received')}
                    style={{ background: '#e0f2fe', color: '#075985', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✉️ Email prijatie
                  </button>
                  <button
                    onClick={() => handleDelete(req.id, true)}
                    style={{ background: '#ffedd5', color: '#9a3412', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Zamietnuť + email
                  </button>
                  <button
                    onClick={() => handleDelete(req.id)}
                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Zmazať bez emailu
                  </button>
                  <button
                    onClick={() => openEditModal(req)}
                    style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✏️ Upraviť detaily
                  </button>
                  <button
                    onClick={() => handleApprove(req.id, req.nazov, req.popis, req.termin || '', selectedCustomerIds[req.id])}
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
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px 0' }}>Upravte texty podľa potreby. Po schválení sa otvorí pripravený email zákazníkovi.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Zákazník</label>
                <select
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, color: '#0f172a', background: '#fff' }}
                >
                  <option value="">Vyberte zákazníka</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.nazov}
                    </option>
                  ))}
                </select>
              </div>

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
                  onClick={() => handleApprove(editingRequest.id, editNazov, editPopis, editTermin, editCustomerId)}
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
