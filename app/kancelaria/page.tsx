'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'
import type { Order } from '@/lib/dashboard-types'
import { supabase } from '@/lib/supabase'

type WeatherState = {
  temperature: number | null
  windSpeed: number | null
  code: number | null
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat('sk-SK', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getWeatherLabel(code: number | null) {
  if (code === null) return 'Počasie sa načítava'
  if ([0].includes(code)) return 'Jasno'
  if ([1, 2, 3].includes(code)) return 'Polooblačno'
  if ([45, 48].includes(code)) return 'Hmla'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Mrholenie'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Dážď'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Sneh'
  if ([95, 96, 99].includes(code)) return 'Búrka'
  return 'Počasie'
}

export default function OfficeDashboardPage() {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [todayPlansCount, setTodayPlansCount] = useState(0)
  const [weather, setWeather] = useState<WeatherState>({ temperature: null, windSpeed: null, code: null })
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.user) {
        window.location.href = '/login'
        return
      }

      setUserId(session.user.id)
      setCheckingAuth(false)
    }

    void checkSession()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!userId) return

    void loadData(userId)
    const timer = window.setInterval(() => {
      void loadData(userId)
    }, 30000)

    return () => window.clearInterval(timer)
  }, [userId])

  useEffect(() => {
    void loadWeather()
    const timer = window.setInterval(() => {
      void loadWeather()
    }, 15 * 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  async function loadData(currentUserId: string) {
    const today = getTodayDate()

    const [ordersResult, pendingResult, plansResult] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', currentUserId),
      supabase.from('customer_requests').select('*', { count: 'exact', head: true }).eq('stav', 'na_schvalenie'),
      supabase
        .from('calendar_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('plan_date', today),
    ])

    if (!ordersResult.error) setOrders((ordersResult.data || []) as Order[])
    if (!pendingResult.error && pendingResult.count !== null) setPendingRequestsCount(pendingResult.count)
    if (!plansResult.error && plansResult.count !== null) setTodayPlansCount(plansResult.count)
    setLastRefresh(new Date())
  }

  async function loadWeather() {
    try {
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=48.7395&longitude=19.1535&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FBratislava'
      )
      const data = await response.json()
      setWeather({
        temperature: typeof data?.current?.temperature_2m === 'number' ? data.current.temperature_2m : null,
        windSpeed: typeof data?.current?.wind_speed_10m === 'number' ? data.current.wind_speed_10m : null,
        code: typeof data?.current?.weather_code === 'number' ? data.current.weather_code : null,
      })
    } catch {
      setWeather({ temperature: null, windSpeed: null, code: null })
    }
  }

  const stats = useMemo(() => {
    return {
      active: orders.filter((order) => ['nova', 'rozpracovana', 'caka'].includes(order.stav)).length,
      inProgress: orders.filter((order) => order.stav === 'rozpracovana').length,
      waiting: orders.filter((order) => order.stav === 'caka').length,
      invoiced: orders.filter((order) => order.stav === 'odovzdana').length,
      overdue: orders.filter((order) => {
        if (!order.termin || ['hotova', 'odovzdana', 'stornovana'].includes(order.stav)) return false
        return order.termin < getTodayDate()
      }).length,
    }
  }, [orders])

  if (checkingAuth) {
    return <div style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Načítavam...</div>
  }

  return (
    <main className="officeScreen">
      <style jsx global>{`
        html,
        body {
          background: #060a12;
        }

        .officeScreen {
          min-height: 100vh;
          padding: 22px;
          color: #fff;
          font-family: Arial, Helvetica, sans-serif;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 82% 8%, rgba(132, 204, 22, 0.28), transparent 28%),
            radial-gradient(circle at 12% 86%, rgba(59, 130, 246, 0.16), transparent 30%),
            linear-gradient(135deg, #05070d 0%, #101827 56%, #1f2d17 100%);
        }

        .officeScreen::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent 78%);
        }

        .officeShell {
          position: relative;
          z-index: 1;
          max-width: 1380px;
          min-height: calc(100vh - 44px);
          margin: 0 auto;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 18px;
        }

        .officeHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .officeTopRight {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(226, 232, 240, 0.82);
          font-size: 13px;
          font-weight: 800;
        }

        .officeGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
          gap: 18px;
          align-items: stretch;
        }

        .glassPanel {
          border: 1px solid rgba(148, 163, 184, 0.24);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
            rgba(15, 23, 42, 0.62);
          box-shadow: 0 26px 60px rgba(0, 0, 0, 0.34);
          border-radius: 22px;
          backdrop-filter: blur(18px);
        }

        .clockPanel {
          padding: 30px;
          display: grid;
          align-content: space-between;
          gap: 20px;
          min-height: 430px;
          position: relative;
          overflow: hidden;
        }

        .clockPanel::after {
          content: '';
          position: absolute;
          right: -90px;
          bottom: -120px;
          width: 340px;
          height: 340px;
          border-radius: 999px;
          border: 42px solid rgba(132, 204, 22, 0.12);
          box-shadow: 0 0 80px rgba(132, 204, 22, 0.12);
        }

        .clockValue {
          font-size: clamp(72px, 9vw, 142px);
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: 0;
        }

        .dateValue {
          margin-top: 12px;
          color: rgba(226, 232, 240, 0.82);
          font-size: clamp(22px, 2.4vw, 36px);
          font-weight: 900;
          text-transform: capitalize;
        }

        .heroText {
          max-width: 720px;
          color: rgba(226, 232, 240, 0.72);
          font-size: 18px;
          line-height: 1.45;
          font-weight: 700;
        }

        .weatherPanel {
          padding: 24px;
          display: grid;
          gap: 16px;
          border-color: rgba(132, 204, 22, 0.32);
        }

        .weatherTemp {
          font-size: clamp(56px, 6vw, 92px);
          font-weight: 900;
          line-height: 1;
        }

        .weatherLabel {
          color: #a3e635;
          font-size: 20px;
          font-weight: 900;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .statusGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .statCard {
          min-height: 142px;
          border-radius: 20px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background:
            linear-gradient(160deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.035)),
            rgba(255, 255, 255, 0.06);
          display: grid;
          align-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .statCard::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 5px;
          background: var(--accent, #64748b);
        }

        .statCard::after {
          content: '';
          position: absolute;
          right: -34px;
          top: -34px;
          width: 104px;
          height: 104px;
          border-radius: 999px;
          background: var(--accentGlow, rgba(148, 163, 184, 0.12));
        }

        .statLabel {
          color: rgba(226, 232, 240, 0.76);
          font-size: 15px;
          font-weight: 900;
        }

        .statValue {
          font-size: clamp(42px, 5vw, 72px);
          line-height: 0.95;
          font-weight: 900;
        }

        .highlightCard {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.95), rgba(101, 163, 13, 0.88));
          color: #111827;
          border-color: rgba(190, 242, 100, 0.76);
          --accent: #ecfccb;
          --accentGlow: rgba(236, 252, 203, 0.32);
        }

        .highlightCard .statLabel {
          color: rgba(17, 24, 39, 0.78);
        }

        .footerBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          color: rgba(226, 232, 240, 0.7);
          font-size: 13px;
          font-weight: 800;
        }

        .officeLink {
          color: #ecfccb;
          text-decoration: none;
          border: 1px solid rgba(190, 242, 100, 0.34);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(132, 204, 22, 0.1);
        }

        @media (max-width: 980px) {
          .officeGrid,
          .statGrid,
          .statusGrid {
            grid-template-columns: 1fr;
          }

          .officeHeader,
          .footerBar {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="officeShell">
        <header className="officeHeader">
          <BrandLogo size="lg" tone="dark" label />
          <div className="officeTopRight">
            <span>Kancelársky prehľad</span>
            <span>Automatický refresh 30 s</span>
          </div>
        </header>

        <section className="officeGrid">
          <div className="glassPanel clockPanel">
            <div>
              <div className="clockValue">{formatClock(now)}</div>
              <div className="dateValue">{formatLongDate(now)}</div>
            </div>
            <div className="heroText">
              ITspot servisné centrum. Prehľad dostupnosti práce, nových požiadaviek a stavu zákaziek bez zobrazenia citlivých údajov.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div className="glassPanel weatherPanel">
              <div>
                <div style={{ color: 'rgba(226,232,240,0.72)', fontWeight: 900, marginBottom: 8 }}>Počasie Banská Bystrica</div>
                <div className="weatherTemp">{weather.temperature === null ? '--' : Math.round(weather.temperature)}°C</div>
              </div>
              <div>
                <div className="weatherLabel">{getWeatherLabel(weather.code)}</div>
                <div style={{ color: 'rgba(226,232,240,0.72)', marginTop: 6, fontWeight: 800 }}>
                  Vietor {weather.windSpeed === null ? '-' : `${Math.round(weather.windSpeed)} km/h`}
                </div>
              </div>
            </div>

            <div className="statGrid">
              <div className="statCard highlightCard">
                <div className="statLabel">Nové žiadosti</div>
                <div className="statValue">{pendingRequestsCount}</div>
              </div>
              <div className="statCard" style={{ '--accent': '#38bdf8', '--accentGlow': 'rgba(56, 189, 248, 0.18)' } as CSSProperties}>
                <div className="statLabel">Dnešný plán</div>
                <div className="statValue">{todayPlansCount}</div>
              </div>
              <div className="statCard" style={{ '--accent': '#fb7185', '--accentGlow': 'rgba(251, 113, 133, 0.18)' } as CSSProperties}>
                <div className="statLabel">Po termíne</div>
                <div className="statValue">{stats.overdue}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="statusGrid">
          <div className="statCard" style={{ '--accent': '#a3e635', '--accentGlow': 'rgba(163, 230, 53, 0.16)' } as CSSProperties}>
            <div className="statLabel">Aktívne zákazky</div>
            <div className="statValue">{stats.active}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#fbbf24', '--accentGlow': 'rgba(251, 191, 36, 0.17)' } as CSSProperties}>
            <div className="statLabel">Rozpracované</div>
            <div className="statValue">{stats.inProgress}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#fb923c', '--accentGlow': 'rgba(251, 146, 60, 0.17)' } as CSSProperties}>
            <div className="statLabel">Čaká na materiál</div>
            <div className="statValue">{stats.waiting}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#22c55e', '--accentGlow': 'rgba(34, 197, 94, 0.17)' } as CSSProperties}>
            <div className="statLabel">Fakturované zákazky</div>
            <div className="statValue">{stats.invoiced}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#84cc16', '--accentGlow': 'rgba(132, 204, 22, 0.2)' } as CSSProperties}>
            <div className="statLabel">Stav systému</div>
            <div className="statValue" style={{ color: '#a3e635' }}>OK</div>
          </div>
        </section>

        <footer className="footerBar">
          <div>Posledná aktualizácia: {lastRefresh ? formatClock(lastRefresh) : '-'}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="officeLink" href="/">
              Správa zákaziek
            </Link>
            <Link className="officeLink" href="/admin/requests">
              Žiadosti z portálu
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
