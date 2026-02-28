"use client"

import { Users, ShieldAlert, TrendingUp } from "lucide-react"
import FatigueIndicator from "./FatigueIndicator"
import { Zone } from "@/lib/types/dashboard"

interface ZoneCardProps {
  zone: Zone
  onClick?: () => void
}

export default function ZoneCard({ zone, onClick }: ZoneCardProps) {
  const threatMap: Record<string, { border: string; bg: string; accent: string }> = {
    red: { border: "border-threat-critical", bg: "bg-danger-muted", accent: "text-danger" },
    orange: { border: "border-threat-high", bg: "bg-warning-muted", accent: "text-warning" },
    yellow: { border: "border-threat-medium", bg: "bg-warning-muted/60", accent: "text-warning" },
    green: { border: "border-threat-low", bg: "bg-success-muted", accent: "text-success" },
  }

  const threat = threatMap[zone.heatmapColor] || threatMap.green
  const isDeficit = zone.currentDeployment < zone.safeThreshold
  const utilizationPct = Math.round((zone.currentDeployment / zone.safeThreshold) * 100)

  return (
    <div
      onClick={onClick}
      className={`
        sentinel-card border-l-4 ${threat.border} cursor-pointer
        hover:border-border-strong hover:bg-surface-raised
        transition-all duration-150 overflow-hidden group
      `}
    >
      <div className={`px-4 pt-9 pb-3 border-b border-border ${threat.bg}`}>
        <h3 className="font-display font-semibold text-sm text-foreground truncate mb-1.5">
          {zone.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`
            font-mono text-[10px] font-bold px-2 py-1 rounded-sm border shrink-0
            ${threat.accent === "text-danger" ? "border-danger bg-danger-muted text-danger" : ""}
            ${threat.accent === "text-warning" ? "border-warning bg-warning-muted text-warning" : ""}
            ${threat.accent === "text-success" ? "border-success bg-success-muted text-success" : ""}
          `}>
            {zone.code}
          </span>
          <span className="mono-data text-[10px]">Z-Score: {zone.zScore.toFixed(2)}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface border border-border rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="mono-data text-[10px]">Deployed</span>
            </div>
            <div className="flex items-baseline gap-1">
              <p className={`font-display text-xl font-bold ${isDeficit ? "text-danger" : "text-success"}`}>
                {zone.currentDeployment}
              </p>
              <span className="mono-data text-[10px] text-muted-foreground">/ {zone.safeThreshold}</span>
            </div>
            <p className={`mono-data text-[10px] mt-1 ${isDeficit ? "text-danger" : "text-success"}`}>
              {utilizationPct}% utilised
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-warning" />
              <span className="mono-data text-[10px]">Density</span>
            </div>
            <p className="font-display text-xl font-bold text-foreground">
              {zone.densityScore}
            </p>
            <p className="mono-data text-[10px] mt-1 text-muted-foreground">Score / 10</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="mono-data text-[10px]">Utilisation</span>
            <span className="font-mono text-xs font-bold text-foreground">{utilizationPct}%</span>
          </div>
          <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isDeficit ? "bg-danger" : "bg-success"
                }`}
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
        </div>

        {isDeficit && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger-muted border border-danger rounded-md">
            <TrendingUp className="w-3.5 h-3.5 text-danger shrink-0" />
            <p className="mono-data text-[10px] text-danger font-semibold">
              Deficit: {zone.safeThreshold - zone.currentDeployment}
            </p>
          </div>
        )}

        <FatigueIndicator score={5.5} />
      </div>
    </div>
  )
}