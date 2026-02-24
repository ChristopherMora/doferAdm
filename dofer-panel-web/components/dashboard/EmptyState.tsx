import { type ReactNode } from 'react'
import { Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export default function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-xl border border-dashed border-border/80 bg-background/60 p-10 text-center', className)}>
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
