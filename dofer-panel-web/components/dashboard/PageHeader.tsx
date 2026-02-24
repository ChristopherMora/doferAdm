import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  actions?: ReactNode
  className?: string
}

export default function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <section
      className={cn(
        'panel-surface-strong rounded-2xl px-5 py-5 md:px-7 md:py-6',
        'bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 text-white',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-white/85">
              {badge}
            </span>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">{description}</p>}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
