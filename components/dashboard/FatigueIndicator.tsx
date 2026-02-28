"use client"

interface FatigueIndicatorProps {
  score: number
}

export default function FatigueIndicator({ score }: FatigueIndicatorProps) {
  const getFatigueLevel = (
    scoreVal: number
  ): { label: string; accent: string; color: string } => {
    if (scoreVal >= 30) return { label: "CRITICAL", accent: "danger", color: "bg-danger" }
    if (scoreVal >= 20) return { label: "HIGH", accent: "warning", color: "bg-warning" }
    if (scoreVal >= 10) return { label: "MEDIUM", accent: "accent", color: "bg-accent" }
    return { label: "LOW", accent: "success", color: "bg-success" }
  }

  const fatigue = getFatigueLevel(score)
  const percentage = Math.min(100, (score / 40) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="mono-data text-[10px] uppercase tracking-widest">Avg Fatigue</span>
        <span className={`font-mono font-bold text-xs text-${fatigue.accent}`}>
          {score.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fatigue.color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span
        className={`
          inline-block font-mono text-[9px] font-bold px-2 py-0.5 rounded-sm border
          ${fatigue.accent === "danger" ? "border-danger bg-danger-muted text-danger" : ""}
          ${fatigue.accent === "warning" ? "border-warning bg-warning-muted text-warning" : ""}
          ${fatigue.accent === "accent" ? "border-accent bg-accent/10 text-accent" : ""}
          ${fatigue.accent === "success" ? "border-success bg-success-muted text-success" : ""}
        `}
      >
        {fatigue.label}
      </span>
    </div>
  )
}