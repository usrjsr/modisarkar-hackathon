"use client"

import Link from "next/link"
import AlertBanner from "@/components/dashboard/AlertBanner"
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap"
import { useState, useEffect } from "react"
import {
  Users, MapPin, AlertTriangle, Shield,
  Clock, TrendingUp, Settings, ChevronRight,
  Activity, Radio, Zap, BarChart3
} from "lucide-react"
import { Zone } from "@/lib/types/dashboard"
import dynamic from "next/dynamic"

const ZoneLeafletMap = dynamic(
  () => import("@/components/dashboard/ZoneLeafletMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[350px] flex items-center justify-center bg-surface border border-border rounded-md">
        <div className="flex items-center gap-2">
          <span className="status-dot-pulse bg-primary" />
          <span className="mono-data">LOADING MAP...</span>
        </div>
      </div>
    )
  }
)

function calculateZScore(S: number, D: number, w_s = 0.3, w_d = 0.7) {
  return (w_s * S + w_d * D) / (w_s + w_d)
}

function resolveHeatmapColor(zScore: number) {
  const normalised = ((zScore - 1) / 9) * 10
  if (normalised >= 7.5) return "red"
  if (normalised >= 5.0) return "orange"
  if (normalised >= 2.5) return "yellow"
  return "green"
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState("")
  const [zones, setZones] = useState<Zone[]>([])
  const [totalForce, setTotalForce] = useState(0)
  const [standbyPct, setStandbyPct] = useState(0.15)
  const [weights, setWeights] = useState({ w_s: 0.3, w_d: 0.7 })
  const [configVersion, setConfigVersion] = useState(0)
  const [personnelStats, setPersonnelStats] = useState({
    total: 0, deployed: 0, onLeave: 0, standby: 0,
  })

  useEffect(() => {
    const update = () =>
      setCurrentTime(
        new Date().toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        })
      )
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function fetchZones() {
      interface ZoneRaw {
        _id: string; name: string; code: string
        sizeScore: number; densityScore: number
        currentDeployment?: number; safeThreshold?: number
        zScore?: number; heatmapColor?: string
        centroid?: { coordinates: [number, number] }
      }
      try {
        const res = await fetch("/api/zones")
        const result = await res.json()
        if (result.success && result.data?.length > 0) {
          setZones(
            result.data.map((z: ZoneRaw) => ({
              _id: z._id,
              name: z.name,
              code: z.code,
              sizeScore: z.sizeScore,
              densityScore: z.densityScore,
              currentDeployment: z.currentDeployment ?? 0,
              safeThreshold: z.safeThreshold ?? 0,
              zScore: z.zScore ?? calculateZScore(z.sizeScore, z.densityScore),
              heatmapColor: z.heatmapColor ?? resolveHeatmapColor(z.zScore ?? calculateZScore(z.sizeScore, z.densityScore)),
              centroid: z.centroid ?? { coordinates: [77.22, 28.6] },
            }))
          )
        }
      } catch (err) { console.error(err) }
    }

    async function fetchConfig() {
      try {
        const res = await fetch("/api/settings")
        const result = await res.json()
        if (result.success && result.data) {
          setTotalForce(result.data.totalForce ?? 0)
          setStandbyPct(result.data.standbyPercentage ?? 0.15)
          setWeights(result.data.weights ?? { w_s: 0.3, w_d: 0.7 })
          setConfigVersion(result.data.version ?? 0)
        }
      } catch (err) { console.error(err) }
    }

    async function fetchPersonnel() {
      interface PersonnelRaw { status: string }
      try {
        const res = await fetch("/api/personnel?limit=500")
        const result = await res.json()
        if (result.success && result.data) {
          const all: PersonnelRaw[] = result.data
          setPersonnelStats({
            total: all.length,
            deployed: all.filter((p) => p.status === "Deployed").length,
            onLeave: all.filter((p) => p.status === "OnLeave").length,
            standby: all.filter((p) => p.status === "Standby").length,
          })
        }
      } catch (err) { console.error(err) }
    }

    fetchZones()
    fetchConfig()
    fetchPersonnel()
  }, [])

  const totalDeployed = zones.reduce((sum, z) => sum + z.currentDeployment, 0)
  const standbyPoolSize = Math.floor(totalForce * standbyPct)
  const availableForReassignment = totalForce - totalDeployed - standbyPoolSize
  const criticalZones = zones.filter(z => z.currentDeployment > z.safeThreshold).length
  const utilizationRate = totalForce > 0 ? ((totalDeployed / totalForce) * 100).toFixed(1) : "0.0"
  const currentHour = new Date().getHours()
  const activeShift = currentHour >= 6 && currentHour < 14 ? "Morning" : currentHour >= 14 && currentHour < 22 ? "Evening" : "Night"
  const activeShiftTime = activeShift === "Morning" ? "06:00–14:00" : activeShift === "Evening" ? "14:00–22:00" : "22:00–06:00"

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-primary">CONTROL ROOM</span>
            <span className="tag-success">LIVE</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Operation Sentinel
          </h1>
          <p className="mono-data mt-1">
            Police Force Deployment · 30-Day Schedule Active
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col items-end gap-0.5 mr-2">
            <span className="mono-data text-[10px]">LAST SYNC</span>
            <span className="font-mono text-xs text-foreground">{currentTime}</span>
          </div>
          <Link href="/dashboard/settings">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:border-border-strong hover:bg-surface-raised rounded-md transition-colors duration-150">
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Settings</span>
            </button>
          </Link>
          <Link href="/dashboard/incidents">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-danger text-danger-foreground hover:bg-danger/90 rounded-md transition-colors duration-150">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">Simulate</span>
            </button>
          </Link>
        </div>
      </div>

      {criticalZones > 0 && (
        <AlertBanner
          type="critical"
          title={`CRITICAL: ${criticalZones} Zone(s) Over Capacity`}
          message="Immediate rebalancing required. Navigate to Zones to reassign personnel or activate standby reserves."
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total Force" value={totalForce} subtext="Personnel" icon={Users} accent="primary" />
        <StatCard label="Deployed" value={totalDeployed} subtext={`${utilizationRate}% utilised`} icon={Shield} accent="success" />
        <StatCard label="Standby Pool" value={standbyPoolSize} subtext={`${Math.round(standbyPct * 100)}% Reserve`} icon={AlertTriangle} accent="warning" />
        <StatCard label="Zones Active" value={zones.length} subtext={`${criticalZones} critical`} icon={MapPin} accent={criticalZones > 0 ? "danger" : "success"} />
        <StatCard label="Available" value={availableForReassignment} subtext="For Redeployment" icon={TrendingUp} accent="accent" />
        <StatCard label="Active Shift" value={activeShift} subtext={activeShiftTime} icon={Clock} accent="primary" />
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 sentinel-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm text-foreground">Geospatial Zone Map</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-dot-pulse bg-success" />
              <span className="mono-data text-[10px] text-success">LIVE FEED</span>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <ZoneLeafletMap zones={zones} />
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="mono-data text-[10px] uppercase tracking-widest">Zone Threat Heatmap</span>
              </div>
              <ZoneHeatmap zones={zones} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="sentinel-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-success" />
                <span className="font-display font-semibold text-sm text-foreground">Shift Status</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {[
                {
                  label: "Morning Shift", time: "06:00–14:00",
                  status: activeShift === "Morning" ? "ACTIVE" : currentHour >= 14 ? "DONE" : "SCHED",
                  active: activeShift === "Morning",
                },
                {
                  label: "Evening Shift", time: "14:00–22:00",
                  status: activeShift === "Evening" ? "ACTIVE" : currentHour >= 22 || currentHour < 6 ? "DONE" : "SCHED",
                  active: activeShift === "Evening",
                },
                {
                  label: "Night Shift", time: "22:00–06:00",
                  status: activeShift === "Night" ? "ACTIVE" : "SCHED",
                  active: activeShift === "Night",
                },
              ].map(shift => (
                <div
                  key={shift.label}
                  className={`flex items-center justify-between px-4 py-3 ${shift.active ? "bg-success-muted" : ""}`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${shift.active ? "text-success" : "text-foreground"}`}>
                      {shift.label}
                    </p>
                    <p className="mono-data">{shift.time}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded-sm border ${shift.status === "ACTIVE"
                      ? "bg-success-muted border-success text-success"
                      : shift.status === "DONE"
                        ? "bg-muted border-border text-muted-foreground"
                        : "bg-primary-muted border-primary text-primary"
                    }`}>
                    {shift.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="sentinel-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-raised">
              <span className="font-display font-semibold text-sm text-foreground">Alert Summary</span>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "Critical Zones", value: criticalZones, accent: "danger" },
                { label: "Standby Officers", value: personnelStats.standby, accent: "warning" },
                { label: "Personnel On Leave", value: personnelStats.onLeave, accent: "primary" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-bold text-sm text-${item.accent}`}>{item.value}</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Force Utilisation</span>
                  <span className="font-mono font-bold text-sm text-foreground">{utilizationRate}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${utilizationRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="sentinel-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-raised">
            <span className="font-display font-semibold text-sm text-foreground">Quick Actions</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {[
              { label: "Manage Zones", href: "/dashboard/zones", icon: MapPin, accent: "bg-primary text-primary-foreground" },
              { label: "Personnel", href: "/dashboard/personnel", icon: Users, accent: "bg-success text-success-foreground" },
              { label: "30-Day Roster", href: "/dashboard/roster", icon: Clock, accent: "bg-accent text-accent-foreground" },
              { label: "Incidents", href: "/dashboard/incidents", icon: AlertTriangle, accent: "bg-danger text-danger-foreground" },
            ].map(action => (
              <Link key={action.href} href={action.href}>
                <button className={`w-full flex items-center justify-between px-3 py-3 rounded-md ${action.accent} hover:opacity-90 transition-opacity duration-150`}>
                  <div className="flex items-center gap-2">
                    <action.icon className="w-4 h-4" />
                    <span className="text-sm font-semibold">{action.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>
              </Link>
            ))}
          </div>
        </div>

        <div className="sentinel-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-raised">
            <span className="font-display font-semibold text-sm text-foreground">System Information</span>
          </div>
          <div className="divide-y divide-border">
            {[
              { label: "Roster Period", value: "30 Days" },
              { label: "Total Zones", value: zones.length },
              { label: "Weight (Size)", value: weights.w_s.toFixed(2) },
              { label: "Weight (Density)", value: weights.w_d.toFixed(2) },
              { label: "Config Version", value: `v${configVersion}` },
              { label: "Last Updated", value: currentTime.split(",")[0] || "—" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="font-mono text-sm font-semibold text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

type Accent = "primary" | "success" | "warning" | "danger" | "accent"

function StatCard({
  label, value, subtext, icon: Icon, accent,
}: {
  label: string
  value: number | string
  subtext: string
  icon: React.ElementType
  accent: Accent
}) {
  const accentMap: Record<Accent, { border: string; icon: string; value: string }> = {
    primary: { border: "border-t-primary", icon: "text-primary", value: "text-primary" },
    success: { border: "border-t-success", icon: "text-success", value: "text-success" },
    warning: { border: "border-t-warning", icon: "text-warning", value: "text-warning" },
    danger: { border: "border-t-danger", icon: "text-danger", value: "text-danger" },
    accent: { border: "border-t-accent", icon: "text-accent", value: "text-accent" },
  }

  const c = accentMap[accent]

  return (
    <div className={`sentinel-card border-t-2 ${c.border} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="mono-data text-[10px] uppercase tracking-widest">{label}</span>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <p className={`font-display text-2xl font-bold tracking-tight ${c.value}`}>{value}</p>
      <p className="mono-data text-[10px]">{subtext}</p>
    </div>
  )
}