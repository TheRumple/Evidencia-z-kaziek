'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALL_DISMISSED_KEY = 'itspot_install_prompt_dismissed'

function isIosDevice() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
}

export default function PwaInstallPrompt() {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const isIos = useMemo(() => isIosDevice(), [])
  const isCustomerPage = pathname === '/ziadost' || pathname === '/moje-poziadavky'

  useEffect(() => {
    if (!isCustomerPage) return
    if (isStandaloneMode()) return
    if (window.localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true') return

    const timer = window.setTimeout(() => {
      if (isIosDevice()) setVisible(true)
    }, 1800)

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    }
  }, [isCustomerPage])

  async function installApp() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
      setInstallEvent(null)
    }
  }

  function dismissPrompt() {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
    setVisible(false)
  }

  if (!visible || !isCustomerPage) return null

  return (
    <div
      role="dialog"
      aria-label="Pridať ITspot na plochu"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 14,
        zIndex: 1600,
        maxWidth: 420,
        margin: '0 auto',
        border: '1px solid rgba(132, 204, 22, 0.34)',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(8, 15, 29, 0.98), rgba(15, 23, 42, 0.96))',
        color: '#e5e7eb',
        boxShadow: '0 22px 60px rgba(0, 0, 0, 0.42)',
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '46px 1fr',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <img
        src="/app-icon.png"
        alt=""
        style={{ width: 46, height: 46, borderRadius: 12, display: 'block' }}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>Pridať ITspot na plochu</div>
        <div style={{ marginTop: 3, color: '#a7b0c0', fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>
          {isIos ? 'Na iPhone kliknite na Zdieľať a potom Pridať na plochu.' : 'Otvoríte ako aplikáciu bez hľadania stránky v prehliadači.'}
        </div>
        <div style={{ marginTop: 9, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isIos && installEvent && (
            <button
              type="button"
              onClick={() => void installApp()}
              style={{
                border: '1px solid #84cc16',
                borderRadius: 10,
                background: '#84cc16',
                color: '#111827',
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Nainštalovať
            </button>
          )}
          <button
            type="button"
            onClick={dismissPrompt}
            style={{
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 10,
              background: 'transparent',
              color: '#cbd5e1',
              padding: '7px 10px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  )
}
