'use client'

import { useEffect, useState, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'

// Memoizar la navegación para evitar re-renderizados innecesarios
const NavigationItem = memo(({ item, isActive }: { item: { name: string; href: string; icon: string }, isActive: boolean }) => {
  return (
    <Link
      href={item.href}
      prefetch={true}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <span className="text-xl">{item.icon}</span>
      <span>{item.name}</span>
    </Link>
  )
})

NavigationItem.displayName = 'NavigationItem'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    // Limpiar token de prueba
    localStorage.removeItem('test-token')
    // Limpiar cookie de sesión
    document.cookie = 'sb-localhost-auth-token=; path=/; max-age=0'
    // Cerrar sesión de Supabase
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Órdenes', href: '/dashboard/orders', icon: '📦' },
    { name: 'Cotizaciones', href: '/dashboard/quotes', icon: '💼' },
    { name: 'Plantillas', href: '/dashboard/quotes/templates', icon: '📝' },
    { name: 'Kanban', href: '/dashboard/kanban', icon: '📋' },
    { name: 'Impresoras', href: '/dashboard/printers', icon: '🖨️' },
    { name: 'Búsqueda', href: '/dashboard/search', icon: '🔍' },
    { name: 'Estadísticas', href: '/dashboard/stats', icon: '📊' },
    { name: 'Calculadora', href: '/dashboard/calculadora', icon: '🧮' },
    { name: 'Productos', href: '/dashboard/products', icon: '🎨' },
    { name: 'Configuración', href: '/dashboard/settings', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border shadow-lg transition-colors duration-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="DOFER" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-primary">DOFER Panel</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Sistema operativo</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <NavigationItem
                  key={item.name}
                  item={item}
                  isActive={isActive}
                />
              )
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {userEmail || 'Usuario'}
                </p>
                <p className="text-xs text-muted-foreground">Administrador</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Cerrar sesión"
              >
                🚪
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64">
        {/* Header */}
        <header className="bg-card border-b border-border shadow-sm transition-colors duration-200">
          <div className="px-8 py-4">
            <h2 className="text-2xl font-semibold text-foreground transition-colors duration-200">
              {navigation.find(item => item.href === pathname)?.name || 'Dashboard'}
            </h2>
          </div>
        </header>

        {/* Page content */}
        <main className="p-8 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  )
}
