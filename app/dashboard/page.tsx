/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import Link from "next/link"
import AlertBanner from "@/components/dashboard/AlertBanner"
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { Users, MapPin, AlertTriangle, Shield, Clock, TrendingUp, Settings } from "lucide-react"
import { Zone } from "@/lib/types/dashboard"
import { SHIFTS } from "@/lib/constants/shifts"
import dynamic from "next/dynamic"

const ZoneLeafletMap = dynamic(() => import("@/components/dashboard/ZoneLeafletMap"), { ssr: false, loading: () => <div className="h-[350px] flex items-center justify-center bg-gray-100 rounded-lg"><p className="text-gray-500">Loading map...</p></div> })

function calculateZScore(S: number, D: number, w_s = 0.3, w_d = 0.7) {
  return (w_s * S + w_d * D) / (w_s + w_d)
}
function resolveHeatmapColor(zScore: number) {
  const normalised = ((zScore - 1) / 9) * 10
  if (normalised >= 7.5) return 'red'
  if (normalised >= 5.0) return 'orange'
  if (normalised >= 2.5) return 'yellow'
  return 'green'
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState("")
  const [zones, setZones] = useState<Zone[]>([])
  const [, setLoading] = useState(true)
  const [totalForce, setTotalForce] = useState(0)
  const [standbyPct, setStandbyPct] = useState(0.15)
  const [weights, setWeights] = useState({ w_s: 0.3, w_d: 0.7 })
  const [configVersion, setConfigVersion] = useState(0)
  const [personnelStats, setPersonnelStats] = useState({ total: 0, deployed: 0, onLeave: 0, standby: 0 })
  useEffect(() => { setCurrentTime(new Date().toLocaleString()) }, [])

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

    // Fetch system config
    async function fetchConfig() {
      try {
        const res = await fetch('/api/settings')
        const result = await res.json()
        if (result.success && result.data) {
          setTotalForce(result.data.totalForce ?? 0)
          setStandbyPct(result.data.standbyPercentage ?? 0.15)
          setWeights(result.data.weights ?? { w_s: 0.3, w_d: 0.7 })
          setConfigVersion(result.data.version ?? 0)
        }
      } catch (err) { console.error('Failed to fetch config:', err) }
    }
    fetchConfig()

    // Fetch personnel stats
    async function fetchPersonnel() {
      try {
        const res = await fetch('/api/personnel?limit=500')
        const result = await res.json()
        if (result.success && result.data) {
          const all = result.data
          setPersonnelStats({
            total: all.length,
            deployed: all.filter((p: any) => p.status === 'Deployed').length,
            onLeave: all.filter((p: any) => p.status === 'OnLeave').length,
            standby: all.filter((p: any) => p.status === 'Standby').length,
          })
        }
      } catch (err) { console.error('Failed to fetch personnel:', err) }
    }
    fetchPersonnel()
  }, [])

  const totalDeployed = zones.reduce((sum, z) => sum + z.currentDeployment, 0)
  const standbyPoolSize = Math.floor(totalForce * standbyPct)
  const availableForReassignment = totalForce - totalDeployed - standbyPoolSize
  const criticalZones = zones.filter(z => z.currentDeployment > z.safeThreshold).length
  const utilizationRate = totalForce > 0 ? ((totalDeployed / totalForce) * 100).toFixed(1) : '0.0'

  // Determine current shift from clock
  const currentHour = new Date().getHours()
  const activeShift = currentHour >= 6 && currentHour < 14 ? 'Morning'
    : currentHour >= 14 && currentHour < 22 ? 'Evening' : 'Night'
  const activeShiftTime = activeShift === 'Morning' ? '06:00' : activeShift === 'Evening' ? '14:00' : '22:00'
  const standbyPctDisplay = Math.round(standbyPct * 100)

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">Operation Sentinel</h1>
            <p className="text-sm text-gray-600 mt-1">Police Control Room Command Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm text-gray-500">
              <p>Generated: {currentTime}</p>
              <p className="font-mono">Event: Major Public Event - 30 Day Schedule</p>
            </div>
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm" className="border-blue-900 text-blue-900 hover:bg-blue-50">
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {criticalZones > 0 && (
        <AlertBanner
          type="critical"
          title={`⚠️ CRITICAL: ${criticalZones} Zone(s) Over Capacity`}
          message={`Immediate rebalancing required. Click on Zones to reassign personnel or activate standby reserves.`}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Force"
          value={totalForce}
          subtext="Personnel"
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Deployed"
          value={totalDeployed}
          subtext={`${utilizationRate}% utilised`}
          icon={<Shield className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="Standby Pool"
          value={standbyPoolSize}
          subtext={`${standbyPctDisplay}% Reserve`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          label="Zones Active"
          value={zones.length}
          subtext={`${criticalZones} critical`}
          icon={<MapPin className="h-5 w-5" />}
          color={criticalZones > 0 ? "red" : "green"}
        />
        <StatCard
          label="Available"
          value={availableForReassignment}
          subtext="For Redeployment"
          icon={<TrendingUp className="h-5 w-5" />}
          color="indigo"
        />
        <StatCard
          label="Shift Time"
          value={activeShiftTime}
          subtext={`${activeShift} Active`}
          icon={<Clock className="h-5 w-5" />}
          color="purple"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-l-4 border-l-blue-900">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-blue-900">Geospatial Zone Map</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ZoneLeafletMap zones={zones} />
            <div className="mt-4">
              <ZoneHeatmap zones={zones} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-700">
          <CardHeader className="bg-green-50 border-b">
            <CardTitle className="text-green-900 text-base">Operational Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <StatusRow label="Morning Shift" status={activeShift === 'Morning' ? 'Active' : currentHour >= 14 ? 'Completed' : 'Scheduled'} count={personnelStats.deployed} />
            <StatusRow label="Evening Shift" status={activeShift === 'Evening' ? 'Active' : currentHour >= 22 || currentHour < 6 ? 'Completed' : 'Scheduled'} count={personnelStats.deployed} />
            <StatusRow label="Night Shift" status={activeShift === 'Night' ? 'Active' : 'Scheduled'} count={personnelStats.deployed} />
            <div className="border-t pt-4 mt-4">
              <p className="text-xs text-gray-500 font-semibold">ALERT SUMMARY</p>
              <div className="mt-2 space-y-1">
                <AlertItem label="Critical Zones" value={criticalZones} color="red" />
                <AlertItem label="Standby Officers" value={personnelStats.standby} color="yellow" />
                <AlertItem label="On Leave" value={personnelStats.onLeave} color="blue" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-t-4 border-t-indigo-600">
          <CardHeader className="bg-indigo-50 border-b">
            <CardTitle className="text-indigo-900 text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Link href="/dashboard/zones">
              <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                <MapPin className="mr-2 h-4 w-4" />
                Manage Zones
              </Button>
            </Link>
            <Link href="/dashboard/personnel">
              <Button className="w-full justify-start bg-green-600 hover:bg-green-700">
                <Users className="mr-2 h-4 w-4" />
                Personnel Management
              </Button>
            </Link>
            <Link href="/dashboard/roster">
              <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700">
                <Clock className="mr-2 h-4 w-4" />
                View 30-Day Roster
              </Button>
            </Link>
            <Link href="/dashboard/incidents">
              <Button className="w-full justify-start bg-red-600 hover:bg-red-700">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Incident Simulation
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-cyan-600">
          <CardHeader className="bg-cyan-50 border-b">
            <CardTitle className="text-cyan-900 text-base">System Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            <InfoRow label="Roster Period" value="30 Days" />
            <InfoRow label="Total Zones" value={zones.length} />
            <InfoRow label="Weight (Size)" value={weights.w_s.toFixed(2)} />
            <InfoRow label="Weight (Density)" value={weights.w_d.toFixed(2)} />
            <InfoRow label="Config Version" value={configVersion} />
            <InfoRow label="Last Updated" value={currentTime.split(",")[0] || ""} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  color
}: {
  label: string
  value: number | string
  subtext: string
  icon: React.ReactNode
  color: string
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-l-blue-500 text-blue-900",
    green: "bg-green-50 border-l-green-500 text-green-900",
    amber: "bg-amber-50 border-l-amber-500 text-amber-900",
    red: "bg-red-50 border-l-red-500 text-red-900",
    indigo: "bg-indigo-50 border-l-indigo-500 text-indigo-900",
    purple: "bg-purple-50 border-l-purple-500 text-purple-900"
  }

  return (
    <Card className={`border-l-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold opacity-75 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs mt-1 opacity-70">{subtext}</p>
          </div>
          <div className="opacity-50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusRow({ label, status, count }: { label: string; status: string; count: number }) {
  const statusColors = {
    Active: "bg-green-100 text-green-800",
    Completed: "bg-blue-100 text-blue-800",
    Scheduled: "bg-gray-100 text-gray-800"
  }

  return (
    <div className="flex items-center justify-between py-2 border-b pb-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Badge className={statusColors[status as keyof typeof statusColors]}>{status}</Badge>
        <span className="text-sm font-bold text-gray-700">{count}</span>
      </div>
    </div>
  )
}

function AlertItem({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    red: "text-red-600",
    yellow: "text-yellow-600",
    blue: "text-blue-600"
  }

  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>{value}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-600">{label}:</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  )
}