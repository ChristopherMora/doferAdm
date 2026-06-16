'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import ThemeToggle from '@/components/ThemeToggle'
import { supabase } from '@/lib/supabase'

// Layout independiente del de /dashboard: panel reducido para afiliados,
// solo con lo que necesitan (registrar pedidos, ver su estado y sus
// comisiones). No reusa el array de navegación del dashboard a propósito.
const navigation = [
  { name: 'Mis pedidos', href: '/affiliate/orders', icon: '📦' },
  { name: 'Nuevo pedido', href: '/affiliate/orders/new', icon: '✨' },
  { name: 'Comisiones', href: '/affiliate/commissions', icon: '💵' },
  { name: 'Mi perfil', href: '/affiliate/profile', icon: '👤' },
]

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    document.cookie = 'sb-access-token=; path=/; max-age=0'
    document.cookie = 'sb-localhost-auth-token=; path=/; max-age=0'
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen grid-mesh transition-colors duration-200">
      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            <Image src="/logo.png" alt="DOFER" width={32} height={32} className="rounded-lg" />
            <div>
              <p className="text-sm font-bold leading-none">DOFER</p>
              <p className="text-xs text-muted-foreground">Portal de afiliados</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground/80'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border p-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex min-h-screen flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6">
            <button
              className="rounded-lg border border-border px-3 py-1.5 text-sm lg:hidden"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              ☰ Menú
            </button>
            <div className="flex-1" />
            <ThemeToggle />
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
