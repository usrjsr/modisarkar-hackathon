/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Settings, Save, AlertCircle, RefreshCw } from "lucide-react"
import { RANKS } from "@/lib/constants/ranks"

const RANK_GROUPS = [
  { label: 'Command Level (not field-deployed)', ranks: ['DGP', 'ADGP', 'IG'] as const },
  { label: 'Strategic Oversight', ranks: ['DIG', 'SP'] as const },
  { label: 'Zone Managers', ranks: ['DSP', 'ASP', 'Inspector'] as const },
  { label: 'Sector Duty', ranks: ['SI', 'ASI', 'HeadConstable', 'Constable'] as const },
]

const DEFAULT_COMPOSITION: Record<string, number> = {
  DGP: 1, ADGP: 2, IG: 5, DIG: 10, SP: 15, DSP: 20, ASP: 25,
  Inspector: 50, SI: 80, ASI: 100, HeadConstable: 200, Constable: 492,
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
      const res = await fetch('/api/settings')
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
    } catch (err) {
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
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        })
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        setLastUpdated(new Date().toLocaleString())
        setConfigVersion(prev => prev + 1)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error || 'Failed to save config')
      }
    } catch (err) {
      setError('Error saving configuration')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading configuration...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">System Settings & Configuration</h1>
        <p className="text-sm text-gray-600 mt-1">Operation Sentinel - Admin Control Panel</p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-900 flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">Saved</Badge>
          <span className="text-sm">Configuration saved to database successfully</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-semibold text-red-900 flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4" />
            Configuration Errors
          </p>
          <ul className="text-sm text-red-800 space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx} className="ml-6 list-disc">{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-gray-600 uppercase">Total Available Force</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">{config.totalForce}</p>
            <p className="text-sm text-gray-600 mt-2">Personnel</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-gray-600 uppercase">Active Deployment Force</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{activeForce}</p>
            <p className="text-sm text-gray-600 mt-2">Available for deployment</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-gray-600 uppercase">Standby Reserve Pool</p>
            <p className="text-3xl font-bold text-amber-900 mt-1">{standbyCount}</p>
            <p className="text-sm text-gray-600 mt-2">Personnel ({config.standbyPercentage}%)</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-teal-900">
        <CardHeader className="bg-teal-50 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-teal-900">Force Composition (per rank)</CardTitle>
            <Badge className="bg-teal-100 text-teal-800">
              Sum: {Object.values(forceComposition).reduce((a, b) => a + b, 0)} / {config.totalForce}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {RANK_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{group.label}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {group.ranks.map(rank => (
                  <div key={rank}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{rank}</label>
                    <Input
                      type="number"
                      min="0"
                      value={forceComposition[rank] ?? 0}
                      onChange={(e) => setForceComposition(prev => ({ ...prev, [rank]: parseInt(e.target.value) || 0 }))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.values(forceComposition).reduce((a, b) => a + b, 0) !== config.totalForce && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
              <p className="text-xs text-amber-800 font-semibold">
                ⚠ Composition sum ({Object.values(forceComposition).reduce((a, b) => a + b, 0)}) does not match Total Force ({config.totalForce})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-900">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Force Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Total Personnel (F)</label>
                <Input
                  type="number"
                  value={config.totalForce}
                  onChange={(e) => handleConfigChange("totalForce", parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Standby % (Reserve)</label>
                <Input
                  type="number"
                  min="10"
                  max="30"
                  value={config.standbyPercentage}
                  onChange={(e) => handleConfigChange("standbyPercentage", parseInt(e.target.value) || 15)}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-900">
          <CardHeader className="bg-purple-50 border-b">
            <CardTitle className="text-purple-900">Scheduling Algorithm</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-purple-900 font-semibold mb-2">Formula: Zscore = (ws · S + wd · D) / (ws + wd)</p>
              <p className="text-xs text-purple-800">Determines proportional personnel distribution across zones</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Weight: Size (ws)</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.weightSize}
                  onChange={(e) => handleConfigChange("weightSize", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Weight: Density (wd)</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.weightDensity}
                  onChange={(e) => handleConfigChange("weightDensity", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Roster Duration</label>
                <Input type="number" value={config.rosterDays} readOnly className="w-full bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Shifts Per Day</label>
                <Input type="number" value={config.shiftsPerDay} readOnly className="w-full bg-gray-50" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-indigo-900">
        <CardHeader className="bg-indigo-50 border-b">
          <CardTitle className="text-indigo-900">Rest & Fatigue Parameters</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Min Rest Hours (Sector Duty)</label>
              <Input
                type="number"
                value={config.minRestHours}
                onChange={(e) => handleConfigChange("minRestHours", parseInt(e.target.value) || 8)}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-1">For Constables, ASI, SI, Head Constables</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Min Rest Hours (Zone Managers)</label>
              <Input
                type="number"
                value={config.minRestHoursInspector}
                onChange={(e) => handleConfigChange("minRestHoursInspector", parseInt(e.target.value) || 12)}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-1">For Inspectors, ASP, DSP</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold mb-1">Fatigue Multipliers by Shift</p>
            <ul className="text-xs space-y-0.5">
              <li>• Morning: 1.0x (standard fatigue)</li>
              <li>• Evening: 1.0x (standard fatigue)</li>
              <li>• Night: 1.5x (heavy fatigue accumulation)</li>
              <li>• Emergency Deployment: 2.0x</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="border-t pt-6">
        <Button
          className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
          onClick={handleSave}
          disabled={validationErrors.length > 0 || saving}
        >
          {saving ? (
            <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />Save Configuration</>
          )}
        </Button>
      </div>

      <Card className="bg-blue-50 border-l-4 border-l-blue-600">
        <CardHeader className="border-b border-blue-200">
          <CardTitle className="text-blue-900 text-base">System Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-700">Config Version:</span>
            <span className="font-semibold">{configVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Last Updated:</span>
            <span className="font-semibold">{lastUpdated || 'Never'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Environment:</span>
            <Badge className="bg-green-100 text-green-800">Production</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
