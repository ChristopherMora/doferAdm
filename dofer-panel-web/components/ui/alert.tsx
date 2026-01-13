import { cn } from "@/lib/utils"
import { Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
}

const variantConfig = {
  info: {
    icon: Info,
    className: 'bg-blue-500/10 border-blue-500/50 text-blue-500'
  },
  success: {
    icon: CheckCircle2,
    className: 'bg-green-500/10 border-green-500/50 text-green-500'
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500'
  },
  error: {
    icon: XCircle,
    className: 'bg-red-500/10 border-red-500/50 text-red-500'
  }
}

export function Alert({ 
  variant = 'info', 
  title, 
  children, 
  className, 
  ...props 
}: AlertProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div 
      className={cn(
        "flex gap-3 p-4 rounded-lg border animate-slide-down",
        config.className,
        className
      )}
      {...props}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <div className="font-medium mb-1">{title}</div>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  )
}
