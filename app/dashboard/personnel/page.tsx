/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Search, Plus, Edit, Trash2, AlertCircle, X } from "lucide-react"
import { RANKS } from "@/lib/constants/ranks"

interface Officer {
  _id: string
  name: string
  badgeNumber: string
  rank: string
  status: string
  fatigueScore: number
  currentZone: { name: string; code: string } | null
  homeZone: { name: string; code: string } | null
  commandLevel: string
}

const RANK_LIST = [...RANKS]

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Officer[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRank, setSelectedRank] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newOfficer, setNewOfficer] = useState({ name: '', badgeNumber: '', rank: 'Constable' })
  const [submitting, setSubmitting] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const PAGE_SIZE = 50

  useEffect(() => {
    fetchPersonnel()
  }, [])

  const fetchPersonnel = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/personnel?limit=5000')
      const result = await res.json()
      if (result.success && result.data) {
        setPersonnel(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch personnel:', err)
    } finally {
      setLoading(false)
    }
  }

  const addOfficer = async () => {
    if (!newOfficer.name || !newOfficer.badgeNumber || !newOfficer.rank) {
      alert('Please fill in all fields')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOfficer)
      })
      const result = await res.json()
      if (result.success) {
        setNewOfficer({ name: '', badgeNumber: '', rank: 'Constable' })
        setShowAddForm(false)
        await fetchPersonnel()
      } else {
        alert(result.error || 'Failed to add officer')
      }
    } catch (err) {
      alert('Error adding officer')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteOfficer = async (officerId: string) => {
    if (!confirm('Are you sure you want to remove this officer?')) return
    try {
      const res = await fetch(`/api/personnel/${officerId}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        await fetchPersonnel()
      } else {
        alert(result.error || 'Failed to remove officer')
      }
    } catch (err) {
      alert('Error removing officer')
    }
  }

  const filteredPersonnel = personnel.filter(p => {
    const matchesSearch = (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (p.badgeNumber || '').includes(searchQuery)
    const matchesRank = !selectedRank || p.rank === selectedRank
    return matchesSearch && matchesRank
  })

  const getFilteredByStatus = (status: string) => filteredPersonnel.filter(p => p.status === status)

  const stats = {
    total: personnel.length,
    deployed: personnel.filter(p => p.status === "Deployed").length,
    standby: personnel.filter(p => p.status === "Standby").length,
    onLeave: personnel.filter(p => p.status === "OnLeave").length,
    highFatigue: personnel.filter(p => (p.fatigueScore ?? 0) > 20).length
  }

  const getFatigueColor = (score: number) => {
    if (score >= 30) return "text-red-600 bg-red-50"
    if (score >= 20) return "text-orange-600 bg-orange-50"
    if (score >= 10) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      Deployed: "bg-green-100 text-green-800",
      Active: "bg-blue-100 text-blue-800",
      Standby: "bg-indigo-100 text-indigo-800",
      OnLeave: "bg-gray-100 text-gray-800",
      Unavailable: "bg-red-100 text-red-800"
    }
    return colors[status] || colors.Active
  }

  const renderTable = (list: Officer[]) => {
    const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1
    const currentPage = Math.min(tablePage, totalPages)
    const paginatedList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    return (
      <div>
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
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No personnel found</td>
                </tr>
              ) : paginatedList.map(p => (
                <tr key={p._id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-gray-700">{p.badgeNumber}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.rank}</td>
                  <td className="px-4 py-3">
                    <Badge className={getStatusBadgeColor(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getFatigueColor(p.fatigueScore ?? 0)}`}>
                      {(p.fatigueScore ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.currentZone ? (
                      <Badge variant="outline">{p.currentZone.code}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteOfficer(p._id)}
                      disabled={p.status === 'Deployed'}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-gray-500">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, list.length)} of {list.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setTablePage(currentPage - 1)}>Previous</Button>
            <span className="text-sm py-1 px-3 bg-gray-100 rounded">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setTablePage(currentPage + 1)}>Next</Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading personnel...</p>
      </div>
    )
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

      {stats.highFatigue > 0 && (
        <Card className="bg-amber-50 border-l-4 border-l-amber-600">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">{stats.highFatigue} Officers with High Fatigue</p>
              <p className="text-sm text-amber-800">These personnel should be prioritised for rest and assigned to low-density zones.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddForm && (
        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="bg-green-50 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-green-900">Add New Officer</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Name</label>
                <Input
                  placeholder="Officer name"
                  value={newOfficer.name}
                  onChange={e => setNewOfficer({ ...newOfficer, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Badge Number</label>
                <Input
                  placeholder="Badge number"
                  value={newOfficer.badgeNumber}
                  onChange={e => setNewOfficer({ ...newOfficer, badgeNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Rank</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  value={newOfficer.rank}
                  onChange={e => setNewOfficer({ ...newOfficer, rank: e.target.value })}
                >
                  {RANK_LIST.map(rank => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              className="mt-4 bg-green-600 hover:bg-green-700"
              onClick={addOfficer}
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Officer'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-l-4 border-l-blue-900">
        <CardHeader className="bg-blue-50 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-blue-900">Personnel Directory</CardTitle>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddForm(true)}>
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
              <TabsTrigger value="deployed">Deployed ({getFilteredByStatus("Deployed").length})</TabsTrigger>
              <TabsTrigger value="standby">Standby ({getFilteredByStatus("Standby").length})</TabsTrigger>
              <TabsTrigger value="leave">On Leave ({getFilteredByStatus("OnLeave").length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {renderTable(filteredPersonnel)}
            </TabsContent>

            <TabsContent value="deployed" className="mt-6">
              {renderTable(getFilteredByStatus("Deployed"))}
            </TabsContent>

            <TabsContent value="standby" className="mt-6">
              {renderTable(getFilteredByStatus("Standby"))}
            </TabsContent>

            <TabsContent value="leave" className="mt-6">
              {renderTable(getFilteredByStatus("OnLeave"))}
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
