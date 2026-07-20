'use client'

import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const closeButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  width: 38,
  height: 38,
  borderRadius: 12,
  cursor: 'pointer',
  fontSize: 20,
  lineHeight: 1,
  color: '#0f172a',
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          padding: 22,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Zavrieť okno" style={closeButtonStyle}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
