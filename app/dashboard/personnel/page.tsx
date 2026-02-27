"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Search, Plus, Edit, Trash2, AlertCircle } from "lucide-react"
import { RANKS, RANK_LIST } from "@/lib/constants/ranks"

const dummyPersonnel = [
  { id: "P001", name: "Rajesh Kumar", badge: "1001", rank: "Inspector", status: "Deployed", fatigue: 3.5, zone: "Z01" },
  { id: "P002", name: "Priya Singh", badge: "1002", rank: "SI", status: "Deployed", fatigue: 5.2, zone: "Z02" },
  { id: "P003", name: "Amit Patel", badge: "1003", rank: "ASI", status: "OnLeave", fatigue: 1.0, zone: null },
  { id: "P004", name: "Vikram Sharma", badge: "1004", rank: "HeadConstable", status: "Standby", fatigue: 2.1, zone: null },
  { id: "P005", name: "Neha Gupta", badge: "1005", rank: "Constable", status: "Deployed", fatigue: 6.8, zone: "Z03" },
  { id: "P006", name: "Arjun Verma", badge: "1006", rank: "DSP", status: "Deployed", fatigue: 4.2, zone: "Z05" },
  { id: "P007", name: "Anjali Desai", badge: "1007", rank: "ASP", status: "Deployed", fatigue: 3.9, zone: "Z04" },
  { id: "P008", name: "Rohan Iyer", badge: "1008", rank: "Constable", status: "Deployed", fatigue: 7.1, zone: "Z01" },
]

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState(dummyPersonnel)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRank, setSelectedRank] = useState<string | null>(null)

  const filteredPersonnel = personnel.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.badge.includes(searchQuery)
    const matchesRank = !selectedRank || p.rank === selectedRank
    return matchesSearch && matchesRank
  })

  const stats = {
    total: personnel.length,
    deployed: personnel.filter(p => p.status === "Deployed").length,
    standby: personnel.filter(p => p.status === "Standby").length,
    onLeave: personnel.filter(p => p.status === "OnLeave").length,
    highFatigue: personnel.filter(p => p.fatigue > 6).length
  }

  const getFatigueColor = (score: number) => {
    if (score > 7) return "text-red-600 bg-red-50"
    if (score > 5) return "text-orange-600 bg-orange-50"
    if (score > 3) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      Deployed: "bg-green-100 text-green-800",
      Standby: "bg-blue-100 text-blue-800",
      OnLeave: "bg-gray-100 text-gray-800",
      Unavailable: "bg-red-100 text-red-800"
    }
    return colors[status] || colors.Standby
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-blue-900 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">Personnel Management</h1>
        <p className="text-sm text-gray-600 mt-1">Police Force Deployment & Status</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="Total Personnel" value={stats.total} color="blue" />
        <StatBox label="Deployed" value={stats.deployed} color="green" />
        <StatBox label="Standby" value={stats.standby} color="indigo" />
        <StatBox label="On Leave" value={stats.onLeave} color="gray" />
        <StatBox label="High Fatigue" value={stats.highFatigue} color="red" />
      </div>

      <Card className="bg-amber-50 border-l-4 border-l-amber-600">
        <CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">{stats.highFatigue} Officers with High Fatigue</p>
            <p className="text-sm text-amber-800">These personnel should be prioritised for rest and assigned to low-density zones.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-900">
        <CardHeader className="bg-blue-50 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-blue-900">Personnel Directory</CardTitle>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Personnel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-3 flex-col md:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or badge number..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none"
              value={selectedRank || ""}
              onChange={(e) => setSelectedRank(e.target.value || null)}
            >
              <option value="">All Ranks</option>
              {RANK_LIST.map(rank => (
                <option key={rank} value={rank}>{rank}</option>
              ))}
            </select>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({filteredPersonnel.length})</TabsTrigger>
              <TabsTrigger value="deployed">Deployed ({personnel.filter(p => p.status === "Deployed").length})</TabsTrigger>
              <TabsTrigger value="standby">Standby ({personnel.filter(p => p.status === "Standby").length})</TabsTrigger>
              <TabsTrigger value="leave">On Leave ({personnel.filter(p => p.status === "OnLeave").length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Badge</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Rank</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Fatigue</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Zone</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPersonnel.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-mono text-gray-700">{p.badge}</td>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-600">{p.rank}</td>
                        <td className="px-4 py-3">
                          <Badge className={getStatusBadgeColor(p.status)}>{p.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getFatigueColor(p.fatigue)}`}>
                            {p.fatigue.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.zone ? (
                            <Badge variant="outline">{p.zone}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 flex justify-center gap-2">
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="deployed" className="mt-6">
              <div className="text-center py-8 text-gray-500">
                Showing deployed personnel. Filter implemented in search functionality above.
              </div>
            </TabsContent>

            <TabsContent value="standby" className="mt-6">
              <div className="text-center py-8 text-gray-500">
                Showing standby personnel. Filter implemented in search functionality above.
              </div>
            </TabsContent>

            <TabsContent value="leave" className="mt-6">
              <div className="text-center py-8 text-gray-500">
                Showing personnel on leave. Filter implemented in search functionality above.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-l-blue-500 text-blue-900",
    green: "bg-green-50 border-l-green-500 text-green-900",
    indigo: "bg-indigo-50 border-l-indigo-500 text-indigo-900",
    gray: "bg-gray-50 border-l-gray-500 text-gray-900",
    red: "bg-red-50 border-l-red-500 text-red-900"
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
