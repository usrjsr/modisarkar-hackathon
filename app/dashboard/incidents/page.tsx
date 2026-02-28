"use client"

import { useState, useEffect } from "react"
import { AlertCircle, TrendingUp, Zap, CheckCircle, RefreshCw, Activity, Shield } from "lucide-react"
import AlertBanner from "@/components/dashboard/AlertBanner"

interface ZoneData {
  _id: string
  name: string
  code: string
  densityScore: number
  sizeScore: number
  currentDeployment: number
  safeThreshold: number
  heatmapColor: string
  isActive: boolean
}

interface IncidentResult {
  incidentId: string
  zoneId: string
  originalDensity: number
  newDensity: number
  newZScore: number
  deltaT: number
  newRequirement: number
  currentStrength: number
  heatmapColor: string
  message: string
}

interface ZoneState {
  _id: string
  name: string
  code: string
  currentD: number
  newD: number
  isDensitySpike: boolean
  deficit: number
  status: string
}

const RESOLUTION_STEPS = [
  {
    step: "A",
    title: "Density Assessment",
    description: "Calculate updated Z-score and required personnel delta (ΔT)",
    accent: "primary",
  },
  {
    step: "B",
    title: "Adjacent Pooling",
    description: "Siphon safe surplus from neighbouring green zones",
    accent: "success",
  },
  {
    step: "C",
    title: "Standby Activation",
    description: "Activate 15% global standby reserve pool if neighbours insufficient",
    accent: "warning",
  },
  {
    step: "D",
    title: "Escalation Alert",
    description: "Trigger manual override request when all reserves are depleted",
    accent: "danger",
  },
]

