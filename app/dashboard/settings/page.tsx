"use client"

import { useState, useEffect } from "react"
import { Settings, Save, AlertCircle, RefreshCw, CheckCircle } from "lucide-react"

const RANK_GROUPS = [
  { label: "Command Level (not field-deployed)", ranks: ["DGP", "ADGP", "IG"] as const },
  { label: "Strategic Oversight", ranks: ["DIG", "SP"] as const },
  { label: "Zone Managers", ranks: ["DSP", "ASP", "Inspector"] as const },
  { label: "Sector Duty", ranks: ["SI", "ASI", "HeadConstable", "Constable"] as const },
]

const DEFAULT_COMPOSITION: Record<string, number> = {
  DGP: 1,
  ADGP: 2,
  IG: 5,
  DIG: 10,
  SP: 15,
  DSP: 20,
  ASP: 25,
  Inspector: 50,
  SI: 80,
  ASI: 100,
  HeadConstable: 200,
  Constable: 492,
}

export default function SettingsPage() {
  const [config, setConfig] = useState({
    totalForce: 1000,
    standbyPercentage: 15,
    weightSize: 0.3,
    weightDensity: 0.7,
    minRestHours: 8,
    minRestHoursInspector: 12,
    rosterDays: 30,
    shiftsPerDay: 3,
  })

  const [forceComposition, setForceComposition] = useState<Record<string, number>>({ ...DEFAULT_COMPOSITION })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState("")
  const [configVersion, setConfigVersion] = useState(0)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      const result = await res.json()
      if (result.success && result.data) {
        const d = result.data
        setConfig({
          totalForce: d.totalForce ?? 1000,
          standbyPercentage: Math.round((d.standbyPercentage ?? 0.15) * 100),
          weightSize: d.weights?.w_s ?? 0.3,
          weightDensity: d.weights?.w_d ?? 0.7,
          minRestHours: d.restHours?.lowerRanks ?? 8,
          minRestHoursInspector: d.restHours?.inspectors ?? 12,
          rosterDays: 30,
          shiftsPerDay: 3,
        })
        if (d.forceComposition) {
          setForceComposition(prev => ({ ...prev, ...d.forceComposition }))
        }
        setConfigVersion(d.version ?? 0)
        if (d.updatedAt) {
          setLastUpdated(new Date(d.updatedAt).toLocaleString())
        }
      }
    } catch {
      // No config found — use defaults
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalForce: config.totalForce,
          weights: {
            w_s: config.weightSize,
            w_d: config.weightDensity,
          },
          standbyPercentage: config.standbyPercentage / 100,
          restHours: {
            lowerRanks: config.minRestHours,
            inspectors: config.minRestHoursInspector,
          },
          forceComposition,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        setLastUpdated(new Date().toLocaleString())
        setConfigVersion(prev => prev + 1)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error || "Failed to save config")
      }
    } catch {
      setError("Error saving configuration")
    } finally {
      setSaving(false)
    }
  }

  const handleConfigChange = (field: string, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const verifyConfig = () => {
    const errors = []
    if (config.totalForce < 100) {
      errors.push("Total force must be at least 100")
    }
    if (config.standbyPercentage < 10 || config.standbyPercentage > 30) {
      errors.push("Standby percentage should be between 10-30%")
    }
    return errors
  }

  const validationErrors = verifyConfig()
  const standbyCount = Math.floor(config.totalForce * (config.standbyPercentage / 100))
  const activeForce = config.totalForce - standbyCount
  const compositionSum = Object.values(forceComposition).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <span className="status-dot-pulse bg-primary" />
          <span className="mono-data">LOADING CONFIGURATION...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">

      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="tag-primary">SETTINGS</span>
          <span className="tag-primary">ADMIN</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">System Settings & Configuration</h1>
        <p className="mono-data mt-2">Operation Sentinel - Global Parameters & Force Composition</p>
      </div>

      {saved && (
        <div className="sentinel-card border-l-4 border-l-success bg-success-muted p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-success text-sm">Configuration Saved</p>
              <p className="mono-data text-[11px] mt-0.5 text-success">Settings updated to database successfully</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="sentinel-card border-l-4 border-l-danger bg-danger-muted p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-danger text-sm">Error</p>
              <p className="mono-data text-[11px] mt-0.5 text-danger">{error}</p>
            </div>
          </div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="sentinel-card border-l-4 border-l-warning bg-warning-muted p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warning text-sm">Configuration Errors</p>
              <ul className="mono-data text-[10px] mt-2 space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="sentinel-card border-t-2 border-t-primary p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="mono-data text-[10px]">Total Available Force</span>
          </div>
          <p className="font-display text-3xl font-bold text-primary">{config.totalForce}</p>
          <p className="mono-data text-[10px] mt-1 text-muted-foreground">Personnel</p>
        </div>

        <div className="sentinel-card border-t-2 border-t-success p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="mono-data text-[10px]">Active Deployment</span>
          </div>
          <p className="font-display text-3xl font-bold text-success">{activeForce}</p>
          <p className="mono-data text-[10px] mt-1 text-muted-foreground">Available force</p>
        </div>

        <div className="sentinel-card border-t-2 border-t-warning p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="mono-data text-[10px]">Standby Reserve</span>
          </div>
          <p className="font-display text-3xl font-bold text-warning">{standbyCount}</p>
          <p className="mono-data text-[10px] mt-1 text-muted-foreground">{config.standbyPercentage}% reserve</p>
        </div>
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-raised">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-sm text-foreground">Force Composition (per rank)</span>
            <span className={`font-mono text-xs font-bold px-2 py-1 rounded-sm border ${
              compositionSum === config.totalForce
                ? "border-success bg-success-muted text-success"
                : "border-warning bg-warning-muted text-warning"
            }`}>
              Sum: {compositionSum} / {config.totalForce}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {RANK_GROUPS.map(group => (
            <div key={group.label}>
              <p className="mono-data text-[10px] uppercase tracking-widest mb-3">{group.label}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {group.ranks.map(rank => (
                  <div key={rank}>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">{rank}</label>
                    <input
                      type="number"
                      min="0"
                      value={forceComposition[rank] ?? 0}
                      onChange={e => setForceComposition(prev => ({ ...prev, [rank]: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {compositionSum !== config.totalForce && (
            <div className="sentinel-card border-l-4 border-l-warning bg-warning-muted p-3">
              <p className="mono-data text-[10px] text-warning font-bold">
                ⚠ Composition sum ({compositionSum}) does not match Total Force ({config.totalForce})
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="sentinel-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">Force Configuration</span>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Total Personnel (F)</label>
                <input
                  type="number"
                  value={config.totalForce}
                  onChange={e => handleConfigChange("totalForce", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Standby % (Reserve)</label>
                <input
                  type="number"
                  min="10"
                  max="30"
                  value={config.standbyPercentage}
                  onChange={e => handleConfigChange("standbyPercentage", parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sentinel-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-raised">
            <span className="font-display font-semibold text-sm text-foreground">Scheduling Algorithm</span>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-primary-muted border border-primary rounded-md p-3">
              <p className="text-xs font-bold text-primary mb-1">Formula: Z = (w_s · S + w_d · D) / (w_s + w_d)</p>
              <p className="mono-data text-[10px] text-primary">Determines personnel distribution across zones</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Weight: Size (w_s)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.weightSize}
                  onChange={e => handleConfigChange("weightSize", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Weight: Density (w_d)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.weightDensity}
                  onChange={e => handleConfigChange("weightDensity", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Roster Duration</label>
                <input
                  type="number"
                  value={config.rosterDays}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-surface-overlay border border-border rounded-md text-muted-foreground"
                />
              </div>
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Shifts Per Day</label>
                <input
                  type="number"
                  value={config.shiftsPerDay}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-surface-overlay border border-border rounded-md text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sentinel-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-raised">
          <span className="font-display font-semibold text-sm text-foreground">Rest & Fatigue Parameters</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Min Rest Hours (Sector Duty)</label>
              <input
                type="number"
                value={config.minRestHours}
                onChange={e => handleConfigChange("minRestHours", parseInt(e.target.value) || 8)}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <p className="mono-data text-[10px] text-muted-foreground mt-1">Constables, ASI, SI, Head Constables</p>
            </div>
            <div>
              <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Min Rest Hours (Zone Managers)</label>
              <input
                type="number"
                value={config.minRestHoursInspector}
                onChange={e => handleConfigChange("minRestHoursInspector", parseInt(e.target.value) || 12)}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <p className="mono-data text-[10px] text-muted-foreground mt-1">Inspectors, ASP, DSP</p>
            </div>
          </div>

          <div className="bg-accent-muted border border-accent rounded-md p-3">
            <p className="font-semibold text-xs text-accent mb-2">Fatigue Multipliers by Shift</p>
            <ul className="mono-data text-[10px] space-y-1 text-accent">
              <li>• Morning: 1.0x (standard fatigue)</li>
              <li>• Evening: 1.0x (standard fatigue)</li>
              <li>• Night: 1.5x (heavy accumulation)</li>
              <li>• Emergency Deployment: 2.0x</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={validationErrors.length > 0 || saving}
          className={`
            flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-semibold text-sm
            transition-all duration-150
            ${
              validationErrors.length > 0 || saving
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }
          `}
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>

      <div className="sentinel-card border-t-2 border-t-primary p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display font-semibold text-sm text-foreground">System Status</span>
          <span className="tag-success">Production</span>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between py-2">
            <span className="mono-data text-[10px]">Config Version</span>
            <span className="font-mono font-bold text-sm text-foreground">v{configVersion}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="mono-data text-[10px]">Last Updated</span>
            <span className="font-mono text-xs text-foreground">{lastUpdated || "Never"}</span>
          </div>
        </div>
      </div>

    </div>
  )
}