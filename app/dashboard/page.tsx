"use client"

import Link from "next/link"
import AlertBanner from "@/components/dashboard/AlertBanner"
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, MapPin, AlertTriangle, Shield, Clock, TrendingUp } from "lucide-react"
import { Zone } from "@/lib/types/dashboard"
import { SHIFTS } from "@/lib/constants/shifts"

export default function DashboardPage() {
  const zones: Zone[] = [
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
      centroid: { coordinates: [77.24, 28.65] as [number, number] }
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
      centroid: { coordinates: [77.25, 28.50] as [number, number] }
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
      centroid: { coordinates: [77.35, 28.58] as [number, number] }
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
      centroid: { coordinates: [77.10, 28.58] as [number, number] }
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
      centroid: { coordinates: [77.22, 28.60] as [number, number] }
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
      centroid: { coordinates: [77.15, 28.48] as [number, number] }
    }
  ]

  const totalForce = 1270
  const totalDeployed = zones.reduce((sum, z) => sum + z.currentDeployment, 0)
  const standbyPoolSize = Math.floor(totalForce * 0.15)
  const availableForReassignment = totalForce - totalDeployed - standbyPoolSize
  const criticalZones = zones.filter(z => z.currentDeployment > z.safeThreshold).length
  const utilizationRate = ((totalDeployed / totalForce) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">Operation Sentinel</h1>
            <p className="text-sm text-gray-600 mt-1">Police Control Room Command Dashboard</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Generated: {new Date().toLocaleString()}</p>
            <p className="font-mono">Event: Major Public Event - 30 Day Schedule</p>
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
          subtext="15% Reserve"
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
          value="14:00"
          subtext="Evening Active"
          icon={<Clock className="h-5 w-5" />}
          color="purple"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-l-4 border-l-blue-900">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-blue-900">Strategic Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ZoneHeatmap zones={zones} />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-700">
          <CardHeader className="bg-green-50 border-b">
            <CardTitle className="text-green-900 text-base">Operational Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <StatusRow label="Morning Shift" status="Completed" count={650} />
            <StatusRow label="Evening Shift" status="Active" count={680} />
            <StatusRow label="Night Shift" status="Scheduled" count={645} />
            <div className="border-t pt-4 mt-4">
              <p className="text-xs text-gray-500 font-semibold">ALERT SUMMARY</p>
              <div className="mt-2 space-y-1">
                <AlertItem label="Critical Zones" value={criticalZones} color="red" />
                <AlertItem label="Pending Approvals" value={3} color="yellow" />
                <AlertItem label="Leave Requests" value={7} color="blue" />
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
            <InfoRow label="Weight (Size)" value="0.40" />
            <InfoRow label="Weight (Density)" value="0.60" />
            <InfoRow label="DB Version" value="1.0.0" />
            <InfoRow label="Last Updated" value={new Date().toLocaleDateString()} />
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