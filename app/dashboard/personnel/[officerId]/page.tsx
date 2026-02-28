"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Shield, ChevronLeft, Activity, Calendar, Clock, AlertTriangle } from "lucide-react"

interface FatigueHistoryEntry {
    date: string
    shift: string
    zoneId: string | null
    points: number
    reason: string
}

interface FatigueData {
    officerId: string
    badgeNumber: string
    name: string
    fatigueScore: number
    band: 'low' | 'moderate' | 'high' | 'critical'
    label: string
    history: FatigueHistoryEntry[]
    consecutiveNightShifts: number
    lastShiftEnd?: string
    nextAvailableAt?: string
}

export default function OfficerFatiguePage() {
    const params = useParams()
    const router = useRouter()
    const { officerId } = params as { officerId: string }

    const [data, setData] = useState<FatigueData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/personnel/${officerId}/fatigue`)
                const result = await res.json()
                if (result.success) setData(result.data)
            } catch (e) {
                console.error("Failed to fetch fatigue data:", e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [officerId])

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="p-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                    <ChevronLeft className="w-4 h-4" /> Back to Personnel
                </button>
                <div className="sentinel-card p-6 text-center text-muted-foreground">Officer not found.</div>
            </div>
        )
    }

    const bandColors = {
        low: "text-success bg-success-muted border-success",
        moderate: "text-accent bg-accent/10 border-accent",
        high: "text-warning bg-warning-muted border-warning",
        critical: "text-danger bg-danger-muted border-danger"
    }

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto animate-fade-in">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
                <ChevronLeft className="w-4 h-4" /> Back to Directory
            </button>

            {/* Header Profile */}
            <div className="sentinel-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-2 border-primary/20 bg-surface-raised flex items-center justify-center">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-display font-bold text-foreground">{data.name}</h1>
                            <span className="font-mono text-xs text-muted-foreground bg-surface-overlay px-2 py-0.5 rounded border border-border">
                                {data.badgeNumber}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-sm">Fatigue & Assignment Analysis Profile</p>
                    </div>
                </div>

                {/* Fatigue Status Bubble */}
                <div className="flex items-center gap-4 md:border-l border-border md:pl-6">
                    <div>
                        <p className="mono-data text-[10px] text-muted-foreground mb-1">CURRENT FATIGUE</p>
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-bold text-sm ${bandColors[data.band]}`}>
                            <Activity className="w-4 h-4" />
                            {data.label.toUpperCase()}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="mono-data text-[10px] text-muted-foreground mb-1">SCORE</p>
                        <p className="font-display text-3xl font-bold tracking-tight text-foreground">{data.fatigueScore.toFixed(1)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Col: Stats */}
                <div className="space-y-6">
                    <div className="sentinel-card p-5">
                        <h3 className="font-display font-semibold flex items-center gap-2 mb-4 border-b border-border pb-3">
                            <Clock className="w-4 h-4 text-primary" /> Active Metrics
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <p className="mono-data text-[10px] text-muted-foreground mb-1">CONSECUTIVE NIGHT SHIFTS</p>
                                <p className="font-mono text-lg font-medium">{data.consecutiveNightShifts} / 3</p>
                            </div>
                            {data.lastShiftEnd && (
                                <div>
                                    <p className="mono-data text-[10px] text-muted-foreground mb-1">LAST SHIFT ENDED</p>
                                    <p className="text-sm font-medium">{new Date(data.lastShiftEnd).toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="sentinel-card p-5 bg-surface-raised/50 border-warning/20">
                        <h3 className="font-display font-semibold flex items-center gap-2 mb-2 text-warning">
                            <AlertTriangle className="w-4 h-4" /> System Guardrails
                        </h3>
                        <ul className="text-xs text-muted-foreground space-y-2 mt-3 list-disc pl-4">
                            <li>Deployments accrue 1.0 - 3.0 fatigue points depending on shift weight and emergency status.</li>
                            <li>Scores above <strong>20.0 (Tired)</strong> are blocked from High/Critical threat zones.</li>
                            <li>Scores above <strong>30.0 (Exhausted)</strong> block the officer from all deployments.</li>
                            <li>Fatigue decays by 1.0 point for each full 24h rest period.</li>
                        </ul>
                    </div>
                </div>

                {/* Right Col: Timeline */}
                <div className="md:col-span-2 sentinel-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-border bg-surface-raised flex items-center justify-between">
                        <h3 className="font-display font-semibold flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" /> 30-Day Activity History
                        </h3>
                        <span className="mono-data text-[10px]">{data.history.length} RECORDS</span>
                    </div>

                    <div className="p-0">
                        {data.history.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No recent activity recorded for this officer.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-surface border-b border-border text-left">
                                        <th className="px-5 py-3 font-mono text-[10px] text-muted-foreground font-medium">DATE</th>
                                        <th className="px-5 py-3 font-mono text-[10px] text-muted-foreground font-medium">SHIFT</th>
                                        <th className="px-5 py-3 font-mono text-[10px] text-muted-foreground font-medium">ACCRUAL</th>
                                        <th className="px-5 py-3 font-mono text-[10px] text-muted-foreground font-medium">REASON</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {[...data.history].reverse().map((entry, i) => (
                                        <tr key={i} className="hover:bg-surface-raised transition-colors">
                                            <td className="px-5 py-3 text-foreground font-medium">
                                                {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="capitalize text-muted-foreground">{entry.shift}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="font-mono text-danger font-medium">+{entry.points.toFixed(1)}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-xs text-muted-foreground">{entry.reason}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
