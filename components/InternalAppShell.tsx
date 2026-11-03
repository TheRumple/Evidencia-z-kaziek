'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BriefcaseBusiness, CalendarDays, ClipboardCheck, ClipboardSignature, FileText, Home, Inbox, LogOut, MoreHorizontal, PackageSearch, ReceiptText, ShieldCheck, StickyNote, Trash2, Users, Warehouse } from 'lucide-react'
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
  { href: '/revizie', label: 'Revízie', icon: ShieldCheck },
  { href: '/fakturovane', label: 'Fakturované', icon: ReceiptText },
  { href: '/material', label: 'Na objednanie', icon: PackageSearch },
  { href: '/kos', label: 'Kôš', icon: Trash2 },
]

export function InternalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ordersCount, setOrdersCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
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

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  async function logout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isPublic) return children

  return <div className="internalAppFrame">
    <aside className="globalSideMenu">
      <div className="globalSideBrand">
        <Link href="/" title="Domov"><BrandLogo size="sm" tone="dark"/></Link>
      </div>
      <nav aria-label="Hlavná navigácia">
        {mainLinks.map((item) => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
          const badge = item.badge === 'orders' ? ordersCount : item.badge === 'requests' ? requestsCount : 0
          return <Link key={item.href} href={item.href} className={active ? 'active' : ''} title={item.label}><Icon size={18}/><span>{item.label}</span>{badge > 0 && <em>{badge}</em>}</Link>
        })}
        <button type="button" className={`globalMoreButton ${moreOpen ? 'active' : ''}`} title="Viac" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal size={18}/><span>Viac</span></button>
      </nav>
      {moreOpen && <div className="globalMorePanel">{moreLinks.map((item) => {
        const Icon = item.icon
        return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}><Icon size={17}/><span>{item.label}</span></Link>
      })}</div>}
      <button type="button" className="globalLogout" onClick={() => void logout()} disabled={loggingOut} title="Odhlásiť"><LogOut size={18}/><span>{loggingOut ? 'Odhlasujem' : 'Odhlásiť'}</span></button>
    </aside>
    <div className="internalAppContent">{children}</div>
    <style jsx global>{`
      .internalAppFrame{--rail:94px;min-height:100vh}.globalSideMenu{position:fixed;z-index:80;left:8px;top:8px;bottom:8px;width:var(--rail);box-sizing:border-box;padding:9px 7px;border:1px solid #263247;border-radius:12px;background:linear-gradient(180deg,#0b1120 0%,#111827 100%);box-shadow:0 14px 34px rgba(2,6,23,.26);display:flex;flex-direction:column;gap:9px;overflow:visible;color:#e2e8f0}.internalAppContent{min-width:0;margin-left:calc(var(--rail) + 8px)}.globalSideBrand{display:grid;justify-items:center;padding-bottom:8px;border-bottom:1px solid #263247}.globalSideBrand>a{display:flex}.globalSideMenu nav{display:grid;gap:3px;overflow-y:auto;overflow-x:hidden;scrollbar-color:#334155 transparent}.globalSideMenu nav>a,.globalMoreButton{position:relative;min-height:50px;border:1px solid transparent;border-radius:9px;padding:6px 4px;color:#cbd5e1;background:transparent;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;cursor:pointer;box-sizing:border-box}.globalSideMenu nav>a span,.globalMoreButton span,.globalLogout span{max-width:76px;overflow:hidden;font-size:9px;font-weight:900;line-height:1.05;text-overflow:ellipsis;white-space:nowrap}.globalSideMenu nav>a:hover,.globalMoreButton:hover{background:#182235;color:#fff}.globalSideMenu nav>a.active,.globalMoreButton.active{background:#26351b;border-color:#4d7c0f;color:#fff;box-shadow:inset 3px 0 #84cc16}.globalSideMenu nav>a.active svg,.globalMoreButton.active svg{color:#a3e635}.globalSideMenu nav>a em{position:absolute;right:2px;top:2px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#334155;color:#fff;font-size:9px;font-style:normal;font-weight:950;display:grid;place-items:center}.globalSideMenu nav>a.active em{background:#65a30d;color:#fff}.globalMorePanel{position:fixed;z-index:120;left:calc(var(--rail) + 16px);bottom:68px;width:190px;padding:7px;border:1px solid #334155;border-radius:9px;background:#111827;box-shadow:0 14px 32px rgba(2,6,23,.32);display:grid;gap:3px}.globalMorePanel a{min-height:38px;padding:7px 9px;border-radius:7px;color:#cbd5e1;text-decoration:none;font-size:12px;font-weight:850;display:flex;align-items:center;gap:9px}.globalMorePanel a:hover{background:#26351b;color:#fff}.globalMorePanel a svg{color:#a3e635}.globalLogout{margin-top:auto;min-height:48px;border:1px solid #334155;border-radius:9px;background:#182235;color:#cbd5e1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}.globalLogout:hover{border-color:#64748b;background:#243044;color:#fff}@media(max-width:900px){.internalAppFrame{--rail:0px}.internalAppContent{margin-left:0;padding-top:76px}.globalSideMenu{left:6px;right:6px;top:6px;bottom:auto;width:auto;height:64px;padding:6px 8px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center}.globalSideBrand{display:flex;padding:0;border:0}.globalSideMenu nav{display:flex;overflow-x:auto;overflow-y:hidden}.globalSideMenu nav>a,.globalMoreButton{width:66px;min-width:66px;min-height:50px}.globalMorePanel{position:fixed;left:8px;right:8px;top:72px;bottom:auto;width:auto;grid-template-columns:repeat(2,minmax(0,1fr))}.globalLogout{margin:0;width:48px;min-height:48px}.globalLogout span{display:none}}
    `}</style>
  </div>
}
