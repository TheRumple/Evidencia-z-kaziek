'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(true)

  useEffect(() => {
    const savedEmail = localStorage.getItem('itspot_saved_email')
    const savedRemember = localStorage.getItem('itspot_remember_email')

    if (savedRemember === 'false') {
      setRememberEmail(false)
    } else {
      setRememberEmail(true)
    }

    if (savedEmail) {
      setEmail(savedEmail)
    }

    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      window.location.href = '/'
    }
  }

  function handleRememberEmail(currentEmail: string) {
    if (rememberEmail) {
      localStorage.setItem('itspot_saved_email', currentEmail)
      localStorage.setItem('itspot_remember_email', 'true')
    } else {
      localStorage.removeItem('itspot_saved_email')
      localStorage.setItem('itspot_remember_email', 'false')
    }
  }

  async function handleSubmit() {
    setMessage('')

    if (!email || !password) {
      setMessage('Vyplň email a heslo.')
      return
    }

    handleRememberEmail(email)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Registrácia prebehla. Teraz sa prihlás.')
      setMode('login')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.href = '/'
  }

  async function handleForgotPassword() {
    setMessage('')

    if (!email) {
      setMessage('Najprv zadaj email pre obnovu hesla.')
      return
    }

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Na email sme poslali odkaz na obnovu hesla.')
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #e0f2fe, #f8fafc, #e0fdf4)',
    padding: 24,
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#0f172a',
  }

  const boxStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 520,
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(8px)',
    border: '1px solid #cbd5e1',
    borderRadius: 18,
    padding: 36,
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.12)',
  }

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'center',
  }

  const subtitleStyle: React.CSSProperties = {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 15,
    color: '#475569',
    lineHeight: 1.5,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #94a3b8',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: 15,
    boxSizing: 'border-box',
  }

  const primaryButtonStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: 12,
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  }

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  }

  const smallButtonStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  const textButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
    textAlign: 'left',
  }

  const messageStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#1e293b',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '10px 12px',
    lineHeight: 1.5,
  }

  return (
    <div style={pageStyle}>
      <div style={boxStyle}>
        <h1 style={titleStyle}>Evidencia zákaziek</h1>
        <div style={subtitleStyle}>Prihlásenie do systému</div>

        <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="Zadaj email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Heslo</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <input
                style={inputStyle}
                type={showPassword ? 'text' : 'password'}
                placeholder="Zadaj heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => {
                  const checked = e.target.checked
                  setRememberEmail(checked)

                  if (!checked) {
                    localStorage.removeItem('itspot_saved_email')
                    localStorage.setItem('itspot_remember_email', 'false')
                  } else {
                    localStorage.setItem('itspot_remember_email', 'true')
                    if (email) {
                      localStorage.setItem('itspot_saved_email', email)
                    }
                  }
                }}
              />
              Zapamätať email
            </label>

            <button type="button" style={textButtonStyle} onClick={handleForgotPassword}>
              Zabudnuté heslo?
            </button>
          </div>

          <button style={primaryButtonStyle} onClick={handleSubmit}>
            {mode === 'login' ? 'Prihlásiť sa' : 'Registrovať sa'}
          </button>

          <button
            style={secondaryButtonStyle}
            onClick={() =>
              setMode((prev) => (prev === 'login' ? 'register' : 'login'))
            }
          >
            {mode === 'login'
              ? 'Nemám účet – registrácia'
              : 'Mám účet – prihlásenie'}
          </button>

          {message ? <div style={messageStyle}>{message}</div> : null}

          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            Vytvorila spoločnosť <strong>ITspot s.r.o.</strong>
          </div>
        </div>
      </div>
    </div>
  )
}