"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react"
import { SHIFTS, ROSTER_DURATION_DAYS } from "@/lib/constants/shifts"

const dummyRosterData = {
  generatedAt: new Date(),
  startDate: new Date(2026, 1, 1),
  zones: ["Z01", "Z02", "Z03", "Z04", "Z05", "Z06"],
  schedule: Array.from({ length: 30 }).map((_, dayIndex) => ({
    date: new Date(2026, 1, dayIndex + 1),
    shifts: {
      morning: { personnel: 150, deployed: 140, status: "Active" },
      evening: { personnel: 165, deployed: 150, status: "Active" },
      night: { personnel: 155, deployed: 145, status: "Scheduled" }
    }
  }))
}

export default function RosterPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(0)
  const [selectedZone, setSelectedZone] = useState("Z01")
  const [viewMode, setViewMode] = useState<"weekly" | "daily">("weekly")

  const weekData = dummyRosterData.schedule.slice(currentWeekStart, currentWeekStart + 7)

  const goToPreviousWeek = () => {
    setCurrentWeekStart(Math.max(0, currentWeekStart - 7))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(Math.min(23, currentWeekStart + 7))
  }

  const totalDeployed = dummyRosterData.schedule.reduce((sum, day) => 
    sum + day.shifts.morning.deployed + day.shifts.evening.deployed + day.shifts.night.deployed, 0
  )

  const totalCapacity = dummyRosterData.schedule.reduce((sum, day) => 
    sum + day.shifts.morning.personnel + day.shifts.evening.personnel + day.shifts.night.personnel, 0
  )

  const utilizationRate = ((totalDeployed / totalCapacity) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">30-Day Roster Schedule</h1>
        <p className="text-sm text-gray-600 mt-1">Comprehensive Personnel Deployment Schedule - {dummyRosterData.startDate.toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500 bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Roster Period</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{ROSTER_DURATION_DAYS} Days</p>
            <p className="text-xs text-gray-600 mt-1">Feb 1 - Mar 2</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-green-50">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Avg Daily Strength</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{(totalDeployed / 90).toFixed(0)}</p>
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
            <p className="text-xs font-semibold text-gray-600 uppercase">Total Deployed</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{totalDeployed}</p>
            <p className="text-xs text-gray-600 mt-1">Person-shifts</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-blue-900">
        <CardHeader className="bg-blue-50 border-b">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <CardTitle className="text-blue-900">Weekly Deployment View</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Week {Math.floor(currentWeekStart / 7) + 1} | {weekData[0]?.date.toLocaleDateString()} - {weekData[6]?.date.toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={goToPreviousWeek} disabled={currentWeekStart === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToNextWeek} disabled={currentWeekStart >= 23}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
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
                      <div className="font-bold">{day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      <div className="text-gray-500 text-xs">{day.date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(SHIFTS).map(([key, shift]) => (
                  <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-semibold text-gray-700 bg-gray-50">
                      <div>{shift.label}</div>
                      <div className="text-xs text-gray-500">{shift.displayTime}</div>
                    </td>
                    {weekData.map((day, idx) => {
                      const shiftKey = shift.code as keyof typeof day.shifts
                      const shiftData = day.shifts[shiftKey]
                      const isDeficit = shiftData.deployed < shiftData.personnel * 0.85

                      return (
                        <td key={idx} className="text-center px-3 py-3">
                          <div className={`p-2 rounded-lg ${isDeficit ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                            <div className="font-bold text-gray-900">{shiftData.deployed}</div>
                            <div className="text-xs text-gray-600">/ {shiftData.personnel}</div>
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

      <Card className="border-l-4 border-l-indigo-900">
        <CardHeader className="bg-indigo-50 border-b">
          <CardTitle className="text-indigo-900">Zone-Wise Daily Strength</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-6 gap-4 mb-4">
            {dummyRosterData.zones.map(zone => (
              <Button
                key={zone}
                variant={selectedZone === zone ? "default" : "outline"}
                className={selectedZone === zone ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                onClick={() => setSelectedZone(zone)}
              >
                {zone}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-center px-3 py-2 font-semibold">Morning</th>
                  <th className="text-center px-3 py-2 font-semibold">Evening</th>
                  <th className="text-center px-3 py-2 font-semibold">Night</th>
                  <th className="text-center px-3 py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {weekData.map((day, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{day.date.toLocaleDateString()}</td>
                    <td className="text-center px-3 py-2">{day.shifts.morning.deployed}</td>
                    <td className="text-center px-3 py-2">{day.shifts.evening.deployed}</td>
                    <td className="text-center px-3 py-2">{day.shifts.night.deployed}</td>
                    <td className="text-center px-3 py-2 font-bold">
                      {day.shifts.morning.deployed + day.shifts.evening.deployed + day.shifts.night.deployed}
                    </td>
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
            <InfoItem label="Weight (Size)" value="0.40" />
            <InfoItem label="Weight (Density)" value="0.60" />
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
