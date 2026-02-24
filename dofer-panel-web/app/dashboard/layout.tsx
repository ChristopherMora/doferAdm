'use client'

import { useEffect, useState, memo, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api'
import ThemeToggle from '@/components/ThemeToggle'

interface OrderStats {
  urgent_orders: number
  total_orders: number
  orders_by_status?: Record<string, number>
}

// Componente de breadcrumbs para navegación contextual
const Breadcrumbs = memo(({ pathname }: { pathname: string }) => {
  const segments = pathname.split('/').filter(Boolean)
  
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
      <Link href="/dashboard" className="hover:text-foreground transition-colors">
        Inicio
      </Link>
      {segments.slice(1).map((segment, index) => {
        const href = '/' + segments.slice(0, index + 2).join('/')
        const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
        const isLast = index === segments.length - 2
        
        return (
          <span key={href} className="flex items-center gap-2">
            <span className="text-muted-foreground/50">/</span>
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
})

Breadcrumbs.displayName = 'Breadcrumbs'

// Memoizar la navegación para evitar re-renderizados innecesarios
const NavigationItem = memo(({ item, isActive, isExpanded, onToggle, searchTerm, onClose, badge }: { 
  item: { name: string; href?: string; icon: string; shortcut?: string; subItems?: Array<{ name: string; href: string; icon: string }> }, 
  isActive: boolean,
  isExpanded?: boolean,
  onToggle?: () => void,
  searchTerm?: string,
  onClose?: () => void,
  badge?: number
}) => {
  const pathname = usePathname()
  
  // Filtrar subItems si hay término de búsqueda
  const filteredSubItems = item.subItems?.filter(sub => 
    searchTerm ? sub.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
  )
  
  // Si hay búsqueda y no hay coincidencias, no mostrar este item
  if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase()) && (!filteredSubItems || filteredSubItems.length === 0)) {
    return null
  }
  
  if (item.subItems) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] ${
            isActive
              ? 'bg-primary/10 text-primary font-medium shadow-sm'
              : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
          }`}
          title={`${isActive ? 'Contraer' : 'Expandir'} ${item.name}`}
          aria-expanded={isExpanded}
          aria-label={`${item.name}${badge ? ` - ${badge} pendientes` : ''}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{item.icon}</span>
            <span>{item.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {badge !== undefined && badge > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded-full">
                {badge}
              </span>
            )}
            <span className={`text-sm transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
          </div>
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="ml-6 space-y-1 border-l-2 border-border pl-2 py-1">
            {filteredSubItems?.map((subItem) => {
              const isSubActive = pathname === subItem.href
              return (
                <Link
                  key={subItem.name}
                  href={subItem.href}
                  prefetch={true}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] ${
                    isSubActive
                      ? 'bg-primary/10 text-primary font-medium shadow-sm'
                      : 'text-foreground/60 hover:bg-accent hover:text-accent-foreground'
                  }`}
                  title={subItem.name}
                >
                  <span>{subItem.icon}</span>
                  <span>{subItem.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={item.href!}
      prefetch={true}
      onClick={onClose}
      className={`group flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] ${
        isActive
          ? 'bg-primary/10 text-primary font-medium shadow-sm'
          : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
      }`}
      title={item.name}
      aria-label={`${item.name}${badge ? ` - ${badge} pendientes` : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{item.icon}</span>
        <span>{item.name}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded-full">
            {badge}
          </span>
        )}
        {item.shortcut && (
          <kbd className="hidden group-hover:inline-flex px-2 py-1 text-xs font-mono bg-muted rounded opacity-60">
            {item.shortcut}
          </kbd>
        )}
      </div>
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
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [orderStats, setOrderStats] = useState<{ urgent: number; new: number; total: number }>({ urgent: 0, new: 0, total: 0 })
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean | undefined>>({})

  const autoExpandedSections = useMemo<Record<string, boolean>>(() => ({
    'Órdenes': pathname.includes('/orders') || pathname.includes('/kanban') || pathname.includes('/search'),
    'Cotizaciones': pathname.includes('/quotes'),
    'Configuración':
      pathname.includes('/printers') ||
      pathname.includes('/products') ||
      pathname.includes('/calculadora') ||
      pathname.includes('/settings'),
  }), [pathname])

  const toggleSection = useCallback((sectionName: string) => {
    setExpandedSections((prev) => {
      const current = prev[sectionName] ?? autoExpandedSections[sectionName] ?? false
      return { ...prev, [sectionName]: !current }
    })
  }, [autoExpandedSections])

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si está en un input, textarea o contenteditable
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      // Cmd/Ctrl + K para búsqueda rápida (funciona en cualquier lugar)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
        return
      }
      
      // / para enfocar búsqueda (solo fuera de inputs)
      if (e.key === '/' && !isInputField) {
        e.preventDefault()
        setShowSearch(true)
        return
      }
      
      // Cmd/Ctrl + D para toggle dark mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        const isDark = document.documentElement.classList.contains('dark')
        if (isDark) {
          document.documentElement.classList.remove('dark')
          localStorage.setItem('theme', 'light')
        } else {
          document.documentElement.classList.add('dark')
          localStorage.setItem('theme', 'dark')
        }
        return
      }
      
      // Escape para cerrar búsqueda
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
        setSearchTerm('')
        return
      }
      
      // Atajos numéricos Cmd/Ctrl + 1-6 para navegación
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        e.preventDefault()
        const routes = [
          '/dashboard', 
          '/dashboard/orders', 
          '/dashboard/quotes', 
          '/dashboard/customers', 
          '/dashboard/kanban',
          '/dashboard/stats'
        ]
        const index = parseInt(e.key) - 1
        if (routes[index]) router.push(routes[index])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router, showSearch])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      }
    }
    getUser()
    
    // Cargar stats de órdenes
    const loadOrderStats = async () => {
      try {
        const data = await apiClient.get<OrderStats>('/orders/stats')
        setOrderStats({
          urgent: data.urgent_orders || 0,
          new: data.orders_by_status?.new || 0,
          total: data.total_orders || 0
        })
      } catch (error) {
        console.error('Error loading order stats:', error)
      }
    }
    loadOrderStats()
    
    // Actualizar stats cada minuto
    const interval = setInterval(loadOrderStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    // Limpiar token de prueba
    localStorage.removeItem('test-token')
    // Limpiar cookie de sesión
    document.cookie = 'sb-access-token=; path=/; max-age=0'
    document.cookie = 'sb-localhost-auth-token=; path=/; max-age=0'
    // Cerrar sesión de Supabase
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', shortcut: '⌘1' },
    { 
      name: 'Órdenes', 
      icon: '📦',
      shortcut: '⌘2',
      subItems: [
        { name: 'Lista', href: '/dashboard/orders', icon: '📋' },
        { name: 'Kanban', href: '/dashboard/kanban', icon: '🎯' },
        { name: 'Búsqueda', href: '/dashboard/search', icon: '🔍' },
      ]
    },
    { 
      name: 'Cotizaciones', 
      icon: '💼',
      shortcut: '⌘3',
      subItems: [
        { name: 'Nueva', href: '/dashboard/quotes', icon: '✨' },
        { name: 'Plantillas', href: '/dashboard/quotes/templates', icon: '📝' },
      ]
    },
    { name: 'Clientes', href: '/dashboard/customers', icon: '👥', shortcut: '⌘4' },
    { name: 'Estadísticas', href: '/dashboard/stats', icon: '📈', shortcut: '⌘5' },
    { 
      name: 'Configuración', 
      icon: '⚙️',
      shortcut: '⌘5',
      subItems: [
        { name: 'Impresoras', href: '/dashboard/printers', icon: '🖨️' },
        { name: 'Productos', href: '/dashboard/products', icon: '🎨' },
        { name: 'Calculadora', href: '/dashboard/calculadora', icon: '🧮' },
        { name: 'General', href: '/dashboard/settings', icon: '🔧' },
      ]
    },
  ]

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Búsqueda rápida modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-32">
          <div className="bg-card rounded-lg shadow-2xl w-full max-w-2xl border border-border animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar en el menú... (Esc para cerrar)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">Esc</kbd>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {navigation.map((item) => {
                if (item.subItems) {
                  const filteredSubs = item.subItems.filter(sub =>
                    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  if (filteredSubs.length > 0 || item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return (
                      <div key={item.name} className="mb-2">
                        <div className="px-3 py-2 text-sm font-medium text-muted-foreground">{item.icon} {item.name}</div>
                        {filteredSubs.map(sub => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => {
                              setShowSearch(false)
                              setSearchTerm('')
                            }}
                            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent transition-colors"
                          >
                            <span>{sub.icon}</span>
                            <span>{sub.name}</span>
                          </Link>
                        ))}
                      </div>
                    )
                  }
                } else if (item.href && item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setShowSearch(false)
                        setSearchTerm('')
                      }}
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.name}</span>
                      {item.shortcut && <kbd className="ml-auto px-2 py-1 text-xs font-mono bg-muted rounded">{item.shortcut}</kbd>}
                    </Link>
                  )
                }
                return null
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border shadow-lg transition-all duration-300 z-50 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="DOFER" width={48} height={48} className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-primary">DOFER Panel</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Sistema operativo</p>
              </div>
            </div>
          </div>

          {/* Búsqueda rápida button */}
          <div className="px-4 pt-4">
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-accent/50 hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground group"
              aria-label="Abrir búsqueda rápida (⌘K)"
            >
              <span className="text-lg">🔍</span>
              <span className="text-sm flex-1 text-left">Buscar...</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded group-hover:bg-background">⌘K</kbd>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto" aria-label="Navegación principal">
            {navigation.map((item) => {
              const isActive = item.href ? pathname === item.href : item.subItems?.some(sub => pathname === sub.href) || false
              const isExpanded = item.subItems ? (expandedSections[item.name] ?? autoExpandedSections[item.name] ?? false) : undefined
              
              // Agregar badges con contadores
              let badge: number | undefined = undefined
              if (item.name === 'Órdenes') {
                badge = orderStats.urgent + orderStats.new
              } else if (item.name === 'Dashboard') {
                badge = orderStats.urgent > 0 ? orderStats.urgent : undefined
              }
              
              return (
                <NavigationItem
                  key={item.name}
                  item={item}
                  isActive={isActive}
                  isExpanded={isExpanded}
                  onToggle={() => item.subItems && toggleSection(item.name)}
                  onClose={() => setIsMobileMenuOpen(false)}
                  badge={badge}
                />
              )
            })}
          </nav>

          {/* Atajos de teclado info */}
          <div className="px-4 py-2 border-t border-border/50">
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-2">
                <span>⌨️</span>
                <span>Atajos de teclado</span>
                <span className="ml-auto group-open:rotate-90 transition-transform">›</span>
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Buscar</span>
                  <kbd className="px-1.5 py-0.5 font-mono bg-muted rounded text-[10px]">⌘K</kbd>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Navegación rápida</span>
                  <kbd className="px-1.5 py-0.5 font-mono bg-muted rounded text-[10px]">⌘1-5</kbd>
                </div>
              </div>
            </details>
          </div>

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

      {/* Overlay para cerrar el menú en móvil */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="md:ml-64">
        {/* Header con breadcrumbs */}
        <header className="bg-card border-b border-border shadow-sm transition-colors duration-200 sticky top-0 z-40 backdrop-blur-sm bg-card/95">
          <div className="px-4 md:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Botón menú móvil */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={isMobileMenuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex-1 min-w-0">
                <h2 className="text-xl md:text-2xl font-semibold text-foreground transition-colors duration-200 truncate">
                  {navigation.find(item => item.href === pathname)?.name || 
                   navigation.flatMap(item => item.subItems || []).find(sub => sub.href === pathname)?.name || 
                   'Dashboard'}
                </h2>
                <div className="hidden md:block">
                  <Breadcrumbs pathname={pathname} />
                </div>
              </div>
              
              {/* Acciones rápidas */}
              <div className="flex items-center gap-2">
                <button
                  className="hidden md:block p-2 rounded-lg hover:bg-accent transition-colors"
                  title="Recargar página"
                  aria-label="Recargar página"
                  onClick={() => window.location.reload()}
                >
                  🔄
                </button>
                <Link
                  href="/dashboard/quotes"
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-base"
                  title="Nueva cotización"
                  aria-label="Crear nueva cotización"
                >
                  <span>✨</span>
                  <span className="font-medium hidden sm:inline">Nueva Cotización</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-8 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  )
}
