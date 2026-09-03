'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MaintenanceRevision, Order } from '@/lib/dashboard-types'
import { supabase } from '@/lib/supabase'

type WeatherState = {
  temperature: number | null
  windSpeed: number | null
  code: number | null
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
  const [revisions, setRevisions] = useState<MaintenanceRevision[]>([])
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [customerUpdatesCount, setCustomerUpdatesCount] = useState(0)
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
    const [ordersResult, pendingResult, revisionsResult, updatesResult] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', currentUserId),
      supabase.from('customer_requests').select('*', { count: 'exact', head: true }).eq('stav', 'na_schvalenie'),
      supabase.from('maintenance_revisions').select('*').eq('user_id', currentUserId).eq('active', true),
      supabase
        .from('customer_order_updates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .is('seen_at', null),
    ])

    if (!ordersResult.error) setOrders((ordersResult.data || []) as Order[])
    if (!pendingResult.error && pendingResult.count !== null) setPendingRequestsCount(pendingResult.count)
    if (!revisionsResult.error) setRevisions((revisionsResult.data || []) as MaintenanceRevision[])
    if (!updatesResult.error && updatesResult.count !== null) setCustomerUpdatesCount(updatesResult.count)
    setLastRefresh(new Date())
  }

  async function loadWeather() {
    try {
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=48.4237&longitude=18.6407&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FBratislava'
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
    const activeStatuses = ['nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka']
    const openStatuses = [...activeStatuses, 'hotova']

    return {
      open: orders.filter((order) => openStatuses.includes(order.stav)).length,
      active: orders.filter((order) => activeStatuses.includes(order.stav)).length,
      inProgress: orders.filter((order) => order.stav === 'rozpracovana').length,
      quotes: orders.filter((order) => order.stav === 'cenova_ponuka').length,
      inspections: orders.filter((order) => order.stav === 'obhliadka').length,
      waiting: orders.filter((order) => order.stav === 'caka').length,
      invoiced: orders.filter((order) => order.stav === 'odovzdana').length,
      revisionsDue: revisions.filter((revision) => {
        if (!revision.next_due_date) return false
        const today = new Date(new Date().toISOString().slice(0, 10)).getTime()
        const due = new Date(revision.next_due_date).getTime()
        const days = Math.ceil((due - today) / 86400000)
        return days <= 30
      }).length,
    }
  }, [orders, revisions])

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
          height: 100vh;
          padding: 14px;
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
          min-height: calc(100vh - 28px);
          height: calc(100vh - 28px);
          margin: 0 auto;
          display: grid;
          grid-template-rows: 58px minmax(0, 1fr) 18px;
          gap: 8px;
        }

        .officeHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .officeLogo {
          width: clamp(190px, 16vw, 260px);
          height: 64px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 0 18px rgba(132, 204, 22, 0.32)) drop-shadow(0 12px 34px rgba(0, 0, 0, 0.34));
        }

        .officeLogo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: left center;
          display: block;
        }

        .officeGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(360px, 0.82fr);
          grid-template-rows: minmax(220px, 1fr) minmax(174px, 0.62fr);
          gap: 8px;
          align-items: stretch;
          min-height: 0;
        }

        .officeSideStack {
          display: grid;
          grid-template-rows: 68px 68px minmax(0, 1fr);
          gap: 8px;
          min-height: 0;
        }

        .glassPanel {
          border: 1px solid rgba(148, 163, 184, 0.24);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
            rgba(15, 23, 42, 0.62);
          box-shadow: 0 26px 60px rgba(0, 0, 0, 0.34);
          border-radius: 18px;
          backdrop-filter: blur(18px);
        }

        .clockPanel {
          padding: 20px 22px;
          display: grid;
          align-content: center;
          gap: 6px;
          min-height: 0;
          position: relative;
          overflow: hidden;
        }

        .clockPanel::after {
          content: '';
          position: absolute;
          right: -90px;
          bottom: -120px;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          border: 32px solid rgba(132, 204, 22, 0.12);
          box-shadow: 0 0 80px rgba(132, 204, 22, 0.12);
        }

        .clockValue {
          font-size: clamp(82px, 7.8vw, 128px);
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: 0;
        }

        .dateValue {
          margin-top: 6px;
          color: rgba(226, 232, 240, 0.82);
          font-size: clamp(21px, 2.1vw, 32px);
          font-weight: 900;
          text-transform: capitalize;
        }

        .requestBadge {
          min-width: 0;
          min-height: 0;
          border-radius: 16px;
          border: 1px solid rgba(190, 242, 100, 0.35);
          background:
            linear-gradient(135deg, rgba(132, 204, 22, 0.22), rgba(255, 255, 255, 0.06)),
            rgba(15, 23, 42, 0.72);
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 8px 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.24);
        }

        .requestBadge.hasRequests {
          border-color: rgba(254, 202, 202, 0.9);
          background:
            linear-gradient(135deg, rgba(239, 68, 68, 0.96), rgba(153, 27, 27, 0.94)),
            #ef4444;
          color: #fff;
          box-shadow: 0 18px 46px rgba(153, 27, 27, 0.42);
        }

        .requestBadgeLabel {
          color: rgba(226, 232, 240, 0.84);
          font-size: 13px;
          font-weight: 900;
        }

        .requestBadge.hasRequests .requestBadgeLabel {
          color: rgba(255, 255, 255, 0.88);
        }

        .requestBadgeText {
          margin-top: 3px;
          color: #a3e635;
          font-size: 12px;
          font-weight: 900;
        }

        .requestBadge.hasRequests .requestBadgeText {
          color: #fff;
        }

        .requestBadgeValue {
          color: #f8fafc;
          font-size: 46px;
          line-height: 0.95;
          font-weight: 900;
        }

        .weatherPanel {
          padding: 15px 16px;
          display: grid;
          align-content: center;
          gap: 8px;
          border-color: rgba(132, 204, 22, 0.32);
        }

        .weatherTemp {
          font-size: clamp(58px, 5.1vw, 82px);
          font-weight: 900;
          line-height: 1;
        }

        .weatherLabel {
          color: #a3e635;
          font-size: 19px;
          font-weight: 900;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .statusGrid {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(82px, 1fr));
          gap: 8px;
          min-height: 0;
        }

        .statCard {
          min-height: 0;
          height: auto;
          border-radius: 14px;
          padding: 8px 12px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background:
            linear-gradient(160deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.035)),
            rgba(255, 255, 255, 0.06);
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
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
          right: -26px;
          top: -30px;
          width: 86px;
          height: 86px;
          border-radius: 999px;
          background: var(--accentGlow, rgba(148, 163, 184, 0.12));
        }

        .statLabel {
          color: rgba(226, 232, 240, 0.76);
          font-size: 12px;
          font-weight: 900;
          line-height: 1.12;
          min-width: 0;
        }

        .statValue {
          position: relative;
          z-index: 1;
          font-size: clamp(40px, 3.7vw, 62px);
          line-height: 0.95;
          font-weight: 900;
          text-align: right;
          min-width: 70px;
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
          justify-content: center;
          align-items: center;
          color: rgba(226, 232, 240, 0.7);
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .officeGrid,
          .statGrid,
          .statusGrid {
            grid-template-columns: 1fr;
            grid-template-rows: none;
          }

          .officeHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .officeLogo {
            width: 180px;
            height: 48px;
          }

          .requestBadge {
            min-width: 0;
            width: 100%;
          }

        }
      `}</style>

      <div className="officeShell">
        <header className="officeHeader">
          <div className="officeLogo" aria-label="ITspot">
            <img src="/brand-logo-dark.png" alt="ITspot" />
          </div>
        </header>

        <section className="officeGrid">
          <div className="glassPanel clockPanel">
            <div>
              <div className="clockValue">{formatClock(now)}</div>
              <div className="dateValue">{formatLongDate(now)}</div>
            </div>
          </div>

          <div className="officeSideStack">
            <div className={`requestBadge ${pendingRequestsCount > 0 ? 'hasRequests' : ''}`}>
              <div>
                <div className="requestBadgeLabel">Nové žiadosti z portálu</div>
                <div className="requestBadgeText">
                  {pendingRequestsCount > 0 ? 'Čaká na spracovanie' : 'Bez novej žiadosti'}
                </div>
              </div>
              <div className="requestBadgeValue">{pendingRequestsCount}</div>
            </div>

            <div className={`requestBadge ${customerUpdatesCount > 0 ? 'hasRequests' : ''}`}>
              <div>
                <div className="requestBadgeLabel">Úpravy od zákazníkov</div>
                <div className="requestBadgeText">
                  {customerUpdatesCount > 0 ? 'Čaká na pozretie' : 'Bez novej úpravy'}
                </div>
              </div>
              <div className="requestBadgeValue">{customerUpdatesCount}</div>
            </div>

            <div className="glassPanel weatherPanel">
              <div>
                <div style={{ color: 'rgba(226,232,240,0.72)', fontWeight: 900, marginBottom: 8 }}>Počasie Nová Baňa</div>
                <div className="weatherTemp">{weather.temperature === null ? '--' : Math.round(weather.temperature)}°C</div>
              </div>
              <div>
                <div className="weatherLabel">{getWeatherLabel(weather.code)}</div>
                <div style={{ color: 'rgba(226,232,240,0.72)', marginTop: 6, fontWeight: 800 }}>
                  Vietor {weather.windSpeed === null ? '-' : `${Math.round(weather.windSpeed)} km/h`}
                </div>
                <div style={{ color: 'rgba(226,232,240,0.54)', marginTop: 4, fontSize: 12, fontWeight: 800 }}>
                  Aktualizácia {lastRefresh ? formatClock(lastRefresh) : '-'}
                </div>
              </div>
            </div>
          </div>

          <section className="statusGrid">
          <div className="statCard" style={{ '--accent': '#a3e635', '--accentGlow': 'rgba(163, 230, 53, 0.16)' } as CSSProperties}>
            <div className="statLabel">Zákazky</div>
            <div className="statValue">{stats.open}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#60a5fa', '--accentGlow': 'rgba(96, 165, 250, 0.17)' } as CSSProperties}>
            <div className="statLabel">Aktívne zákazky</div>
            <div className="statValue">{stats.active}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#fbbf24', '--accentGlow': 'rgba(251, 191, 36, 0.17)' } as CSSProperties}>
            <div className="statLabel">Rozpracované</div>
            <div className="statValue">{stats.inProgress}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#38bdf8', '--accentGlow': 'rgba(56, 189, 248, 0.18)' } as CSSProperties}>
            <div className="statLabel">Cenové ponuky</div>
            <div className="statValue">{stats.quotes}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#8b5cf6', '--accentGlow': 'rgba(139, 92, 246, 0.18)' } as CSSProperties}>
            <div className="statLabel">Obhliadky</div>
            <div className="statValue">{stats.inspections}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#fb923c', '--accentGlow': 'rgba(251, 146, 60, 0.17)' } as CSSProperties}>
            <div className="statLabel">Čaká na materiál</div>
            <div className="statValue">{stats.waiting}</div>
          </div>
          <div
            className="statCard"
            style={{
              '--accent': stats.revisionsDue > 0 ? '#ef4444' : '#84cc16',
              '--accentGlow': stats.revisionsDue > 0 ? 'rgba(239, 68, 68, 0.24)' : 'rgba(132, 204, 22, 0.16)',
              background:
                stats.revisionsDue > 0
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(153, 27, 27, 0.84))'
                  : undefined,
              color: stats.revisionsDue > 0 ? '#fff' : undefined,
            } as CSSProperties}
          >
            <div className="statLabel">Revízie do 30 dní</div>
            <div className="statValue">{stats.revisionsDue}</div>
          </div>
          <div className="statCard" style={{ '--accent': '#22c55e', '--accentGlow': 'rgba(34, 197, 94, 0.17)' } as CSSProperties}>
            <div className="statLabel">Zrealizované zákazky</div>
            <div className="statValue">{stats.invoiced}</div>
          </div>
          </section>
        </section>

        <footer className="footerBar">
          ITspot s.r.o. · Servisné centrum · Stav systému OK
        </footer>
      </div>
    </main>
  )
}
