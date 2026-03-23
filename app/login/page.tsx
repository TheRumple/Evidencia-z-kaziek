'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(true)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const savedEmail = localStorage.getItem('itspot_saved_email')
    const savedRemember = localStorage.getItem('itspot_remember_email')

    setRememberEmail(savedRemember !== 'false')

    if (savedEmail) {
      setEmail(savedEmail)
    }

    checkUser()
  }, [])

  useEffect(() => {
    if (rememberEmail) {
      localStorage.setItem('itspot_remember_email', 'true')
      localStorage.setItem('itspot_saved_email', email)
    } else {
      localStorage.setItem('itspot_remember_email', 'false')
      localStorage.removeItem('itspot_saved_email')
    }
  }, [email, rememberEmail])

  async function checkUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        router.replace('/')
        return
      }
    } finally {
      setCheckingSession(false)
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setMessage('')

    if (!email || !password) {
      setMessage('Vyplň email a heslo.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage('Nesprávny email alebo heslo.')
        return
      }

      router.replace('/')
    } catch {
      setMessage('Pri prihlasovaní nastala chyba. Skús to znova.')
    } finally {
      setLoading(false)
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily:
      'Inter, Arial, Helvetica, ui-sans-serif, system-ui, sans-serif',
    color: '#0f172a',
    background:
      'radial-gradient(circle at top left, rgba(59,130,246,0.20), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.14), transparent 26%), linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #ecfeff 100%)',
    position: 'relative',
    overflow: 'hidden',
  }

  const backgroundBlurOne: React.CSSProperties = {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(37,99,235,0.14)',
    filter: 'blur(70px)',
    top: -80,
    left: -80,
    pointerEvents: 'none',
  }

  const backgroundBlurTwo: React.CSSProperties = {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.12)',
    filter: 'blur(70px)',
    bottom: -60,
    right: -40,
    pointerEvents: 'none',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 460,
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.72)',
    borderRadius: 28,
    padding: 38,
    boxShadow: '0 30px 90px rgba(15, 23, 42, 0.14)',
    position: 'relative',
    zIndex: 1,
  }

  const loadingBoxStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 460,
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.75)',
    borderRadius: 24,
    padding: 36,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.14)',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  }

  const brandBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: 999,
    background: '#e2e8f0',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  }

  const titleStyle: React.CSSProperties = {
    margin: '18px 0 10px 0',
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: -0.9,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: '#475569',
  }

  const formStyle: React.CSSProperties = {
    display: 'grid',
    gap: 18,
    marginTop: 30,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#334155',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '15px 16px',
    borderRadius: 16,
    border: '1px solid #cbd5e1',
    background: 'rgba(255,255,255,0.96)',
    color: '#0f172a',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.03)',
  }

  const passwordRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 10,
  }

  const smallButtonStyle: React.CSSProperties = {
    padding: '0 16px',
    borderRadius: 16,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)',
  }

  const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 600,
  }

  const submitButtonStyle: React.CSSProperties = {
    minHeight: 56,
    borderRadius: 18,
    border: '1px solid #0f172a',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 800,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.75 : 1,
    boxShadow: '0 18px 38px rgba(15, 23, 42, 0.18)',
  }

  const messageStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#0f172a',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 16,
    padding: '12px 14px',
    lineHeight: 1.6,
  }

  const footerStyle: React.CSSProperties = {
    marginTop: 18,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 1.7,
  }

  if (checkingSession) {
    return (
      <div style={pageStyle}>
        <div style={backgroundBlurOne} />
        <div style={backgroundBlurTwo} />
        <div style={loadingBoxStyle}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#0f172a',
              marginBottom: 8,
            }}
          >
            ITspot s.r.o.
          </div>
          <div style={{ fontSize: 15, color: '#64748b' }}>
            Načítavam prihlásenie...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={backgroundBlurOne} />
      <div style={backgroundBlurTwo} />

      <div style={cardStyle}>
        <div style={brandBadgeStyle}>Prihlásenie do systému</div>
        <h1 style={titleStyle}>ITspot s.r.o.</h1>
        <p style={subtitleStyle}>
          Prihlás sa do interného systému evidencie zákaziek pomocou svojich
          prihlasovacích údajov.
        </p>

        <form style={formStyle} onSubmit={handleSubmit}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="Zadaj svoj email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>Heslo</label>
            <div style={passwordRowStyle}>
              <input
                style={inputStyle}
                type={showPassword ? 'text' : 'password'}
                placeholder="Zadaj svoje heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                style={smallButtonStyle}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Skryť' : 'Zobraziť'}
              </button>
            </div>
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
            />
            Zapamätať email
          </label>

          <button type="submit" style={submitButtonStyle} disabled={loading}>
            {loading ? 'Prihlasovanie...' : 'Prihlásiť sa'}
          </button>

          {message ? <div style={messageStyle}>{message}</div> : null}
        </form>

        <div style={footerStyle}>
          Vytvorila spoločnosť <strong>ITspot s.r.o.</strong>
        </div>
      </div>
    </div>
  )
}