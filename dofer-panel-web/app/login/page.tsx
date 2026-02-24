'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.session) {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Lax`
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesion'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute -top-28 -left-16 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -top-16 right-0 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-20 grid-mesh" />

      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-8 lg:px-8 lg:py-12">
        <div className="grid min-h-[88vh] items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-3xl border border-cyan-200/25 bg-slate-900/90 p-8 text-slate-100 shadow-2xl shadow-cyan-950/45 backdrop-blur lg:p-10">
            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-cyan-100/35 bg-cyan-200/10 px-3 py-1 text-xs uppercase tracking-[0.12em] text-cyan-50">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Plataforma operativa
                </div>

                <h1 className="mt-6 text-4xl font-bold leading-tight lg:text-5xl">
                  DOFER Panel
                </h1>
                <p className="mt-4 max-w-md text-slate-200">
                  Controla ordenes, cotizaciones, impresoras y clientes desde un solo tablero.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 mt-10">
                <div className="rounded-xl border border-slate-200/20 bg-slate-800/55 p-4">
                  <p className="text-xs text-slate-300">Operacion</p>
                  <p className="mt-1 text-xl font-semibold">En linea</p>
                </div>
                <div className="rounded-xl border border-slate-200/20 bg-slate-800/55 p-4">
                  <p className="text-xs text-slate-300">Modulos</p>
                  <p className="mt-1 text-xl font-semibold">8 activos</p>
                </div>
                <div className="rounded-xl border border-slate-200/20 bg-slate-800/55 p-4">
                  <p className="text-xs text-slate-300">Enfoque</p>
                  <p className="mt-1 text-xl font-semibold">Produccion</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200/85 bg-white/95 p-7 shadow-2xl shadow-slate-950/10 backdrop-blur lg:p-9">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <Image
                    src="/logo.png"
                    alt="DOFER"
                    width={88}
                    height={88}
                    className="h-20 w-20 rounded-2xl bg-white p-1 shadow-md"
                  />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Iniciar sesion</h2>
                <p className="mt-1 text-sm text-muted-foreground">Accede a tu panel administrativo</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                    placeholder="admin@dofer.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                    Contrasena
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Iniciando sesion...' : 'Entrar al panel'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/" className="text-sm text-primary hover:text-primary/80">
                  Volver al inicio
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
