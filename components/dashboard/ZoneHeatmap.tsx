"use client"

import { Zone } from "@/lib/types/dashboard"

export default function ZoneHeatmap({ zones }: { zones: Zone[] }) {
  const getThreatColor = (color: string): { bg: string; text: string; border: string } => {
    switch (color) {
      case "red":
        return { bg: "bg-danger", text: "text-danger-foreground", border: "border-danger" }
      case "orange":
        return { bg: "bg-warning", text: "text-warning-foreground", border: "border-warning" }
      case "yellow":
        return { bg: "bg-warning/80", text: "text-foreground", border: "border-warning" }
      case "green":
        return { bg: "bg-success", text: "text-success-foreground", border: "border-success" }
      default:
        return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" }
    }
  }

  const getThreatLabel = (color: string): string => {
    switch (color) {
      case "red":
        return "CRITICAL"
      case "orange":
        return "HIGH"
      case "yellow":
        return "MEDIUM"
      case "green":
        return "LOW"
      default:
        return "UNKNOWN"
    }
  }

  return (
    <div className="sentinel-card overflow-hidden">
      <div className="px-4 py-3 bg-surface-raised border-b border-border">
        <div className="flex items-center justify-between">
          <span className="font-display font-semibold text-sm text-foreground">Zone Threat Intensity Grid</span>
          <span className="mono-data text-[10px]">{zones.length} ZONES</span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {zones.map(zone => {
            const threat = getThreatColor(zone.heatmapColor)
            const threatLabel = getThreatLabel(zone.heatmapColor)
            const deficit = Math.max(0, zone.safeThreshold - zone.currentDeployment)

            return (
              <div
                key={zone._id}
                className="group relative"
                title={`${zone.name} (${zone.code}) - ${threatLabel}`}
              >
                <div
                  className={`
                    h-12 w-full rounded-md flex flex-col items-center justify-center
                    font-mono text-[10px] font-bold cursor-pointer
                    border border-current transition-all duration-150
                    hover:shadow-md hover:scale-105
                    ${threat.bg} ${threat.text} ${threat.border}
                  `}
                >
                  <span>{zone.code}</span>
                  <span className="text-[8px] opacity-70">{zone.zScore.toFixed(1)}</span>
                </div>

                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 z-50">
                  <div className="bg-surface-overlay border border-border-strong rounded-md px-3 py-2 shadow-lg whitespace-nowrap">
                    <p className="font-display font-semibold text-xs text-foreground">{zone.name}</p>
                    <p className="mono-data text-[10px] text-muted-foreground mt-1">
                      Code: {zone.code}
                    </p>
                    <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
                      <p className="mono-data text-[10px]">
                        Deployed: <span className="text-foreground font-bold">{zone.currentDeployment}</span>
                      </p>
                      <p className="mono-data text-[10px]">
                        Safe: <span className="text-foreground font-bold">{zone.safeThreshold}</span>
                      </p>
                      <p className="mono-data text-[10px]">
                        Density: <span className="text-foreground font-bold">{zone.densityScore}/10</span>
                      </p>
                      <p className="mono-data text-[10px]">
                        Z-Score: <span className="text-foreground font-bold">{zone.zScore.toFixed(2)}</span>
                      </p>
                    </div>
                    {deficit > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-border">
                        <p className={`mono-data text-[10px] text-danger font-bold`}>
                          Deficit: {deficit}
                        </p>
                      </div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-surface-overlay" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="mono-data text-[10px] uppercase tracking-widest mb-3">Threat Legend</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { color: "red", label: "CRITICAL", desc: "Z-Score ≥ 7.5" },
              { color: "orange", label: "HIGH", desc: "Z-Score ≥ 5.0" },
              { color: "yellow", label: "MEDIUM", desc: "Z-Score ≥ 2.5" },
              { color: "green", label: "LOW", desc: "Z-Score < 2.5" },
            ].map(item => {
              const threat = getThreatColor(item.color)
              return (
                <div key={item.color} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-sm border border-current ${threat.bg} ${threat.text}`} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="mono-data text-[9px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}