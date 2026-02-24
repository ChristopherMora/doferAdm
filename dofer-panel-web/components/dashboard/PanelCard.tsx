import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PanelCardProps {
  children: ReactNode
  className?: string
}

export default function PanelCard({ children, className }: PanelCardProps) {
  return <section className={cn('panel-surface rounded-xl p-4 md:p-5', className)}>{children}</section>
}
