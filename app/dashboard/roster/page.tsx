/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Calendar, Clock, Activity, AlertTriangle, BarChart3, X, Users, Shield, MapPin } from "lucide-react"

const SHIFT_DISPLAY = [
  { code: "morning", label: "Morning Shift", displayTime: "06:00 – 14:00" },
  { code: "evening", label: "Evening Shift", displayTime: "14:00 – 22:00" },
  { code: "night", label: "Night Shift", displayTime: "22:00 – 06:00" },
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

interface ShiftDetailData {
  date: string
  shift: string
  startTime: string
  endTime: string
  standbyCount: number
  totalDeployed: number
  totalRequired: number
  deployments: Array<{
    zoneId: string
    zoneName: string
    zoneCode: string
    heatmapColor: string
    totalStrength: number
    requiredStrength: number
    deficit: number
    status: string
    personnel: Array<{
      _id: string
      name: string
      badgeNumber: string
      rank: string
      status: string
      fatigueScore: number
    }>
  }>
}

export default function RosterPage() {
  const [roster, setRoster] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [shiftDetail, setShiftDetail] = useState<ShiftDetailData | null>(null)
  const [shiftDetailLoading, setShiftDetailLoading] = useState(false)
  const [expandedZone, setExpandedZone] = useState<string | null>(null)

  useEffect(() => {
    fetchActiveRoster()
  }, [])

  const handleShiftClick = useCallback(async (date: string, shiftCode: string) => {
    setShiftDetailLoading(true)
    setShiftDetail(null)
    setExpandedZone(null)
    try {
      const res = await fetch(`/api/roster/shift?date=${encodeURIComponent(date)}&shift=${shiftCode}`)
      const result = await res.json()
      if (result.success && result.data) {
        setShiftDetail(result.data)
      }
    } catch {
      console.error('Failed to fetch shift details')
    } finally {
      setShiftDetailLoading(false)
    }
  }, [])

  const fetchActiveRoster = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/roster?active=true")
      const result = await res.json()
      if (result.success && result.data) {
        setRoster(result.data)
      } else {
        setRoster(null)
      }
    } catch {
      setError("Failed to fetch roster")
    } finally {
      setLoading(false)
    }
  }

  const generateRoster = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: new Date().toISOString() }),
      })
      const result = await res.json()
      if (result.success) {
        await fetchActiveRoster()
      } else {
        setError(result.error || "Failed to generate roster")
      }
    } catch {
      setError("Error generating roster")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <span className="status-dot-pulse bg-primary" />
          <span className="mono-data">LOADING ROSTER...</span>
        </div>
      </div>
    )
  }

  if (!roster) {
    return (
      <div className="p-4 md:p-6 space-y-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="tag-primary">ROSTER</span>
              <span className="tag-warning">INACTIVE</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              30-Day Roster Schedule
            </h1>
            <p className="mono-data mt-1">Comprehensive Personnel Deployment Schedule</p>
          </div>
        </div>

        {error && (
          <div className="sentinel-card border-l-4 border-l-danger p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-danger text-sm">Error</p>
                <p className="mono-data text-[11px] mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="sentinel-card p-10 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-md bg-surface-raised border border-border mb-5">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-display text-xl font-bold text-foreground mb-2">No Active Roster</p>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Generate a 30-day, 3-shift deployment schedule based on current zones, personnel, and system configuration.
          </p>
          <button
            onClick={generateRoster}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating Roster..." : "Generate 30-Day Roster"}
          </button>
        </div>
      </div>
    )
  }

  const schedule = roster.schedule || []
  const weekData = schedule.slice(currentWeekStart, currentWeekStart + 7)
  const maxWeekStart = Math.max(0, schedule.length - 7)

  const getShiftTotal = (shiftBlock: ShiftBlock | undefined): { deployed: number; required: number } => {
    if (!shiftBlock) return { deployed: 0, required: 0 }
    const deployed = shiftBlock.totalDeployed ?? (shiftBlock.deployments || []).reduce((s, d) => s + (d.totalStrength ?? 0), 0)
    const required = shiftBlock.totalRequired ?? (shiftBlock.deployments || []).reduce((s, d) => s + (d.requiredStrength ?? 0), 0)
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

  const utilizationRate = totalRequired > 0 ? ((totalDeployed / totalRequired) * 100).toFixed(1) : "0.0"
  const criticalViolations = roster.violations?.filter(v => v.severity === "critical").length ?? 0

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
    catch { return d }
  }

  const formatWeekday = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { weekday: "short" }) }
    catch { return "" }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-primary">ROSTER</span>
            <span className="tag-success">ACTIVE</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            30-Day Roster Schedule
          </h1>
          <p className="mono-data mt-1">
            Generated: {new Date(roster.generatedAt).toLocaleString()} · Valid:{" "}
            {formatDate(roster.validFrom)} – {formatDate(roster.validUntil)}
          </p>
        </div>
        <button
          onClick={generateRoster}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Regenerating..." : "Regenerate"}
        </button>
      </div>

      {error && (
        <div className="sentinel-card border-l-4 border-l-danger p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="mono-data text-[11px] text-danger">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Roster Period",
            value: `${schedule.length} Days`,
            sub: `${formatDate(roster.validFrom)} – ${formatDate(roster.validUntil)}`,
            icon: Calendar,
            accent: "primary",
          },
          {
            label: "Avg Daily Strength",
            value: schedule.length > 0 ? (totalDeployed / (schedule.length * 3)).toFixed(0) : "0",
            sub: "Across all shifts",
            icon: Activity,
            accent: "success",
          },
          {
            label: "Utilisation Rate",
            value: `${utilizationRate}%`,
            sub: "Capacity used",
            icon: BarChart3,
            accent: parseFloat(utilizationRate) > 85 ? "danger" : "success",
          },
          {
            label: "Violations",
            value: roster.violations?.length ?? 0,
            sub: `${criticalViolations} critical`,
            icon: AlertTriangle,
            accent: criticalViolations > 0 ? "danger" : "warning",
          },
        ].map(s => {
          const borderMap: Record<string, string> = { primary: "border-t-primary", success: "border-t-success", danger: "border-t-danger", warning: "border-t-warning" }
          const textMap: Record<string, string> = { primary: "text-primary", success: "text-success", danger: "text-danger", warning: "text-warning" }
          return (
            <div key={s.label} className={`sentinel-card border-t-2 ${borderMap[s.accent]} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="mono-data text-[10px]">{s.label}</span>
                <s.icon className={`w-3.5 h-3.5 ${textMap[s.accent]}`} />
              </div>
              <p className={`font-display text-2xl font-bold ${textMap[s.accent]}`}>{s.value}</p>
              <p className="mono-data text-[10px] mt-1">{s.sub}</p>
            </div>
          )
        })}
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm text-foreground">Weekly Deployment View</span>
            </div>
            <p className="mono-data text-[10px] mt-0.5">
              Week {Math.floor(currentWeekStart / 7) + 1}
              {weekData.length > 0 && ` · ${formatDate(weekData[0].date)} – ${formatDate(weekData[weekData.length - 1].date)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeekStart(Math.max(0, currentWeekStart - 7))}
              disabled={currentWeekStart === 0}
              className="flex items-center justify-center w-8 h-8 border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-3 py-1.5 bg-surface-overlay border border-border rounded-md text-foreground">
              {Math.floor(currentWeekStart / 7) + 1} / {Math.ceil(schedule.length / 7)}
            </span>
            <button
              onClick={() => setCurrentWeekStart(Math.min(maxWeekStart, currentWeekStart + 7))}
              disabled={currentWeekStart >= maxWeekStart}
              className="flex items-center justify-center w-8 h-8 border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="text-left px-4 py-3">
                  <span className="mono-data text-[10px]">SHIFT</span>
                </th>
                {weekData.map((day, idx) => (
                  <th key={idx} className="text-center px-3 py-3">
                    <div className="font-mono font-bold text-foreground text-xs">{formatDate(day.date)}</div>
                    <div className="mono-data text-[10px]">{formatWeekday(day.date)}</div>
                    {day.isHoliday && (
                      <span className="inline-block mt-0.5 font-mono text-[9px] font-bold px-1.5 py-0.5 bg-warning-muted border border-warning text-warning rounded-sm">
                        HOL
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SHIFT_DISPLAY.map(shift => (
                <tr key={shift.code} className="hover:bg-surface-raised transition-colors duration-100">
                  <td className="px-4 py-3 bg-surface-raised border-r border-border">
                    <p className="font-semibold text-foreground text-xs">{shift.label}</p>
                    <p className="mono-data text-[10px] mt-0.5">{shift.displayTime}</p>
                  </td>
                  {weekData.map((day, idx) => {
                    const shiftData = day.shifts?.[shift.code as keyof typeof day.shifts]
                    const totals = getShiftTotal(shiftData)
                    const isDeficit = totals.required > 0 && totals.deployed < totals.required * 0.85

                    return (
                      <td key={idx} className="text-center px-3 py-3">
                        <button
                          onClick={() => handleShiftClick(day.date, shift.code)}
                          className={`w-full p-2 rounded-md border cursor-pointer transition-all duration-150 hover:scale-105 hover:shadow-md ${isDeficit ? "bg-danger-muted border-danger hover:border-danger" : "bg-success-muted border-success hover:border-success"
                            }`}
                        >
                          <p className={`font-mono font-bold text-sm ${isDeficit ? "text-danger" : "text-success"}`}>
                            {totals.deployed}
                          </p>
                          <p className="mono-data text-[10px]">/ {totals.required}</p>
                          <span className={`inline-block mt-1 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-sm border ${isDeficit
                              ? "bg-danger-muted border-danger text-danger"
                              : "bg-success-muted border-success text-success"
                            }`}>
                            {isDeficit ? "DEFICIT" : "OK"}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-raised">
          <span className="font-display font-semibold text-sm text-foreground">Scheduling Algorithm Parameters</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Weight (Size)", value: `${roster.configSnapshot?.weights?.w_s ?? 0.3}` },
            { label: "Weight (Density)", value: `${roster.configSnapshot?.weights?.w_d ?? 0.7}` },
            { label: "Standby Pool", value: "15%" },
            { label: "Min Rest Hours", value: "8–12 hrs" },
          ].map(item => (
            <div key={item.label} className="bg-surface-raised border border-border rounded-md p-3">
              <p className="mono-data text-[10px] mb-1">{item.label}</p>
              <p className="font-mono font-bold text-lg text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shift Detail Modal */}
      {(shiftDetail || shiftDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4 animate-slide-in-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-raised rounded-t-lg">
              <div>
                {shiftDetail ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-display font-semibold text-sm text-foreground">
                        {shiftDetail.shift.charAt(0).toUpperCase() + shiftDetail.shift.slice(1)} Shift
                      </span>
                      <span className="tag-primary">
                        {shiftDetail.startTime} – {shiftDetail.endTime}
                      </span>
                    </div>
                    <p className="mono-data text-[10px]">
                      {new Date(shiftDetail.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="status-dot-pulse bg-primary" />
                    <span className="mono-data">LOADING SHIFT DETAILS...</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setShiftDetail(null); setExpandedZone(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {shiftDetailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex items-center gap-3">
                    <span className="status-dot-pulse bg-primary" />
                    <span className="mono-data">FETCHING DEPLOYMENT DATA...</span>
                  </div>
                </div>
              ) : shiftDetail ? (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="sentinel-card border-t-2 border-t-primary p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span className="mono-data text-[10px]">Deployed</span>
                      </div>
                      <p className="font-display text-xl font-bold text-primary">{shiftDetail.totalDeployed}</p>
                    </div>
                    <div className="sentinel-card border-t-2 border-t-success p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Shield className="w-3.5 h-3.5 text-success" />
                        <span className="mono-data text-[10px]">Required</span>
                      </div>
                      <p className="font-display text-xl font-bold text-success">{shiftDetail.totalRequired}</p>
                    </div>
                    <div className="sentinel-card border-t-2 border-t-warning p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-warning" />
                        <span className="mono-data text-[10px]">Zones</span>
                      </div>
                      <p className="font-display text-xl font-bold text-warning">{shiftDetail.deployments.length}</p>
                    </div>
                  </div>

                  {/* Per-Zone Deployment Cards */}
                  <div className="space-y-2">
                    {shiftDetail.deployments.map(dep => {
                      const isExpanded = expandedZone === dep.zoneId
                      const hasDeficit = dep.deficit > 0
                      const threatColors: Record<string, string> = {
                        red: 'border-l-danger',
                        orange: 'border-l-warning',
                        yellow: 'border-l-warning',
                        green: 'border-l-success',
                      }

                      return (
                        <div key={dep.zoneId} className={`sentinel-card border-l-4 ${threatColors[dep.heatmapColor] || 'border-l-primary'} overflow-hidden`}>
                          <button
                            onClick={() => setExpandedZone(isExpanded ? null : dep.zoneId)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-raised transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-display font-semibold text-sm text-foreground text-left">{dep.zoneName}</p>
                                <p className="mono-data text-[10px] text-left">{dep.zoneCode}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`font-mono font-bold text-sm ${hasDeficit ? 'text-danger' : 'text-success'}`}>
                                  {dep.totalStrength} / {dep.requiredStrength}
                                </p>
                                <p className="mono-data text-[10px]">
                                  {hasDeficit ? `${dep.deficit} deficit` : 'Fully staffed'}
                                </p>
                              </div>
                              <span className={`font-mono text-[9px] font-bold px-2 py-1 rounded-sm border ${hasDeficit ? 'bg-danger-muted border-danger text-danger' : 'bg-success-muted border-success text-success'
                                }`}>
                                {dep.personnel.length} OFFICERS
                              </span>
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-border animate-fade-in">
                              {dep.personnel.length === 0 ? (
                                <div className="px-4 py-6 text-center">
                                  <span className="mono-data text-[11px]">NO PERSONNEL DATA AVAILABLE</span>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border bg-surface-raised">
                                        {['Badge', 'Name', 'Rank', 'Status', 'Fatigue'].map(h => (
                                          <th key={h} className="px-4 py-2 text-left">
                                            <span className="mono-data text-[10px]">{h}</span>
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {dep.personnel.map(officer => {
                                        const fatigueLevel = officer.fatigueScore > 20 ? 'warning' : 'success'
                                        return (
                                          <tr key={officer._id} className="hover:bg-surface-raised transition-colors">
                                            <td className="px-4 py-2">
                                              <span className="font-mono text-xs text-muted-foreground">{officer.badgeNumber}</span>
                                            </td>
                                            <td className="px-4 py-2">
                                              <span className="font-semibold text-sm text-foreground">{officer.name}</span>
                                            </td>
                                            <td className="px-4 py-2">
                                              <span className="text-sm text-muted-foreground">{officer.rank}</span>
                                            </td>
                                            <td className="px-4 py-2">
                                              <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded-sm border ${officer.status === 'Deployed'
                                                  ? 'bg-success-muted border-success text-success'
                                                  : 'bg-primary-muted border-primary text-primary'
                                                }`}>
                                                {officer.status?.toUpperCase()}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2">
                                              <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded-sm border ${fatigueLevel === 'warning'
                                                  ? 'bg-warning-muted border-warning text-warning'
                                                  : 'bg-success-muted border-success text-success'
                                                }`}>
                                                {officer.fatigueScore?.toFixed(1)}%
                                              </span>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}