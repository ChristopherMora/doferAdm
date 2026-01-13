'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    { name: 'Kanban', href: '/dashboard/kanban', icon: '📋' },
    { name: 'Búsqueda', href: '/dashboard/search', icon: '🔍' },
    { name: 'Estadísticas', href: '/dashboard/stats', icon: '📊' },
    { name: 'Calculadora', href: '/dashboard/calculadora', icon: '🧮' },
    { name: 'Productos', href: '/dashboard/products', icon: '🎨' },
    { name: 'Configuración', href: '/dashboard/settings', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-indigo-600">DOFER Panel</h1>
            <p className="text-sm text-gray-500 mt-1">Sistema operativo</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </a>
              )
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500">Administrador</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
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
        <header className="bg-white shadow-sm">
          <div className="px-8 py-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              {navigation.find(item => item.href === pathname)?.name || 'Dashboard'}
            </h2>
          </div>
        </header>

        {/* Page content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
