'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    checkRecoverySession()
  }, [])

  async function checkRecoverySession() {
    const hash = window.location.hash
    const search = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = search.get('access_token')
    const refreshToken = search.get('refresh_token')

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        setMessage('Nepodarilo sa overiť odkaz na obnovu hesla.')
        return
      }
    }

    setReady(true)
  }

  async function handleUpdatePassword() {
    setMessage('')

    if (!password || !confirmPassword) {
      setMessage('Vyplň obe polia.')
      return
    }

    if (password.length < 6) {
      setMessage('Heslo musí mať aspoň 6 znakov.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Heslá sa nezhodujú.')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Heslo bolo úspešne zmenené. Teraz sa môžeš prihlásiť.')
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
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
        <h1 style={titleStyle}>Obnova hesla</h1>
        <div style={subtitleStyle}>Zadaj nové heslo pre svoj účet</div>

        {!ready ? (
          <div style={{ marginTop: 24, ...messageStyle }}>
            Overujem odkaz na obnovu hesla...
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            <div>
              <label style={labelStyle}>Nové heslo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <input
                  style={inputStyle}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Zadaj nové heslo"
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

            <div>
              <label style={labelStyle}>Potvrď nové heslo</label>
              <input
                style={inputStyle}
                type={showPassword ? 'text' : 'password'}
                placeholder="Potvrď nové heslo"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button style={primaryButtonStyle} onClick={handleUpdatePassword}>
              Uložiť nové heslo
            </button>

            {message ? <div style={messageStyle}>{message}</div> : null}
          </div>
        )}
      </div>
    </div>
  )
}