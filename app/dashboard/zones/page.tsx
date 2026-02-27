"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AlertBanner from "@/components/dashboard/AlertBanner"
import ZoneCard from "@/components/dashboard/ZoneCard"
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap"
import DeploymentMap from "@/components/dashboard/DeploymentMap"
import ZoneConfigForm from "@/components/forms/ZoneConfigForm"
import { Plus, Map, Activity, X } from "lucide-react"
import { Zone } from "@/lib/types/dashboard"

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([
    {
      _id: "zone-001",
      name: "North Sector",
      code: "Z01",
      sizeScore: 8,
      densityScore: 9,
      currentDeployment: 140,
      safeThreshold: 120,
      zScore: 2.45,
      heatmapColor: "red" as const,
      centroid: { coordinates: [77.24, 28.65] }
    },
    {
      _id: "zone-002",
      name: "South Sector",
      code: "Z02",
      sizeScore: 6,
      densityScore: 5,
      currentDeployment: 98,
      safeThreshold: 100,
      zScore: -0.15,
      heatmapColor: "yellow" as const,
      centroid: { coordinates: [77.25, 28.50] }
    },
    {
      _id: "zone-003",
      name: "East Zone",
      code: "Z03",
      sizeScore: 7,
      densityScore: 7,
      currentDeployment: 115,
      safeThreshold: 110,
      zScore: 1.82,
      heatmapColor: "orange" as const,
      centroid: { coordinates: [77.35, 28.58] }
    },
    {
      _id: "zone-004",
      name: "West Zone",
      code: "Z04",
      sizeScore: 5,
      densityScore: 3,
      currentDeployment: 65,
      safeThreshold: 85,
      zScore: -2.31,
      heatmapColor: "green" as const,
      centroid: { coordinates: [77.10, 28.58] }
    },
    {
      _id: "zone-005",
      name: "Central District",
      code: "Z05",
      sizeScore: 9,
      densityScore: 10,
      currentDeployment: 180,
      safeThreshold: 150,
      zScore: 3.12,
      heatmapColor: "red" as const,
      centroid: { coordinates: [77.22, 28.60] }
    },
    {
      _id: "zone-006",
      name: "Suburban Ring",
      code: "Z06",
      sizeScore: 4,
      densityScore: 2,
      currentDeployment: 52,
      safeThreshold: 80,
      zScore: -1.95,
      heatmapColor: "green" as const,
      centroid: { coordinates: [77.15, 28.48] }
    }
  ])

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
    setSelectedZone(zone)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedZone(null)
  }

  const handleZoneSubmit = (data: any) => {
    if (selectedZone) {
      setZones(zones.map(z => z._id === selectedZone._id ? { ...z, ...data } : z))
    } else {
      const newZone: Zone = {
        _id: `zone-${Date.now()}`,
        name: data.name,
        code: data.code,
        sizeScore: data.sizeScore,
        densityScore: data.densityScore,
        currentDeployment: 0,
        safeThreshold: 100,
        zScore: 0,
        heatmapColor: "green" as const,
        centroid: { coordinates: [77.22, 28.60] }
      }
      setZones([...zones, newZone])
    }
    handleCloseForm()
  }

  const handleDeleteZone = (zoneId: string) => {
    setZones(zones.filter(z => z._id !== zoneId))
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
              <DeploymentMap zones={zones} />
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