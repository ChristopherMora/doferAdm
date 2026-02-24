import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
}

export default function LoadingState({ label = 'Cargando...' }: LoadingStateProps) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  )
}