export default function IncidentsPage() {
  const [zones, setZones] = useState<ZoneState[]>([])
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showResolution, setShowResolution] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(false)
  const [lastResult, setLastResult] = useState<IncidentResult | null>(null)

  useEffect(() => { fetchZones() }, [])

  const fetchZones = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/zones")
      const result = await res.json()
      if (result.success && result.data) {
        setZones(result.data.map((z: ZoneData) => ({
          _id: z._id,
          name: z.name,
          code: z.code,
          currentD: z.densityScore ?? 1,
          newD: z.densityScore ?? 1,
          isDensitySpike: false,
          deficit: 0,
          status: "Normal",
        })))
      }
    } catch { console.error("Failed to fetch zones") }
    finally { setLoading(false) }
  }

  const incidentZone = zones.find(z => z.isDensitySpike)
  const totalDeficit = zones.reduce((sum, z) => sum + z.deficit, 0)
  const incidentZones = zones.filter(z => z.isDensitySpike).length
  const resolvedZones = zones.filter(z => z.status === "Resolved").length

  const triggerIncident = async (zoneId: string) => {
    const zone = zones.find(z => z._id === zoneId)
    if (!zone) return
    const newD = Math.min(10, zone.currentD + 2)
    try {
      const res = await fetch(`/api/zones/${zoneId}/incident`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDensityScore: newD,
          shift: "morning",
          shiftStart: new Date().toISOString(),
        }),
      })
      const result = await res.json()
      if (result.success && result.data) {
        const data = result.data as IncidentResult
        setLastResult(data)
        setZones(zones.map(z => z._id === zoneId
          ? { ...z, newD: data.newDensity, isDensitySpike: true, deficit: Math.max(0, data.deltaT), status: "Incident" }
          : z
        ))
        setSelectedZone(zoneId)
        setShowResolution(false)
      } else {
        alert(result.error || "Failed to trigger incident")
      }
    } catch { alert("Error triggering incident") }
  }

  const resolveIncident = () => {
    setResolving(true)
    setZones(zones.map(z => z.isDensitySpike
      ? { ...z, currentD: z.newD, isDensitySpike: false, deficit: 0, status: "Resolved" }
      : z
    ))
    setShowResolution(true)
    setResolving(false)
  }

  const resetIncidents = async () => {
    setSelectedZone(null)
    setShowResolution(false)
    setLastResult(null)
    await fetchZones()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <span className="status-dot-pulse bg-primary" />
          <span className="mono-data">LOADING ZONES...</span>
        </div>
      </div>
    )
  }

  if (zones.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-5 animate-fade-in">
        <PageHeader />
        <div className="sentinel-card p-6 border-l-4 border-l-warning">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-sm text-foreground">
              No active zones found. Create zones first in Zone Configuration.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <PageHeader />

      {incidentZones > 0 && (
        <AlertBanner
          type="critical"
          title={`ACTIVE INCIDENT: Density Spike in ${incidentZone?.name}`}
          message={`Required additional deployment: ${totalDeficit} personnel. Auto-resolution engine activated.`}
        />
      )}

      {showResolution && (
        <div className="sentinel-card border-l-4 border-l-success p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-semibold text-success">INCIDENT RESOLVED</p>
              <p className="text-sm text-muted-foreground mt-1">
                Personnel successfully redeployed. Density score normalised. System returned to standard operations.
              </p>
            </div>
          </div>
        </div>
      )}

      {lastResult && lastResult.deltaT > 0 && !showResolution && (
        <div className="sentinel-card border-l-4 border-l-warning overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center gap-2">
            <Activity className="w-4 h-4 text-warning" />
            <span className="font-display font-semibold text-sm text-foreground">Deficit Analysis</span>
            <span className="tag-warning ml-auto">ACTIVE</span>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Original D", value: lastResult.originalDensity, accent: "text-foreground" },
              { label: "New D Score", value: lastResult.newDensity, accent: "text-danger" },
              { label: "ΔT Deficit", value: lastResult.deltaT, accent: "text-danger" },
              { label: "New Z-Score", value: lastResult.newZScore.toFixed(2), accent: "text-warning" },
            ].map(item => (
              <div key={item.label} className="bg-surface-raised border border-border rounded-md p-3">
                <p className="mono-data text-[10px] mb-1">{item.label}</p>
                <p className={`font-mono font-bold text-xl ${item.accent}`}>{item.value}</p>
              </div>
            ))}
          </div>
          {lastResult.message && (
            <div className="px-4 pb-4">
              <p className="mono-data text-[11px] text-warning">{lastResult.message}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Incidents" value={incidentZones} accent="danger" />
        <StatCard label="Personnel Deficit" value={totalDeficit} accent="warning" />
        <StatCard label="Zones Monitored" value={zones.length} accent="primary" />
        <StatCard label="Resolved" value={resolvedZones} accent="success" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="sentinel-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-raised">
            <Zap className="w-4 h-4 text-danger" />
            <span className="font-display font-semibold text-sm text-foreground">Trigger Incident</span>
            {incidentZones > 0 && <span className="tag-critical ml-auto">HOT</span>}
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Select a zone to simulate a density spike — crowd surge, emergency event, or mass gathering.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {zones.map(zone => {
                const isSelected = selectedZone === zone._id
                const isSpike = zone.isDensitySpike
                const isResolved = zone.status === "Resolved"
                return (
                  <button
                    key={zone._id}
                    onClick={() => !isSpike && !isResolved && triggerIncident(zone._id)}
                    disabled={isSpike || isResolved}
                    className={`
                      flex items-center justify-between px-3 py-2.5 rounded-md border text-sm font-medium
                      transition-colors duration-150
                      ${isSpike
                        ? "bg-danger-muted border-danger text-danger cursor-not-allowed"
                        : isResolved
                        ? "bg-success-muted border-success text-success cursor-not-allowed"
                        : isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-surface border-border text-foreground hover:border-border-strong hover:bg-surface-raised"
                      }
                    `}
                  >
                    <span className="font-mono text-xs font-bold opacity-60">{zone.code}</span>
                    <span className="truncate ml-2">{zone.name.split(" ")[0]}</span>
                    {isSpike && <span className="w-1.5 h-1.5 rounded-full bg-danger ml-1 shrink-0" />}
                    {isResolved && <CheckCircle className="w-3 h-3 ml-1 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="sentinel-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-raised">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="font-display font-semibold text-sm text-foreground">Auto-Resolution Engine</span>
          </div>
          <div className="divide-y divide-border">
            {RESOLUTION_STEPS.map((s) => (
              <div key={s.step} className="flex items-start gap-4 p-4">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-sm shrink-0
                  font-mono font-bold text-sm border
                  ${s.accent === "primary" ? "bg-primary-muted border-primary text-primary" : ""}
                  ${s.accent === "success" ? "bg-success-muted border-success text-success" : ""}
                  ${s.accent === "warning" ? "bg-warning-muted border-warning text-warning" : ""}
                  ${s.accent === "danger"  ? "bg-danger-muted  border-danger  text-danger"  : ""}
                `}>
                  {s.step}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="mono-data text-[11px] mt-0.5 leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">Zone Status & Density Levels</span>
          </div>
          <button
            onClick={resetIncidents}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-surface hover:bg-surface-raised hover:border-border-strong text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset All
          </button>
        </div>

        <div className="divide-y divide-border">
          {zones.map(zone => {
            const densityPct = (zone.currentD / 10) * 100
            const newDensityPct = (zone.newD / 10) * 100
            const isSpike = zone.isDensitySpike
            const isResolved = zone.status === "Resolved"

            return (
              <div
                key={zone._id}
                className={`p-4 transition-colors duration-150 ${isSpike ? "bg-danger-muted/30" : isResolved ? "bg-success-muted/30" : "hover:bg-surface-raised"}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{zone.code}</span>
                      <h3 className="font-display font-semibold text-sm text-foreground">{zone.name}</h3>
                    </div>
                    <p className="mono-data text-[10px] mt-0.5">Density Score Monitoring</p>
                  </div>
                  <span className={`
                    font-mono text-[10px] font-bold px-2 py-1 rounded-sm border
                    ${isSpike    ? "bg-danger-muted  border-danger  text-danger"  : ""}
                    ${isResolved ? "bg-success-muted border-success text-success" : ""}
                    ${!isSpike && !isResolved ? "bg-muted border-border text-muted-foreground" : ""}
                  `}>
                    {zone.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2.5 mb-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="mono-data text-[10px]">CURRENT D-SCORE</span>
                      <span className="font-mono text-xs font-bold text-foreground">{zone.currentD} / 10</span>
                    </div>
                    <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${densityPct}%` }}
                      />
                    </div>
                  </div>

                  {isSpike && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="mono-data text-[10px] text-danger">POST-INCIDENT D-SCORE</span>
                        <span className="font-mono text-xs font-bold text-danger">{zone.newD} / 10</span>
                      </div>
                      <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                        <div
                          className="h-full bg-danger rounded-full transition-all duration-500"
                          style={{ width: `${newDensityPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isSpike && (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-danger-muted border border-danger rounded-md mb-3">
                    <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                    <div>
                      <p className="font-mono text-xs font-bold text-danger">
                        PERSONNEL DEFICIT: {zone.deficit}
                      </p>
                      <p className="mono-data text-[10px] mt-0.5">Additional officers required immediately</p>
                    </div>
                  </div>
                )}

                {!isSpike && !isResolved && (
                  <button
                    onClick={() => triggerIncident(zone._id)}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-border rounded-md text-sm text-muted-foreground hover:text-danger hover:border-danger hover:bg-danger-muted transition-colors duration-150"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Simulate Incident
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {incidentZones > 0 && (
          <div className="p-4 border-t border-border">
            <button
              onClick={resolveIncident}
              disabled={resolving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-success text-success-foreground rounded-md font-semibold hover:opacity-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              Execute Auto-Resolution
            </button>
          </div>
        )}
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-raised">
          <span className="font-display font-semibold text-sm text-foreground">System Notes</span>
        </div>
        <div className="p-4 space-y-2">
          {[
            "Adjacent Pooling extracts surplus from green zones without dropping below safe threshold.",
            "Standby Pool (15% reserve) is activated when immediate neighbours cannot provide required strength.",
            "Critical Alert triggers when all resolution methods are exhausted — requires manual override.",
            "Fatigue scoring prevents deployment of high-fatigue officers to deficit zones.",
          ].map((note, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="font-mono text-[10px] font-bold text-muted-foreground mt-0.5 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="tag-critical">INCIDENTS</span>
          <span className="tag-warning">SIM MODE</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Incident Simulation & Response
        </h1>
        <p className="mono-data mt-1">Dynamic Load Balancing · Personnel Redeployment Engine</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  const map: Record<string, { border: string; value: string }> = {
    danger:  { border: "border-t-danger",  value: "text-danger"  },
    warning: { border: "border-t-warning", value: "text-warning" },
    primary: { border: "border-t-primary", value: "text-primary" },
    success: { border: "border-t-success", value: "text-success" },
  }
  const c = map[accent] ?? map.primary

  return (
    <div className={`sentinel-card border-t-2 ${c.border} p-4`}>
      <p className="mono-data text-[10px] uppercase tracking-widest">{label}</p>
      <p className={`font-display text-2xl font-bold mt-1 ${c.value}`}>{value}</p>
    </div>
  )
}