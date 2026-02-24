import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface TableShellProps {
  children: ReactNode
  className?: string
}

export default function TableShell({ children, className }: TableShellProps) {
  return (
    <section className={cn('panel-surface rounded-xl p-0 overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}
