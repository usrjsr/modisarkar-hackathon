/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, TrendingUp, Users, Zap, CheckCircle } from "lucide-react"
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

export default function IncidentsPage() {
  const [zones, setZones] = useState<ZoneState[]>([])
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showResolution, setShowResolution] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(false)
  const [lastResult, setLastResult] = useState<IncidentResult | null>(null)

  useEffect(() => {
    fetchZones()
  }, [])

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/zones')
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
          status: "Normal"
        })))
      }
    } catch {
      console.error('Failed to fetch zones')
    } finally {
      setLoading(false)
    }
  }

  const incidentZone = zones.find(z => z.isDensitySpike)
  const totalDeficit = zones.reduce((sum, z) => sum + z.deficit, 0)
  const incidentZones = zones.filter(z => z.isDensitySpike).length

  const triggerIncident = async (zoneId: string) => {
    const zone = zones.find(z => z._id === zoneId)
    if (!zone) return

    const newD = Math.min(10, zone.currentD + 2)

    try {
      const res = await fetch(`/api/zones/${zoneId}/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDensityScore: newD,
          shift: 'morning',
          shiftStart: new Date().toISOString(),
        })
      })
      const result = await res.json()

      if (result.success && result.data) {
        const data = result.data as IncidentResult
        setLastResult(data)
        setZones(zones.map(z => {
          if (z._id === zoneId) {
            return {
              ...z,
              newD: data.newDensity,
              isDensitySpike: true,
              deficit: Math.max(0, data.deltaT),
              status: "Incident"
            }
          }
          return z
        }))
        setSelectedZone(zoneId)
        setShowResolution(false)
      } else {
        alert(result.error || 'Failed to trigger incident')
      }
    } catch {
      alert('Error triggering incident')
    }
  }

  const resolveIncident = () => {
    setResolving(true)
    // Simulate resolution — update local state to reflect resolved status
    setZones(zones.map(z => {
      if (z.isDensitySpike) {
        return { ...z, currentD: z.newD, isDensitySpike: false, deficit: 0, status: "Resolved" }
      }
      return z
    }))
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
        <p className="text-gray-500">Loading zones...</p>
      </div>
    )
  }

  if (zones.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-red-900 pb-4">
          <h1 className="text-3xl font-bold text-red-900">Incident Simulation & Response</h1>
          <p className="text-sm text-gray-600 mt-1">Dynamic Load Balancing & Personnel Redeployment</p>
        </div>
        <Card className="bg-amber-50 border-l-4 border-l-amber-600">
          <CardContent className="pt-6">
            <p className="text-amber-900">No active zones found. Create zones first in the Zone Configuration page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-red-900 pb-4">
        <h1 className="text-3xl font-bold text-red-900">Incident Simulation & Response</h1>
        <p className="text-sm text-gray-600 mt-1">Dynamic Load Balancing & Personnel Redeployment</p>
      </div>

      {incidentZones > 0 && (
        <AlertBanner
          type="critical"
          title={`🚨 ACTIVE INCIDENT: Density Spike in ${incidentZone?.name}`}
          message={`Required additional deployment: ${totalDeficit} personnel. Auto-resolution engine activated.`}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Incidents" value={incidentZones} color="red" />
        <StatCard label="Personnel Deficit" value={totalDeficit} color="orange" />
        <StatCard label="Zones Monitored" value={zones.length} color="blue" />
        <StatCard label="Resolved" value={zones.filter(z => z.status === "Resolved").length} color="green" />
      </div>

      {showResolution && (
        <Card className="bg-green-50 border-l-4 border-l-green-600">
          <CardContent className="pt-6 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Incident Resolved</p>
              <p className="text-sm text-green-800 mt-1">Personnel successfully redeployed. Density score normalized. System returned to standard operations.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {lastResult && lastResult.deltaT > 0 && !showResolution && (
        <Card className="bg-orange-50 border-l-4 border-l-orange-600">
          <CardContent className="pt-6 space-y-2">
            <p className="font-semibold text-orange-900">Deficit Analysis</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-600">Original D:</span> <strong>{lastResult.originalDensity}</strong></div>
              <div><span className="text-gray-600">New D:</span> <strong>{lastResult.newDensity}</strong></div>
              <div><span className="text-gray-600">ΔT (Deficit):</span> <strong className="text-red-600">{lastResult.deltaT}</strong></div>
              <div><span className="text-gray-600">New Z-Score:</span> <strong>{lastResult.newZScore.toFixed(2)}</strong></div>
            </div>
            <p className="text-xs text-orange-800 mt-2">{lastResult.message}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-900">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Trigger Incident
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-gray-600">Select a zone to simulate a density spike (crowd surge, emergency event)</p>
            <div className="grid grid-cols-2 gap-2">
              {zones.map(zone => (
                <Button
                  key={zone._id}
                  variant={selectedZone === zone._id ? "default" : "outline"}
                  className={selectedZone === zone._id ? "bg-blue-600 hover:bg-blue-700" : ""}
                  onClick={() => triggerIncident(zone._id)}
                  disabled={zone.isDensitySpike}
                >
                  {zone.code}: {zone.name.split(" ")[0]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-900">
          <CardHeader className="bg-purple-50 border-b">
            <CardTitle className="text-purple-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Auto-Resolution Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <ResolutionStep number={1} title="Density Assessment" description="Calculate updated Z-score and required personnel delta (ΔT)" />
            <ResolutionStep number={2} title="Adjacent Pooling (Step A)" description="Siphon safe surplus from neighbouring green zones" />
            <ResolutionStep number={3} title="Standby Activation (Step B)" description="If needed, activate 15% global standby reserve pool" />
            <ResolutionStep number={4} title="Escalation Alert (Step C)" description="If reserves depleted, trigger manual override request" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-red-900">
        <CardHeader className="bg-red-50 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-red-900">Zone Status & Density Levels</CardTitle>
            <Button variant="outline" onClick={resetIncidents}>Reset All</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {zones.map(zone => {
              const densityPercentage = (zone.currentD / 10) * 100
              const newDensityPercentage = (zone.newD / 10) * 100

              return (
                <div key={zone._id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{zone.code} - {zone.name}</h3>
                      <p className="text-sm text-gray-600">Current Density Score</p>
                    </div>
                    <Badge className={zone.isDensitySpike ? "bg-red-100 text-red-800" : zone.status === "Resolved" ? "bg-green-100 text-green-800" : "bg-green-100 text-green-800"}>
                      {zone.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-gray-600">Current D Score</span>
                        <span className="text-sm font-bold text-gray-900">{zone.currentD} / 10</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${densityPercentage}%` }}
                        />
                      </div>
                    </div>

                    {zone.isDensitySpike && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-gray-600">New D Score (Post-Incident)</span>
                          <span className="text-sm font-bold text-red-600">{zone.newD} / 10</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${newDensityPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {zone.isDensitySpike && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="font-semibold text-red-900 text-sm">Personnel Deficit: {zone.deficit}</span>
                      </div>
                      <p className="text-xs text-red-800">Additional personnel required immediately</p>
                    </div>
                  )}

                  {!zone.isDensitySpike && zone.status !== "Resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerIncident(zone._id)}
                      className="w-full"
                    >
                      Simulate Incident
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {incidentZones > 0 && (
            <Button
              className="w-full mt-6 bg-green-600 hover:bg-green-700"
              onClick={resolveIncident}
              disabled={resolving}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Execute Auto-Resolution
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-l-4 border-l-amber-600">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="text-amber-900">System Notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 text-sm text-amber-900">
          <p>• Adjacent Pooling extracts surplus from &quot;green&quot; zones without dropping below safe threshold</p>
          <p>• Standby Pool (15% reserve) is activated when immediate neighbours cannot provide required strength</p>
          <p>• Critical Alert triggers when all resolution methods are exhausted</p>
          <p>• Fatigue scoring prevents deployment of high-fatigue officers to deficit zones</p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    red: "bg-red-50 border-l-red-500 text-red-900",
    orange: "bg-orange-50 border-l-orange-500 text-orange-900",
    blue: "bg-blue-50 border-l-blue-500 text-blue-900",
    green: "bg-green-50 border-l-green-500 text-green-900"
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

function ResolutionStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
          {number}
        </div>
      </div>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      </div>
    </div>
  )
}
