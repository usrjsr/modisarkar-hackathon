"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, RefreshCw, Calendar } from "lucide-react"

const SHIFT_DISPLAY = [
  { code: 'morning', label: 'Morning Shift', displayTime: '06:00 – 14:00' },
  { code: 'evening', label: 'Evening Shift', displayTime: '14:00 – 22:00' },
  { code: 'night', label: 'Night Shift', displayTime: '22:00 – 06:00' },
] as const

interface RosterData {
  _id: string
  generatedAt: string
  validFrom: string
  validUntil: string
  configSnapshot: {
    totalForce: number
    weights: { w_s: number; w_d: number }
    standbyPool: number
    totalZones: number
  }
  schedule: Array<{
    date: string
    dayOfWeek: number
    isHoliday: boolean
    shifts: {
      morning: ShiftBlock
      evening: ShiftBlock
      night: ShiftBlock
    }
    fatigueMatrix: Record<string, any>
  }>
  violations: Array<{
    type: string
    description: string
    severity: string
  }>
  isActive: boolean
}

interface ShiftBlock {
  shift: string
  startTime: string
  endTime: string
  standbyCount: number
  deployments: Array<{
    zoneId: string
    totalStrength: number
    requiredStrength: number
    deficit: number
    status: string
  }>
  totalDeployed?: number
  totalRequired?: number
}

