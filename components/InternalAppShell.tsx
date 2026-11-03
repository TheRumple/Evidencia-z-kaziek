'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardSignature, FileText, Home, Inbox, LogOut, MoreHorizontal, StickyNote, Users, Warehouse } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { supabase } from '@/lib/supabase'

const publicPaths = ['/login', '/reset-password', '/customer-portal', '/moje-poziadavky', '/ziadost', '/kancelaria']

const mainLinks = [
  { href: '/', label: 'Domov', icon: Home },
  { href: '/poznamky', label: 'Poznámky', icon: StickyNote },
  { href: '/zakazky', label: 'Zákazky', icon: BriefcaseBusiness, badge: 'orders' as const },
  { href: '/admin/requests', label: 'Žiadosti', icon: Inbox, badge: 'requests' as const },
  { href: '/kalendar', label: 'Kalendár', icon: CalendarDays },
  { href: '/obhliadky', label: 'Obhliadky', icon: ClipboardCheck },
  { href: '/cenove-ponuky', label: 'Ponuky', icon: FileText },
  { href: '/sklad', label: 'Sklad', icon: Warehouse },
  { href: '/odovzdavacie-protokoly', label: 'Protokoly', icon: ClipboardSignature },
  { href: '/zakaznici', label: 'Zákazníci', icon: Users },
]

const moreLinks = [
  { href: '/revizie', label: 'Revízie' },
  { href: '/fakturovane', label: 'Fakturované' },
  { href: '/material', label: 'Na objednanie' },
  { href: '/kos', label: 'Kôš' },
]

