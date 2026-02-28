"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Users, ShieldAlert, TrendingUp, MapPin, Activity, AlertTriangle, ChevronRight } from "lucide-react"
import { Zone } from "@/lib/types/dashboard"

interface DeployedOfficer {
  _id: string
  name: string
  badgeNumber: string
  rank: string
  status: string
  fatigueScore: number
}

interface ZoneDetail extends Zone {
  deployedOfficers?: DeployedOfficer[]
}

export default function ZoneDetailPage() {
  const params = useParams()
  const router = useRouter()
  const zoneId = params.zoneId as string

  const [zone, setZone] = useState<ZoneDetail | null>(null)
  const [officers, setOfficers] = useState<DeployedOfficer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchZoneDetail = async () => {
      try {
        const res = await fetch(`/api/zones/${zoneId}`)
        const result = await res.json()
        if (result.success && result.data) {
          setZone(result.data)
        }
      } catch {
        console.error("Failed to fetch zone details")
      }
    }

    const fetchDeployedOfficers = async () => {
      try {
        const res = await fetch(`/api/zones/${zoneId}/personnel`)
        const result = await res.json()
        if (result.success && result.data) {
          setOfficers(result.data)
        }
      } catch {
        console.error("Failed to fetch deployed officers")
      }
    }

    Promise.all([fetchZoneDetail(), fetchDeployedOfficers()]).finally(() => {
      setLoading(false)
    })
  }, [zoneId])

  const threatMap: Record<string, { color: string; label: string }> = {
    red: { color: "text-danger", label: "CRITICAL" },
    orange: { color: "text-warning", label: "HIGH" },
    yellow: { color: "text-warning", label: "MEDIUM" },
    green: { color: "text-success", label: "LOW" },
  }

  const threat = zone ? threatMap[zone.heatmapColor] || threatMap.green : null
  const utilizationPct = zone ? Math.round((zone.currentDeployment / zone.safeThreshold) * 100) : 0
  const isDeficit = zone && zone.currentDeployment < zone.safeThreshold
  const avgFatigue = officers.length > 0 ? (officers.reduce((sum, o) => sum + o.fatigueScore, 0) / officers.length).toFixed(1) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3">
          <span className="status-dot-pulse bg-primary" />
          <span className="mono-data">LOADING ZONE DETAILS...</span>
        </div>
      </div>
    )
  }

  if (!zone) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3 py-2 mb-4 border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="sentinel-card p-6 border-l-4 border-l-warning">
          <p className="text-sm text-foreground">Zone not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Zones
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-primary">ZONE DETAIL</span>
            {threat && <span className={`tag-primary ${threat.color}`}>{threat.label}</span>}
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">{zone.name}</h1>
          <p className="mono-data mt-1">Zone Code: {zone.code}</p>
        </div>
      </div>

      {isDeficit && (
        <div className="sentinel-card border-l-4 border-l-danger p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-danger text-sm">PERSONNEL DEFICIT</p>
              <p className="mono-data text-[11px] mt-0.5">
                {zone.safeThreshold - zone.currentDeployment} additional officers required for safe threshold.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Deployed"
          value={zone.currentDeployment}
          subtext={`${zone.safeThreshold} threshold`}
          icon={Users}
          accent={isDeficit ? "danger" : "success"}
        />
        <StatCard
          label="Utilisation"
          value={`${utilizationPct}%`}
          subtext="Of capacity"
          icon={Activity}
          accent={utilizationPct >= 100 ? "danger" : utilizationPct >= 75 ? "warning" : "success"}
        />
        <StatCard
          label="Density Score"
          value={zone.densityScore}
          subtext="Population density"
          icon={ShieldAlert}
          accent="primary"
        />
        <StatCard
          label="Z-Score"
          value={zone.zScore.toFixed(2)}
          subtext="Threat assessment"
          icon={TrendingUp}
          accent="accent"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 sentinel-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">Zone Metrics</span>
          </div>

          <div className="divide-y divide-border">
            {[
              { label: "Current Deployment", value: `${zone.currentDeployment} personnel`, accent: "primary" },
              { label: "Safe Threshold", value: `${zone.safeThreshold} personnel`, accent: "success" },
              { label: "Population Density (D)", value: `${zone.densityScore} / 10`, accent: "warning" },
              { label: "Size Score (S)", value: `${zone.sizeScore} / 10`, accent: "accent" },
              { label: "Z-Score Formula", value: "(0.3 × S + 0.7 × D) / 1.0", accent: "primary" },
              { label: "Calculated Z-Score", value: zone.zScore.toFixed(2), accent: "accent" },
            ].map((metric, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                <span className={`
                  font-mono font-bold text-sm
                  ${metric.accent === "primary" ? "text-primary" : ""}
                  ${metric.accent === "success" ? "text-success" : ""}
                  ${metric.accent === "warning" ? "text-warning" : ""}
                  ${metric.accent === "accent" ? "text-accent" : ""}
                `}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 bg-surface-raised border-t border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="mono-data text-[10px]">Utilisation Progress</span>
              <span className="font-mono text-xs font-bold text-foreground">{utilizationPct}%</span>
            </div>
            <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isDeficit ? "bg-danger" : utilizationPct >= 100 ? "bg-warning" : "bg-success"
                  }`}
                style={{ width: `${Math.min(utilizationPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="sentinel-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-raised">
              <span className="font-display font-semibold text-sm text-foreground">Quick Stats</span>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Total Officers", value: officers.length, accent: "primary" },
                { label: "Avg Fatigue", value: `${avgFatigue}%`, accent: officers.length > 0 ? "warning" : "success" },
                { label: "High Fatigue", value: officers.filter(o => o.fatigueScore > 20).length, accent: "warning" },
              ].map((stat, idx) => (
                <div key={idx} className="px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`
                    font-display text-xl font-bold
                    ${stat.accent === "primary" ? "text-primary" : ""}
                    ${stat.accent === "success" ? "text-success" : ""}
                    ${stat.accent === "warning" ? "text-warning" : ""}
                    ${stat.accent === "danger" ? "text-danger" : ""}
                  `}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="sentinel-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-raised">
              <span className="font-display font-semibold text-sm text-foreground">Threat Level</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-sm flex items-center justify-center font-bold text-sm
                  ${threat?.color === "text-danger" ? "bg-danger-muted text-danger" : ""}
                  ${threat?.color === "text-warning" ? "bg-warning-muted text-warning" : ""}
                  ${threat?.color === "text-success" ? "bg-success-muted text-success" : ""}
                `}>
                  {zone.zScore.toFixed(1)}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{threat?.label}</p>
                  <p className="mono-data text-[10px]">Based on Z-Score</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                <p>• Density score heavily weighted (70%)</p>
                <p>• Size score adds context (30%)</p>
                <p>• Enables smart deployment</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">Deployed Personnel</span>
            <span className="tag-primary ml-auto">{officers.length}</span>
          </div>
        </div>

        {officers.length === 0 ? (
          <div className="p-6 text-center">
            <span className="mono-data">NO PERSONNEL DEPLOYED TO THIS ZONE</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    {["Badge", "Name", "Rank", "Status", "Fatigue", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left">
                        <span className="mono-data text-[10px]">{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {officers.map(officer => {
                    const fatigueLevel = officer.fatigueScore > 20 ? "warning" : "success"
                    return (
                      <tr key={officer._id} className="hover:bg-surface-raised transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">{officer.badgeNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-sm text-foreground">{officer.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">{officer.rank}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`
                            font-mono text-[10px] font-bold px-2 py-1 rounded-sm border
                            ${officer.status === "Deployed" ? "bg-success-muted border-success text-success" : "bg-primary-muted border-primary text-primary"}
                          `}>
                            {officer.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`
                            font-mono text-[10px] font-bold px-2 py-1 rounded-sm border
                            ${fatigueLevel === "warning" ? "bg-warning-muted border-warning text-warning" : "bg-success-muted border-success text-success"}
                          `}>
                            {officer.fatigueScore.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-border bg-surface-raised">
              <span className="mono-data text-[10px]">SHOWING {officers.length} PERSONNEL</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  subtext: string
  icon: React.ElementType
  accent: string
}) {
  const accentMap: Record<string, { border: string; icon: string; value: string }> = {
    primary: { border: "border-t-primary", icon: "text-primary", value: "text-primary" },
    success: { border: "border-t-success", icon: "text-success", value: "text-success" },
    warning: { border: "border-t-warning", icon: "text-warning", value: "text-warning" },
    danger: { border: "border-t-danger", icon: "text-danger", value: "text-danger" },
    accent: { border: "border-t-accent", icon: "text-accent", value: "text-accent" },
  }

  const c = accentMap[accent] || accentMap.primary

  return (
    <div className={`sentinel-card border-t-2 ${c.border} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="mono-data text-[10px]">{label}</span>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <p className={`font-display text-2xl font-bold ${c.value}`}>{value}</p>
      <p className="mono-data text-[10px] mt-1">{subtext}</p>
    </div>
  )
}