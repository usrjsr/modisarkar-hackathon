/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AlertBanner from "@/components/dashboard/AlertBanner"
import ZoneCard from "@/components/dashboard/ZoneCard"
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap"
import ZoneConfigForm from "@/components/forms/ZoneConfigForm"
import { Plus, Map, Activity, X } from "lucide-react"
import { Zone } from "@/lib/types/dashboard"
import dynamic from "next/dynamic"

const ZoneLeafletMap = dynamic(() => import("@/components/dashboard/ZoneLeafletMap"), { ssr: false, loading: () => <div className="h-[420px] flex items-center justify-center bg-gray-100 rounded-lg"><p className="text-gray-500">Loading map...</p></div> })

export default function ZonesPage() {
  // Helper for Z-score and color
  function calculateZScore(S: number, D: number, w_s = 0.3, w_d = 0.7) {
    return (w_s * S + w_d * D) / (w_s + w_d);
  }
  function resolveHeatmapColor(zScore: number) {
    // 0–10 scale
    const normalised = ((zScore - 1) / 9) * 10;
    if (normalised >= 7.5) return 'red';
    if (normalised >= 5.0) return 'orange';
    if (normalised >= 2.5) return 'yellow';
    return 'green';
  }

  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchZones() {
      try {
        const res = await fetch('/api/zones')
        const result = await res.json()
        if (result.success && result.data && result.data.length > 0) {
          setZones(result.data.map((z: any) => ({
            _id: z._id,
            name: z.name,
            code: z.code,
            sizeScore: z.sizeScore,
            densityScore: z.densityScore,
            currentDeployment: z.currentDeployment ?? 0,
            safeThreshold: z.safeThreshold ?? 0,
            zScore: z.zScore ?? calculateZScore(z.sizeScore, z.densityScore),
            heatmapColor: z.heatmapColor ?? resolveHeatmapColor(z.zScore ?? calculateZScore(z.sizeScore, z.densityScore)),
            centroid: z.centroid ?? { coordinates: [77.22, 28.60] }
          })))
        }
      } catch (err) {
        console.error('Failed to fetch zones:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchZones()
  }, [])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)

  const totalDeployment = zones.reduce((sum, z) => sum + z.currentDeployment, 0)
  const totalCapacity = zones.reduce((sum, z) => sum + z.safeThreshold, 0)
  const activeZones = zones.length
  const criticalZones = zones.filter(z => z.currentDeployment > z.safeThreshold).length
  const utilizationRate = ((totalDeployment / totalCapacity) * 100).toFixed(1)

  const handleAddZone = () => {
    setSelectedZone(null)
    setIsFormOpen(true)
  }

  const handleEditZone = (zone: Zone) => {
    setSelectedZone({
      ...zone,
      latitude: zone.centroid?.coordinates?.[1] ?? 28.6139,
      longitude: zone.centroid?.coordinates?.[0] ?? 77.2090,
    } as any)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedZone(null)
  }

  const handleZoneSubmit = async (data: any) => {
    if (selectedZone) {
      // UPDATE via PATCH API
      try {
        const res = await fetch(`/api/zones/${selectedZone._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            sizeScore: data.sizeScore,
            densityScore: data.densityScore,
            isActive: data.isActive,
            centroid: { type: 'Point', coordinates: [data.longitude, data.latitude] },
          })
        });
        const result = await res.json();
        if (result.success && result.data) {
          // Refresh all zones from DB to get recalculated scores
          const refreshRes = await fetch('/api/zones');
          const refreshResult = await refreshRes.json();
          if (refreshResult.success && refreshResult.data) {
            setZones(refreshResult.data.map((z: any) => ({
              _id: z._id,
              name: z.name,
              code: z.code,
              sizeScore: z.sizeScore,
              densityScore: z.densityScore,
              currentDeployment: z.currentDeployment ?? 0,
              safeThreshold: z.safeThreshold ?? 0,
              zScore: z.zScore ?? calculateZScore(z.sizeScore, z.densityScore),
              heatmapColor: z.heatmapColor ?? resolveHeatmapColor(z.zScore ?? calculateZScore(z.sizeScore, z.densityScore)),
              centroid: z.centroid ?? { coordinates: [77.22, 28.60] }
            })));
          }
        } else {
          alert(result.error || 'Failed to update zone');
        }
      } catch (err) {
        alert('Error updating zone');
      }
    } else {
      // CREATE via POST API
      try {
        const res = await fetch('/api/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            code: data.code.toUpperCase(),
            sizeScore: data.sizeScore,
            densityScore: data.densityScore,
            centroid: { type: 'Point', coordinates: [data.longitude, data.latitude] },
          })
        });
        const result = await res.json();
        if (result.success && result.data) {
          // Refresh all zones from DB
          const refreshRes = await fetch('/api/zones');
          const refreshResult = await refreshRes.json();
          if (refreshResult.success && refreshResult.data) {
            setZones(refreshResult.data.map((z: any) => ({
              _id: z._id,
              name: z.name,
              code: z.code,
              sizeScore: z.sizeScore,
              densityScore: z.densityScore,
              currentDeployment: z.currentDeployment ?? 0,
              safeThreshold: z.safeThreshold ?? 0,
              zScore: z.zScore ?? calculateZScore(z.sizeScore, z.densityScore),
              heatmapColor: z.heatmapColor ?? resolveHeatmapColor(z.zScore ?? calculateZScore(z.sizeScore, z.densityScore)),
              centroid: z.centroid ?? { coordinates: [77.22, 28.60] }
            })));
          }
        } else {
          alert(result.error || 'Failed to create zone');
          return;
        }
      } catch (err) {
        alert('Error creating zone');
        return;
      }
    }
    handleCloseForm();
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;
    try {
      const res = await fetch(`/api/zones/${zoneId}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        setZones(zones.filter(z => z._id !== zoneId));
      } else {
        alert(result.error || 'Failed to delete zone');
      }
    } catch (err) {
      alert('Error deleting zone');
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">Zone Configuration & Management</h1>
        <p className="text-sm text-gray-600 mt-1">Operational Zone Setup - Personnel Distribution Strategy</p>
      </div>

      {!isFormOpen && (
        <div className="flex justify-end">
          <Button onClick={handleAddZone} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Create New Zone
          </Button>
        </div>
      )}

      {isFormOpen && (
        <Card className="bg-blue-50 border-l-4 border-l-blue-900">
          <CardHeader className="bg-blue-100 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-blue-900">{selectedZone ? "Edit Zone Configuration" : "Create New Zone"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCloseForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <ZoneConfigForm
              defaultValues={selectedZone || undefined}
              onSubmit={handleZoneSubmit}
            />
          </CardContent>
        </Card>
      )}

      {criticalZones > 0 && (
        <AlertBanner
          type="critical"
          title={`⚠️ CRITICAL: ${criticalZones} Zone(s) Over Safe Threshold`}
          message={`Immediate rebalancing required. Personnel surplus: ${zones.reduce((sum, z) => sum + Math.max(0, z.currentDeployment - z.safeThreshold), 0)}`}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ZoneStatCard
          label="Total Zones"
          value={activeZones}
          color="blue"
        />
        <ZoneStatCard
          label="Total Deployed"
          value={totalDeployment}
          color="green"
        />
        <ZoneStatCard
          label="Total Capacity"
          value={totalCapacity}
          color="indigo"
        />
        <ZoneStatCard
          label="Utilization"
          value={`${utilizationRate}%`}
          color={parseFloat(utilizationRate) > 85 ? "red" : "green"}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Zone Overview</TabsTrigger>
          <TabsTrigger value="map">Deployment Map</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap View</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="border-l-4 border-l-blue-900">
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-blue-900">Configured Zones</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map(zone => (
                  <div key={zone._id} className="relative group">
                    <ZoneCard zone={zone} onClick={() => handleEditZone(zone)} />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteZone(zone._id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <Card className="border-l-4 border-l-green-900">
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="text-green-900">Geospatial Deployment Map</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ZoneLeafletMap
                zones={zones}
                onZoneClick={(zoneId) => {
                  const zone = zones.find(z => z._id === zoneId)
                  if (zone) handleEditZone(zone)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6">
          <Card className="border-l-4 border-l-orange-900">
            <CardHeader className="bg-orange-50 border-b">
              <CardTitle className="text-orange-900">Strategic Heatmap View</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ZoneHeatmap zones={zones} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ZoneStatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-l-blue-500 text-blue-900",
    green: "bg-green-50 border-l-green-500 text-green-900",
    indigo: "bg-indigo-50 border-l-indigo-500 text-indigo-900",
    red: "bg-red-50 border-l-red-500 text-red-900"
  }

  return (
    <Card className={`border-l-4 ${colorClasses[color]}`}>
      <CardContent className="pt-4">
        <p className="text-xs font-semibold opacity-75 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}