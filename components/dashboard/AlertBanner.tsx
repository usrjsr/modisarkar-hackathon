"use client"

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"

interface AlertBannerProps {
  type: "critical" | "warning" | "success"
  title: string
  message: string
}

export default function AlertBanner({ type, title, message }: AlertBannerProps) {
  const config = {
    critical: {
      bg: "bg-danger-muted",
      border: "border-l-danger",
      icon: AlertCircle,
      title: "text-danger",
      text: "text-danger",
    },
    warning: {
      bg: "bg-warning-muted",
      border: "border-l-warning",
      icon: AlertTriangle,
      title: "text-warning",
      text: "text-warning",
    },
    success: {
      bg: "bg-success-muted",
      border: "border-l-success",
      icon: CheckCircle2,
      title: "text-success",
      text: "text-success",
    },
  }

  const { bg, border, icon: Icon, title: titleColor, text: textColor } = config[type]

  return (
    <div className={`sentinel-card border-l-4 ${border} p-4 ${bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${titleColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`font-display font-semibold text-sm ${titleColor}`}>{title}</p>
          <p className={`mono-data text-[11px] mt-1 leading-relaxed ${textColor}`}>{message}</p>
        </div>
      </div>
    </div>
  )
}