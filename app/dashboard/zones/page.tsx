"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import AlertBanner from "@/components/dashboard/AlertBanner"
import ZoneCard from "@/components/dashboard/ZoneCard"
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap"
import ZoneConfigForm from "@/components/forms/ZoneConfigForm"
import { Plus, X, Map, BarChart3, LayoutGrid, MapPin, Users, Gauge, Shield, Eye, Edit, Trash2, CheckCircle, RefreshCw } from "lucide-react"
import { Zone } from "@/lib/types/dashboard"
import dynamic from "next/dynamic"

const ZoneLeafletMap = dynamic(() => import("@/components/dashboard/ZoneLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] flex items-center justify-center bg-surface border border-border rounded-md">
      <div className="flex items-center gap-2">
        <span className="status-dot-pulse bg-primary" />
        <span className="mono-data">LOADING MAP...</span>
      </div>
    </div>
  ),
})

type TabValue = "overview" | "map" | "heatmap"

export default function ZonesPage() {
  const router = useRouter()

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

  const [zones, setZones] = useState<Zone[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>("overview")
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [redistributing, setRedistributing] = useState(false)

  interface ZoneRaw {
    _id: string; name: string; code: string
    sizeScore: number; densityScore: number
    currentDeployment?: number; safeThreshold?: number
    zScore?: number; heatmapColor?: string
    centroid?: { coordinates: [number, number] }
  }

  const fetchAndSetZones = useCallback(async () => {
    const refreshRes = await fetch("/api/zones")
    const refreshResult = await refreshRes.json()
    if (refreshResult.success && refreshResult.data) {
      setZones(
        refreshResult.data.map((z: ZoneRaw) => ({
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
  }, [])

  useEffect(() => {
    const load = async () => {
      await fetchAndSetZones().catch(() => console.error("Failed to fetch zones"))
    }
    load()
  }, [fetchAndSetZones])

  const totalDeployment = zones.reduce((sum, z) => sum + z.currentDeployment, 0)
  const totalCapacity = zones.reduce((sum, z) => sum + z.safeThreshold, 0)
  const activeZones = zones.length
  const criticalZones = zones.filter(z => z.currentDeployment > z.safeThreshold).length
  const utilizationRate = totalCapacity > 0 ? ((totalDeployment / totalCapacity) * 100).toFixed(1) : "0.0"

  const handleAddZone = () => {
    setSelectedZone(null)
    setIsFormOpen(true)
  }

  const handleEditZone = (zone: Zone) => {
    setSelectedZone({
      ...zone,
      latitude: zone.centroid?.coordinates?.[1] ?? 28.6139,
      longitude: zone.centroid?.coordinates?.[0] ?? 77.209,
    } as Zone & { latitude: number; longitude: number })
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedZone(null)
  }

  interface ZoneFormData {
    name: string; code: string
    sizeScore: number; densityScore: number
    latitude: number; longitude: number
    isActive: boolean
  }

  const handleZoneSubmit = async (data: ZoneFormData) => {
    if (selectedZone) {
      try {
        const res = await fetch(`/api/zones/${selectedZone._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            sizeScore: data.sizeScore,
            densityScore: data.densityScore,
            isActive: data.isActive,
            centroid: { type: "Point", coordinates: [data.longitude, data.latitude] },
          }),
        })
        const result = await res.json()
        if (result.success && result.data) {
          handleCloseForm()
          setToast({ message: `Zone "${data.name}" updated successfully. Force redistributed.`, type: 'success' })
          setTimeout(() => setToast(null), 4000)
          await fetchAndSetZones()
        } else {
          alert(result.error || "Failed to update zone")
        }
      } catch {
        alert("Error updating zone")
      }
    } else {
      try {
        const res = await fetch("/api/zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            code: data.code.toUpperCase(),
            sizeScore: data.sizeScore,
            densityScore: data.densityScore,
            centroid: { type: "Point", coordinates: [data.longitude, data.latitude] },
          }),
        })
        const result = await res.json()
        if (result.success && result.data) {
          handleCloseForm()
          setToast({ message: `Zone "${data.name}" created successfully!`, type: 'success' })
          setTimeout(() => setToast(null), 5000)
          await fetchAndSetZones()
        } else {
          alert(result.error || "Failed to create zone")
          return
        }
      } catch {
        alert("Error creating zone")
        return
      }
    }
  }

  const handleRedistribute = async () => {
    setRedistributing(true)
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: new Date().toISOString() }),
      })
      const result = await res.json()
      if (result.success) {
        setToast({ message: 'Forces redistributed & roster regenerated successfully!', type: 'success' })
        setTimeout(() => setToast(null), 4000)
        await fetchAndSetZones()
      } else {
        alert(result.error || 'Failed to redistribute forces')
      }
    } catch {
      alert('Error redistributing forces')
    } finally {
      setRedistributing(false)
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Are you sure you want to delete this zone?")) return
    try {
      const res = await fetch(`/api/zones/${zoneId}`, { method: "DELETE" })
      const result = await res.json()
      if (result.success) {
        setZones(zones.filter(z => z._id !== zoneId))
      } else {
        alert(result.error || "Failed to delete zone")
      }
    } catch {
      alert("Error deleting zone")
    }
  }

  const TABS: { value: TabValue; label: string; icon: React.ElementType }[] = [
    { value: "overview", label: "Zone Overview", icon: LayoutGrid },
    { value: "map", label: "Deployment Map", icon: Map },
    { value: "heatmap", label: "Heatmap View", icon: BarChart3 },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-primary">ZONES</span>
            {criticalZones > 0 && <span className="tag-critical">{criticalZones} CRITICAL</span>}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Zone Configuration & Management
          </h1>
          <p className="mono-data mt-1">Operational Zone Setup · Personnel Distribution Strategy</p>
        </div>
        {!isFormOpen && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRedistribute}
              disabled={redistributing || zones.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-success bg-success-muted text-success rounded-md hover:bg-success hover:text-success-foreground transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${redistributing ? 'animate-spin' : ''}`} />
              {redistributing ? 'Redistributing...' : 'Redistribute Forces'}
            </button>
            <button
              onClick={handleAddZone}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              Create New Zone
            </button>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="sentinel-card overflow-hidden animate-slide-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm text-foreground">
                {selectedZone ? "Edit Zone Configuration" : "Create New Zone"}
              </span>
            </div>
            <button
              onClick={handleCloseForm}
              className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4">
            <ZoneConfigForm defaultValues={selectedZone || undefined} onSubmit={handleZoneSubmit} />
          </div>
        </div>
      )}

      {criticalZones > 0 && (
        <AlertBanner
          type="critical"
          title={`CRITICAL: ${criticalZones} Zone(s) Over Safe Threshold`}
          message={`Immediate rebalancing required. Personnel surplus: ${zones.reduce((sum, z) => sum + Math.max(0, z.currentDeployment - z.safeThreshold), 0)}`}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Zones", value: activeZones, icon: MapPin, accent: "primary" as const },
          { label: "Total Deployed", value: totalDeployment, icon: Users, accent: "success" as const },
          { label: "Total Capacity", value: totalCapacity, icon: Shield, accent: "accent" as const },
          {
            label: "Utilisation",
            value: `${utilizationRate}%`,
            icon: Gauge,
            accent: (parseFloat(utilizationRate) > 85 ? "danger" : "success") as "danger" | "success",
          },
        ].map(s => {
          const borderMap = {
            primary: "border-t-primary",
            success: "border-t-success",
            accent: "border-t-accent",
            danger: "border-t-danger",
          }
          const textMap = {
            primary: "text-primary",
            success: "text-success",
            accent: "text-accent",
            danger: "text-danger",
          }
          const iconMap = {
            primary: "text-primary",
            success: "text-success",
            accent: "text-accent",
            danger: "text-danger",
          }
          return (
            <div key={s.label} className={`sentinel-card border-t-2 ${borderMap[s.accent]} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="mono-data text-[10px]">{s.label}</span>
                <s.icon className={`w-3.5 h-3.5 ${iconMap[s.accent]}`} />
              </div>
              <p className={`font-display text-2xl font-bold ${textMap[s.accent]}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="flex border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150
                ${activeTab === tab.value
                  ? "border-b-primary text-primary bg-primary-muted/30"
                  : "border-b-transparent text-muted-foreground hover:text-foreground hover:bg-surface-raised"
                }
              `}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm text-foreground">Configured Zones</span>
              <span className="ml-auto mono-data text-[10px]">{zones.length} ZONES</span>
            </div>
            {zones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MapPin className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="font-display font-semibold text-foreground mb-1">No zones configured</p>
                <p className="mono-data text-[11px]">Create your first zone to begin deployment planning</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map(zone => (
                  <div key={zone._id} className="relative group">
                    <ZoneCard zone={zone} />

                    <div className="absolute top-2 right-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 z-10">
                      <button
                        onClick={() => router.push(`/dashboard/zones/${zone._id}`)}
                        title="View zone details"
                        className="flex items-center justify-center w-7 h-7 rounded-sm border border-primary bg-primary-muted text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-150 backdrop-blur-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleEditZone(zone)}
                        title="Edit zone configuration"
                        className="flex items-center justify-center w-7 h-7 rounded-sm border border-accent bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground transition-colors duration-150 backdrop-blur-sm"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteZone(zone._id)}
                        title="Delete zone"
                        className="flex items-center justify-center w-7 h-7 rounded-sm border border-danger bg-danger-muted text-danger hover:bg-danger hover:text-danger-foreground transition-colors duration-150 backdrop-blur-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "map" && (
          <div className="p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-success" />
                <span className="font-display font-semibold text-sm text-foreground">Geospatial Deployment Map</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="status-dot-pulse bg-success" />
                <span className="mono-data text-[10px] text-success">LIVE FEED</span>
              </div>
            </div>
            <ZoneLeafletMap
              zones={zones}
              onZoneClick={zoneId => {
                router.push(`/dashboard/zones/${zoneId}`)
              }}
            />
          </div>
        )}

        {activeTab === "heatmap" && (
          <div className="p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-warning" />
              <span className="font-display font-semibold text-sm text-foreground">Strategic Heatmap View</span>
              <span className="ml-auto mono-data text-[10px]">THREAT INTENSITY</span>
            </div>
            <ZoneHeatmap zones={zones} />
          </div>
        )}
      </div>

      {/* Success / Error Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-2xl border animate-slide-in-up ${toast.type === 'success'
          ? 'bg-success-muted border-success text-success'
          : 'bg-danger-muted border-danger text-danger'
          }`}>
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-2 w-6 h-6 flex items-center justify-center rounded-sm hover:bg-surface-overlay transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}