import Link from 'next/link'

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -top-20 right-0 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-20 grid-mesh" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.12em]">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Produccion 3D centralizada
        </div>

        <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
          Gestion operativa para
          <span className="text-cyan-300"> impresion 3D </span>
          sin friccion.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/80">
          Ordenes, cotizaciones, clientes e inventario de impresoras en una interfaz clara y rapida para equipos reales.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Entrar al Panel
          </Link>
          <Link
            href="/track/ejemplo"
            className="rounded-xl border border-white/25 bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20"
          >
            Rastrear Pedido
          </Link>
        </div>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-white/70">Rendimiento</p>
            <p className="mt-1 text-2xl font-semibold">Dashboard en tiempo real</p>
          </article>
          <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-white/70">Escala</p>
            <p className="mt-1 text-2xl font-semibold">Flujo para multiples ordenes</p>
          </article>
          <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-white/70">Calidad</p>
            <p className="mt-1 text-2xl font-semibold">UI limpia para operacion diaria</p>
          </article>
        </section>
      </div>
    </main>
  )
}