export function InternalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [ordersCount, setOrdersCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const isPublic = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  useEffect(() => {
    if (isPublic) return
    let active = true
    async function loadCounts() {
      const [{ count: orderCount }, { count: requestCount }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('stav', ['nova', 'rozpracovana', 'caka', 'obhliadka', 'cenova_ponuka']),
        supabase.from('customer_requests').select('*', { count: 'exact', head: true }).eq('stav', 'na_schvalenie'),
      ])
      if (!active) return
      setOrdersCount(orderCount || 0)
      setRequestsCount(requestCount || 0)
    }
    void loadCounts()
    return () => { active = false }
  }, [isPublic, pathname])

  async function logout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isPublic) return children

  return <div className={`internalAppFrame ${expanded ? 'expanded' : 'compact'}`}>
    <aside className="globalSideMenu">
      <div className="globalSideBrand">
        <Link href="/" title="Domov"><BrandLogo size="sm" tone="light"/></Link>
        {expanded && <strong>ITspot</strong>}
        <button type="button" onClick={() => setExpanded((value) => !value)} title={expanded ? 'Zbaliť menu' : 'Rozbaliť menu'}>{expanded ? <ChevronLeft size={17}/> : <ChevronRight size={17}/>}</button>
      </div>
      <nav aria-label="Hlavná navigácia">
        {mainLinks.map((item) => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
          const badge = item.badge === 'orders' ? ordersCount : item.badge === 'requests' ? requestsCount : 0
          return <Link key={item.href} href={item.href} className={active ? 'active' : ''} title={item.label}><Icon size={18}/><span>{item.label}</span>{badge > 0 && <em>{badge}</em>}</Link>
        })}
        <details>
          <summary title="Viac"><MoreHorizontal size={18}/><span>Viac</span></summary>
          <div>{moreLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</div>
        </details>
      </nav>
      <button type="button" className="globalLogout" onClick={() => void logout()} disabled={loggingOut} title="Odhlásiť"><LogOut size={18}/><span>{loggingOut ? 'Odhlasujem' : 'Odhlásiť'}</span></button>
    </aside>
    <div className="internalAppContent">{children}</div>
    <style jsx global>{`
      .internalAppFrame{--rail:94px;min-height:100vh}.internalAppFrame.expanded{--rail:220px}.globalSideMenu{position:fixed;z-index:80;left:8px;top:8px;bottom:8px;width:var(--rail);box-sizing:border-box;padding:9px 7px;border:1px solid #dbe4ef;border-radius:12px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.14);display:flex;flex-direction:column;gap:9px;overflow:visible}.internalAppContent{min-width:0;margin-left:calc(var(--rail) + 8px)}.globalSideBrand{display:grid;justify-items:center;gap:6px;padding-bottom:7px;border-bottom:1px solid #e2e8f0}.internalAppFrame.expanded .globalSideBrand{grid-template-columns:auto 1fr auto;align-items:center;justify-items:start}.globalSideBrand>a{display:flex}.globalSideBrand strong{font-size:15px}.globalSideBrand button{width:42px;height:32px;border:1px solid #dbe4ef;border-radius:8px;background:#f8fafc;color:#334155;display:grid;place-items:center;cursor:pointer}.globalSideMenu nav{display:grid;gap:3px;overflow-y:auto;overflow-x:hidden}.globalSideMenu nav>a,.globalSideMenu summary{position:relative;min-height:50px;border:1px solid transparent;border-radius:9px;padding:6px 4px;color:#334155;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;cursor:pointer;box-sizing:border-box}.globalSideMenu nav>a span,.globalSideMenu summary span,.globalLogout span{max-width:76px;overflow:hidden;font-size:9px;font-weight:900;line-height:1.05;text-overflow:ellipsis;white-space:nowrap}.globalSideMenu nav>a:hover,.globalSideMenu summary:hover{background:#f1f5f9}.globalSideMenu nav>a.active{background:#0f172a;color:#fff}.globalSideMenu nav>a em{position:absolute;right:2px;top:2px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:9px;font-style:normal;font-weight:950;display:grid;place-items:center}.globalSideMenu details{position:relative}.globalSideMenu summary{list-style:none}.globalSideMenu summary::-webkit-details-marker{display:none}.globalSideMenu details>div{position:absolute;z-index:90;left:calc(100% + 8px);bottom:0;width:170px;padding:6px;border:1px solid #dbe4ef;border-radius:9px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.16);display:grid;gap:2px}.globalSideMenu details>div a{padding:8px 9px;border-radius:6px;color:#334155;text-decoration:none;font-size:12px;font-weight:850}.globalSideMenu details>div a:hover{background:#f1f5f9}.globalLogout{margin-top:auto;min-height:48px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;color:#475569;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}.internalAppFrame.expanded .globalSideMenu nav>a,.internalAppFrame.expanded .globalSideMenu summary,.internalAppFrame.expanded .globalLogout{min-height:40px;flex-direction:row;justify-content:flex-start;gap:9px;padding:8px 10px;text-align:left}.internalAppFrame.expanded .globalSideMenu nav>a span,.internalAppFrame.expanded .globalSideMenu summary span,.internalAppFrame.expanded .globalLogout span{max-width:none;font-size:12px}.internalAppFrame.expanded .globalSideMenu details>div{left:0;bottom:auto;top:100%;width:100%;box-sizing:border-box}@media(max-width:900px){.internalAppFrame{--rail:0px}.internalAppContent{margin-left:0;padding-top:76px}.globalSideMenu{left:6px;right:6px;top:6px;bottom:auto;width:auto;height:64px;padding:6px 8px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center}.globalSideBrand{display:flex;padding:0;border:0}.globalSideBrand button,.globalSideBrand strong{display:none}.globalSideMenu nav{display:flex;overflow-x:auto;overflow-y:hidden}.globalSideMenu nav>a,.globalSideMenu summary{width:66px;min-width:66px;min-height:50px}.globalSideMenu details>div{position:fixed;left:8px;right:8px;top:72px;bottom:auto;width:auto}.globalLogout{margin:0;width:48px;min-height:48px}.globalLogout span{display:none}}
    `}</style>
  </div>
}
