'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const requestTypes = [
  { value: 'nova_instalacia', label: 'Nová inštalácia' },
  { value: 'servis', label: 'Servis' },
  { value: 'cenova_ponuka', label: 'Cenová ponuka' },
  { value: 'rozsirenie_systemu', label: 'Rozšírenie existujúceho systému' },
  { value: 'konzultacia', label: 'Konzultácia / obhliadka' },
  { value: 'reklamacia', label: 'Reklamácia' },
]

export default function PublicRequestPage() {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requestType, setRequestType] = useState('nova_instalacia')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    if (!name.trim() || !phone.trim() || !email.trim() || !title.trim() || !description.trim()) {
      setMessage({ type: 'error', text: 'Vyplňte prosím meno, telefón, email, názov a popis požiadavky.' })
      return
    }

    setSubmitting(true)

    const typeLabel = requestTypes.find((type) => type.value === requestType)?.label || requestType
    const fullDescription = [
      `Typ požiadavky: ${typeLabel}`,
      `Meno: ${name.trim()}`,
      company.trim() ? `Firma: ${company.trim()}` : '',
      `Telefón: ${phone.trim()}`,
      `Email: ${email.trim()}`,
      '',
      'Popis požiadavky:',
      description.trim(),
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const { error } = await supabase.from('customer_requests').insert([
        {
          customer_id: null,
          nazov: title.trim(),
          popis: fullDescription,
          termin: deadline || null,
          stav: 'na_schvalenie',
        },
      ])

      if (error) {
        setMessage({
          type: 'error',
          text: `Požiadavku sa nepodarilo odoslať. Kontaktujte nás telefonicky alebo emailom. Detail: ${error.message}`,
        })
        return
      }

      setName('')
      setCompany('')
      setPhone('')
      setEmail('')
      setRequestType('nova_instalacia')
      setTitle('')
      setDescription('')
      setDeadline('')
      setMessage({ type: 'success', text: 'Požiadavka bola odoslaná. Ozveme sa vám po jej spracovaní.' })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Neznáma chyba spojenia.'
      setMessage({ type: 'error', text: `Požiadavku sa nepodarilo odoslať: ${text}` })
    } finally {
      setSubmitting(false)
    }
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
            color: '#fff',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 18,
            padding: '24px clamp(18px, 4vw, 34px)',
            marginBottom: 14,
            display: 'block',
            alignItems: 'center',
            boxShadow: '0 20px 42px rgba(0, 0, 0, 0.32)',
            textAlign: 'center',
          }}
        >
          <div>
            <img
              src="/logo-new.png"
              alt="ITspot"
              style={{
                width: 500,
                maxWidth: '92vw',
                height: 190,
                objectFit: 'contain',
                objectPosition: 'center',
                display: 'block',
                margin: '0 auto 8px',
              }}
            />
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.18 }}>
              Formulár pre servis, montáž a cenovú ponuku
            </h1>
            <div style={{ marginTop: 10, color: 'rgba(226,232,240,0.72)', fontSize: 15, fontWeight: 800 }}>
              Napíšte nám, čo potrebujete vyriešiť. Požiadavku preveríme a ozveme sa vám s ďalším postupom.
            </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="name">
                Meno a priezvisko *
              </label>
              <input id="name" style={inputStyle} value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="company">
                Firma
              </label>
              <input id="company" style={inputStyle} value={company} onChange={(event) => setCompany(event.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="phone">
                Telefón *
              </label>
              <input id="phone" style={inputStyle} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="email">
                Email *
              </label>
              <input id="email" type="email" style={inputStyle} value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="request-type">
                Typ požiadavky
              </label>
              <select id="request-type" style={inputStyle} value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                {requestTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="deadline">
                Preferovaný termín
              </label>
              <input id="deadline" type="date" style={inputStyle} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor="title">
              Názov požiadavky *
            </label>
            <input
              id="title"
              style={inputStyle}
              placeholder="Napr. nefunguje kamera, nová montáž alarmu, rozšírenie Loxone"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor="description">
              Popis požiadavky *
            </label>
            <textarea
              id="description"
              rows={7}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
              placeholder="Napíšte, čo potrebujete vyriešiť, kde sa problém nachádza a aké sú dôležité detaily."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {message && (
            <div
              style={{
                marginTop: 16,
                borderRadius: 12,
                padding: 14,
                border: message.type === 'success' ? '1px solid #84cc16' : '1px solid #f87171',
                background: message.type === 'success' ? 'rgba(132, 204, 22, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                color: message.type === 'success' ? '#bef264' : '#fecaca',
                fontWeight: 800,
              }}
            >
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                minHeight: 46,
                border: '1px solid #84cc16',
                borderRadius: 12,
                background: '#84cc16',
                color: '#111827',
                padding: '10px 18px',
                fontWeight: 900,
                fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Odosiela sa...' : 'Odoslať požiadavku'}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            color: '#94a3b8',
            fontSize: 13,
          }}
        >
          <Link
            href="https://www.itspot.sk/"
            style={{
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 10,
              padding: '8px 12px',
              textDecoration: 'none',
              fontWeight: 800,
            }}
          >
            Späť na itspot.sk
          </Link>

          <div>Technická podpora: ivanic@itspot.sk, +421 908 806 691</div>
        </div>
      </div>
    </main>
  )
}
