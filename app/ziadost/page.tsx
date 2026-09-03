'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function PublicRequestPage() {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requestTitle, setRequestTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [website, setWebsite] = useState('')
  const [formStartedAt] = useState(() => Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    if (website.trim()) {
      setMessage({ type: 'success', text: 'Požiadavka bola odoslaná. Ozveme sa vám po jej spracovaní.' })
      return
    }

    if (Date.now() - formStartedAt < 3500) {
      setMessage({ type: 'error', text: 'Formulár bol odoslaný príliš rýchlo. Skontrolujte údaje a skúste to znova.' })
      return
    }

    if (!name.trim() || !email.trim() || !requestTitle.trim() || !description.trim()) {
      setMessage({ type: 'error', text: 'Vyplňte prosím meno, email, názov a popis požiadavky.' })
      return
    }

    const today = getLocalDateValue()
    const phoneDigits = phone.replace(/\D/g, '')
    const combinedText = [name, company, phone, email, requestTitle, description].join(' ')
    const suspiciousPattern = /(https?:\/\/|www\.|casino|viagra|crypto|loan|forex|porn|betting)/i
    const allowedAttachmentTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

    if (deadline && deadline < today) {
      setMessage({ type: 'error', text: 'Preferovaný termín nemôže byť v minulosti.' })
      return
    }

    if (phone.trim() && phoneDigits.length < 7) {
      setMessage({ type: 'error', text: 'Zadajte prosím platné telefónne číslo.' })
      return
    }

    if (description.trim().length < 15) {
      setMessage({ type: 'error', text: 'Popis požiadavky je príliš krátky. Napíšte prosím aspoň stručne, čo potrebujete vyriešiť.' })
      return
    }

    if (suspiciousPattern.test(combinedText)) {
      setMessage({ type: 'error', text: 'Požiadavka neprešla kontrolou. Skontrolujte text a skúste to znova.' })
      return
    }

    if (attachments.length > 5) {
      setMessage({ type: 'error', text: 'Priložiť môžete najviac 5 súborov.' })
      return
    }

    const invalidAttachment = attachments.find((file) => !allowedAttachmentTypes.includes(file.type) || file.size > 8 * 1024 * 1024)
    if (invalidAttachment) {
      setMessage({ type: 'error', text: 'Prílohy môžu byť len obrázky alebo PDF, maximálne 8 MB na súbor.' })
      return
    }

    setSubmitting(true)

    const uploadedAttachmentUrls: string[] = []

    try {
      for (const file of attachments) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const filePath = `ziadosti/${Date.now()}-${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('customer-request-files')
          .upload(filePath, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('customer-request-files').getPublicUrl(filePath)
        if (data.publicUrl) uploadedAttachmentUrls.push(data.publicUrl)
      }

      const generatedTitle = requestTitle.trim()
      const fullDescription = [
        `Meno: ${name.trim()}`,
        company.trim() ? `Firma: ${company.trim()}` : '',
        phone.trim() ? `Telefón: ${phone.trim()}` : '',
        `Email: ${email.trim()}`,
        '',
        'Popis požiadavky:',
        description.trim(),
        uploadedAttachmentUrls.length ? '' : '',
        uploadedAttachmentUrls.length ? 'Prílohy:' : '',
        ...uploadedAttachmentUrls.map((url) => `- ${url}`),
      ]
        .filter(Boolean)
        .join('\n')

      const { error } = await supabase.from('customer_requests').insert([
        {
          customer_id: null,
          nazov: generatedTitle,
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
      setRequestTitle('')
      setDescription('')
      setDeadline('')
      setAttachments([])
      setMessage({ type: 'success', text: 'Vaša požiadavka bola odoslaná. Stav môžete sledovať v časti Moje požiadavky.' })
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
      className="requestPage"
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
          className="requestHero"
          style={{
            background: 'rgba(15, 23, 42, 0.82)',
            color: '#fff',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 18,
            padding: '18px clamp(18px, 4vw, 30px)',
            marginBottom: 14,
            display: 'block',
            alignItems: 'center',
            boxShadow: '0 20px 42px rgba(0, 0, 0, 0.32)',
            textAlign: 'center',
          }}
        >
          <div>
            <img
              className="requestLogo"
              src="/brand-logo-dark.png"
              alt="ITspot"
              style={{
                width: 210,
                maxWidth: '62vw',
                height: 58,
                objectFit: 'contain',
                objectPosition: 'center',
                display: 'block',
                margin: '0 auto 12px',
              }}
            />
            <h1 className="requestTitle" style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.18 }}>
              Formulár pre servis, montáž a cenovú ponuku
            </h1>
            <div className="requestSubtitle" style={{ marginTop: 10, color: 'rgba(226,232,240,0.72)', fontSize: 15, fontWeight: 800 }}>
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
          <div style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
            <label htmlFor="website">Web stránka</label>
            <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>

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
                Telefón
              </label>
              <input id="phone" style={inputStyle} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="email">
                Email *
              </label>
              <input id="email" type="email" required style={inputStyle} value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="deadline">
                Preferovaný termín
              </label>
              <input id="deadline" type="date" style={inputStyle} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor="request-title">
              Názov požiadavky *
            </label>
            <input
              id="request-title"
              required
              style={inputStyle}
              placeholder="Napr. servis kamery, cenová ponuka alarmu, výmena motora"
              value={requestTitle}
              onChange={(event) => setRequestTitle(event.target.value)}
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
              placeholder="Napr. potrebujem novú montáž alarmu, nefunguje kamera, rozšírenie Loxone alebo cenovú ponuku. Pridajte miesto, stručný popis a dôležité detaily."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor="attachments">
              Fotky alebo PDF
            </label>
            <input
              id="attachments"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={inputStyle}
              onChange={(event) => setAttachments(Array.from(event.target.files || []).slice(0, 5))}
            />
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
              Môžete priložiť najviac 5 súborov, napríklad fotku štítku, chyby alebo miesta montáže.
            </div>
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

          <Link
            href="/moje-poziadavky"
            style={{
              color: '#111827',
              border: '1px solid #84cc16',
              background: '#84cc16',
              boxShadow: '0 10px 24px rgba(132, 204, 22, 0.22)',
              borderRadius: 12,
              padding: '9px 14px',
              textDecoration: 'none',
              fontWeight: 900,
            }}
          >
            Moje požiadavky
          </Link>

          <div>Technická podpora: info@itspot.sk, +421 908 806 691</div>
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 640px) {
          .requestPage {
            padding: 12px 10px !important;
          }

          .requestHero {
            padding: 14px 14px 16px !important;
            margin-bottom: 10px !important;
            border-radius: 14px !important;
          }

          .requestLogo {
            width: 150px !important;
            max-width: 54vw !important;
            height: 42px !important;
            margin-bottom: 10px !important;
          }

          .requestTitle {
            font-size: 21px !important;
            line-height: 1.18 !important;
          }

          .requestSubtitle {
            margin-top: 7px !important;
            font-size: 13px !important;
            line-height: 1.35 !important;
          }
        }
      `}</style>
    </main>
  )
}
