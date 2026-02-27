"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Settings, Save, AlertCircle } from "lucide-react"

export default function SettingsPage() {
  const [config, setConfig] = useState({
    totalForce: 1270,
    standbyPercentage: 15,
    weightSize: 0.4,
    weightDensity: 0.6,
    minRestHours: 8,
    minRestHoursInspector: 12,
    rosterDays: 30,
    shiftsPerDay: 3,
    eventName: "Major Public Event - Election Season",
    eventLocation: "Metropolitan Area",
    eventStartDate: "2026-02-01",
    eventEndDate: "2026-03-02"
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleConfigChange = (field: string, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const verifyConfig = () => {
    const errors = []
    if (config.weightSize + config.weightDensity !== 1) {
      errors.push("Sum of weights must equal 1.0")
    }
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

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">System Settings & Configuration</h1>
        <p className="text-sm text-gray-600 mt-1">Operation Sentinel - Admin Control Panel</p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-900 flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">Saved</Badge>
          <span className="text-sm">Configuration updated successfully</span>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-semibold text-red-900 flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4" />
            Configuration Errors
          </p>
          <ul className="text-sm text-red-800 space-y-1">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="ml-6 list-disc">{error}</li>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-900">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Event Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Event Name</label>
              <Input
                value={config.eventName}
                onChange={(e) => handleConfigChange("eventName", e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Event Location</label>
              <Input
                value={config.eventLocation}
                onChange={(e) => handleConfigChange("eventLocation", e.target.value)}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                <Input
                  type="date"
                  value={config.eventStartDate}
                  onChange={(e) => handleConfigChange("eventStartDate", e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                <Input
                  type="date"
                  value={config.eventEndDate}
                  onChange={(e) => handleConfigChange("eventEndDate", e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Total Personnel</label>
                <Input
                  type="number"
                  value={config.totalForce}
                  onChange={(e) => handleConfigChange("totalForce", parseInt(e.target.value))}
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
                  onChange={(e) => handleConfigChange("standbyPercentage", parseInt(e.target.value))}
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Weight: Size (S)</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.weightSize}
                  onChange={(e) => handleConfigChange("weightSize", parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Weight: Density (D)</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.weightDensity}
                  onChange={(e) => handleConfigChange("weightDensity", parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-600 font-semibold">Weight Sum</p>
              <p className="text-lg font-bold text-gray-900">
                {(config.weightSize + config.weightDensity).toFixed(2)}
                {(config.weightSize + config.weightDensity).toFixed(2) !== "1.00" && (
                  <span className="text-red-600 ml-1">(must be 1.0)</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Roster Duration (Days)</label>
              <Input
                type="number"
                value={config.rosterDays}
                onChange={(e) => handleConfigChange("rosterDays", parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Shifts Per Day</label>
              <Input
                type="number"
                value={config.shiftsPerDay}
                readOnly
                className="w-full bg-gray-50"
              />
              <p className="text-xs text-gray-600 mt-1">Morning (06:00-14:00), Evening (14:00-22:00), Night (22:00-06:00)</p>
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
                onChange={(e) => handleConfigChange("minRestHours", parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-1">For Constables, ASI, SI, Head Constables</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Min Rest Hours (Zone Managers)</label>
              <Input
                type="number"
                value={config.minRestHoursInspector}
                onChange={(e) => handleConfigChange("minRestHoursInspector", parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-1">For Inspectors, ASP, DSP</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold mb-1">Fatigue Multipliers by Shift</p>
            <ul className="text-xs space-y-0.5">
              <li>• Morning: 1.0x (standard fatigue)</li>
              <li>• Evening: 1.1x (slight increase)</li>
              <li>• Night: 1.5x (heavy fatigue accumulation)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="border-t pt-6">
        <Button
          className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
          onClick={handleSave}
          disabled={validationErrors.length > 0}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Configuration
        </Button>
      </div>

      <Card className="bg-blue-50 border-l-4 border-l-blue-600">
        <CardHeader className="border-b border-blue-200">
          <CardTitle className="text-blue-900 text-base">System Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-700">Database Version:</span>
            <span className="font-semibold">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Last Updated:</span>
            <span className="font-semibold">{new Date().toLocaleString()}</span>
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