export default function RosterPage() {
  const [roster, setRoster] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActiveRoster()
  }, [])

  const fetchActiveRoster = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roster?active=true')
      const result = await res.json()
      if (result.success && result.data) {
        setRoster(result.data)
      } else {
        setRoster(null)
      }
    } catch (err) {
      setError('Failed to fetch roster')
    } finally {
      setLoading(false)
    }
  }

  const generateRoster = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date().toISOString(),
        })
      })
      const result = await res.json()
      if (result.success) {
        await fetchActiveRoster()
      } else {
        setError(result.error || 'Failed to generate roster')
      }
    } catch (err) {
      setError('Error generating roster')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading roster...</p>
      </div>
    )
  }

  // No active roster — show Generate button
  if (!roster) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-blue-900 pb-4">
          <h1 className="text-3xl font-bold text-blue-900">30-Day Roster Schedule</h1>
          <p className="text-sm text-gray-600 mt-1">Comprehensive Personnel Deployment Schedule</p>
        </div>

        {error && (
          <Card className="bg-red-50 border-l-4 border-l-red-600">
            <CardContent className="pt-6">
              <p className="text-red-900 font-semibold">Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-l-4 border-l-blue-900">
          <CardContent className="pt-6 text-center">
            <Calendar className="h-16 w-16 text-blue-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900">No Active Roster</h3>
            <p className="text-sm text-gray-600 mt-2 mb-6">
              Generate a 30-day, 3-shift deployment schedule based on current zones, personnel, and system config.
            </p>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={generateRoster}
              disabled={generating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating Roster...' : 'Generate 30-Day Roster'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // We have an active roster — show it
  const schedule = roster.schedule || []
  const weekData = schedule.slice(currentWeekStart, currentWeekStart + 7)
  const maxWeekStart = Math.max(0, schedule.length - 7)

  const getShiftTotal = (shiftBlock: ShiftBlock | undefined): { deployed: number; required: number } => {
    if (!shiftBlock) return { deployed: 0, required: 0 }
    // Use shift-level totals if available, otherwise compute from deployments
    const deployed = shiftBlock.totalDeployed
      ?? (shiftBlock.deployments || []).reduce((s, d) => s + (d.totalStrength ?? 0), 0)
    const required = shiftBlock.totalRequired
      ?? (shiftBlock.deployments || []).reduce((s, d) => s + (d.requiredStrength ?? 0), 0)
    return { deployed, required }
  }

  const totalDeployed = schedule.reduce((sum, day) => {
    const m = getShiftTotal(day.shifts?.morning)
    const e = getShiftTotal(day.shifts?.evening)
    const n = getShiftTotal(day.shifts?.night)
    return sum + m.deployed + e.deployed + n.deployed
  }, 0)

  const totalRequired = schedule.reduce((sum, day) => {
    const m = getShiftTotal(day.shifts?.morning)
    const e = getShiftTotal(day.shifts?.evening)
    const n = getShiftTotal(day.shifts?.night)
    return sum + m.required + e.required + n.required
  }, 0)

  const utilizationRate = totalRequired > 0 ? ((totalDeployed / totalRequired) * 100).toFixed(1) : '0.0'

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
    catch { return d }
  }

  const formatWeekday = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short' }) }
    catch { return '' }
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">30-Day Roster Schedule</h1>
        <p className="text-sm text-gray-600 mt-1">
          Generated: {new Date(roster.generatedAt).toLocaleString()} |
          Valid: {formatDate(roster.validFrom)} – {formatDate(roster.validUntil)}
        </p>
      </div>

      {error && (
        <Card className="bg-red-50 border-l-4 border-l-red-600">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500 bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Roster Period</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{schedule.length} Days</p>
            <p className="text-xs text-gray-600 mt-1">{formatDate(roster.validFrom)} – {formatDate(roster.validUntil)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-green-50">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Avg Daily Strength</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{schedule.length > 0 ? (totalDeployed / (schedule.length * 3)).toFixed(0) : 0}</p>
            <p className="text-xs text-gray-600 mt-1">Across all shifts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-purple-50">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Utilization Rate</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{utilizationRate}%</p>
            <p className="text-xs text-gray-600 mt-1">Capacity Used</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Violations</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{roster.violations?.length ?? 0}</p>
            <p className="text-xs text-gray-600 mt-1">
              {(roster.violations?.filter(v => v.severity === 'critical').length ?? 0)} critical
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-blue-900">
        <CardHeader className="bg-blue-50 border-b">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <CardTitle className="text-blue-900">Weekly Deployment View</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Week {Math.floor(currentWeekStart / 7) + 1} | {weekData.length > 0 ? `${formatDate(weekData[0].date)} – ${formatDate(weekData[weekData.length - 1].date)}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentWeekStart(Math.max(0, currentWeekStart - 7))} disabled={currentWeekStart === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentWeekStart(Math.min(maxWeekStart, currentWeekStart + 7))} disabled={currentWeekStart >= maxWeekStart}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={generateRoster}
                disabled={generating}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Regenerating...' : 'Regenerate'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Shift</th>
                  {weekData.map((day, idx) => (
                    <th key={idx} className="text-center px-3 py-2 font-semibold text-gray-700">
                      <div className="font-bold">{formatDate(day.date)}</div>
                      <div className="text-gray-500 text-xs">{formatWeekday(day.date)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFT_DISPLAY.map(shift => (
                  <tr key={shift.code} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-semibold text-gray-700 bg-gray-50">
                      <div>{shift.label}</div>
                      <div className="text-xs text-gray-500">{shift.displayTime}</div>
                    </td>
                    {weekData.map((day, idx) => {
                      const shiftData = day.shifts?.[shift.code as keyof typeof day.shifts]
                      const totals = getShiftTotal(shiftData)
                      const isDeficit = totals.required > 0 && totals.deployed < totals.required * 0.85

                      return (
                        <td key={idx} className="text-center px-3 py-3">
                          <div className={`p-2 rounded-lg ${isDeficit ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                            <div className="font-bold text-gray-900">{totals.deployed}</div>
                            <div className="text-xs text-gray-600">/ {totals.required}</div>
                            <Badge variant={isDeficit ? "destructive" : "outline"} className="mt-1 text-xs">
                              {isDeficit ? "Deficit" : "OK"}
                            </Badge>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-l-4 border-l-blue-600">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">Scheduling Algorithm Parameters</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <InfoItem label="Weight (Size)" value={`${roster.configSnapshot?.weights?.w_s ?? 0.3}`} />
            <InfoItem label="Weight (Density)" value={`${roster.configSnapshot?.weights?.w_d ?? 0.7}`} />
            <InfoItem label="Standby Pool" value="15%" />
            <InfoItem label="Min Rest Hours" value="8-12 hrs" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-600 font-semibold uppercase">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  )
}
