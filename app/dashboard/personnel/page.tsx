"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Trash2, AlertCircle, X, Users, Shield, Clock, Activity, ChevronLeft, ChevronRight, Upload, FileSpreadsheet, CheckCircle2, CalendarOff, CalendarPlus, Eye } from "lucide-react"
import { RANKS } from "@/lib/constants/ranks"

interface Officer {
  _id: string
  name: string
  badgeNumber: string
  rank: string
  status: string
  fatigueScore: number
  currentZones: Array<{ _id: string; name: string; code: string }>
  homeZone: { name: string; code: string } | null
  commandLevel: string
}

const RANK_LIST = [...RANKS]
const PAGE_SIZE = 50

const STATUS_TABS = ["All", "Deployed", "Standby", "OnLeave"] as const
type StatusTab = typeof STATUS_TABS[number]

function getFatigueLevel(score: number): { label: string; accent: string } {
  if (score >= 30) return { label: "EXHAUSTED", accent: "danger" }
  if (score >= 20) return { label: "TIRED", accent: "warning" }
  if (score >= 10) return { label: "MODERATE", accent: "accent" }
  return { label: "FRESH", accent: "success" }
}

function getStatusAccent(status: string): string {
  const map: Record<string, string> = {
    Deployed: "success",
    Active: "primary",
    Standby: "accent",
    OnLeave: "muted",
    Unavailable: "danger",
  }
  return map[status] ?? "primary"
}

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Officer[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRank, setSelectedRank] = useState<string>("")
  const [activeTab, setActiveTab] = useState<StatusTab>("All")
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [newOfficer, setNewOfficer] = useState({ name: "", badgeNumber: "", rank: "Constable" })
  const [submitting, setSubmitting] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{
    totalRows: number
    inserted: number
    skipped: number
    errors: Array<{ row: number; reason: string }>
  } | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [leaveOfficer, setLeaveOfficer] = useState<Officer | null>(null)
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  useEffect(() => { fetchPersonnel() }, [])

  const fetchPersonnel = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/personnel?limit=5000")
      const result = await res.json()
      if (result.success && result.data) setPersonnel(result.data)
    } catch { console.error("Failed to fetch personnel") }
    finally { setLoading(false) }
  }

  const addOfficer = async () => {
    if (!newOfficer.name || !newOfficer.badgeNumber || !newOfficer.rank) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOfficer),
      })
      const result = await res.json()
      if (result.success) {
        setNewOfficer({ name: "", badgeNumber: "", rank: "Constable" })
        setShowAddForm(false)
        await fetchPersonnel()
      } else { alert(result.error || "Failed to add officer") }
    } catch { alert("Error adding officer") }
    finally { setSubmitting(false) }
  }

  const handleBulkUpload = async () => {
    if (!bulkFile) return
    setBulkUploading(true)
    setBulkResult(null)
    setBulkError(null)
    try {
      const formData = new FormData()
      formData.append('file', bulkFile)
      const res = await fetch('/api/personnel/bulk', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (result.success) {
        setBulkResult(result.data)
        setBulkFile(null)
        await fetchPersonnel()
      } else {
        setBulkError(result.error || 'Failed to process file')
        if (result.errors) setBulkResult({ totalRows: 0, inserted: 0, skipped: 0, errors: result.errors })
      }
    } catch {
      setBulkError('Error uploading file')
    } finally {
      setBulkUploading(false)
    }
  }

  const deleteOfficer = async (id: string) => {
    if (!confirm("Remove this officer from the system?")) return
    try {
      const res = await fetch(`/api/personnel/${id}`, { method: "DELETE" })
      const result = await res.json()
      if (result.success) await fetchPersonnel()
      else alert(result.error || "Failed to remove officer")
    } catch { alert("Error removing officer") }
  }

  const applyLeave = async () => {
    if (!leaveOfficer || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) return
    setLeaveSubmitting(true)
    setLeaveError(null)
    try {
      const res = await fetch(`/api/personnel/${leaveOfficer._id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveForm),
      })
      const result = await res.json()
      if (result.success) {
        setLeaveOfficer(null)
        setLeaveForm({ startDate: '', endDate: '', reason: '' })
        await fetchPersonnel()
      } else {
        setLeaveError(result.error || 'Failed to apply leave')
      }
    } catch {
      setLeaveError('Error applying leave')
    } finally {
      setLeaveSubmitting(false)
    }
  }

  const cancelLeave = async (officerId: string) => {
    if (!confirm('Cancel this officer\'s active leave?')) return
    try {
      // Get officer's leave periods to find the active one
      const officerRes = await fetch(`/api/personnel/${officerId}`)
      const officerData = await officerRes.json()
      if (!officerData.success || !officerData.data) return

      const activeLeavePeriods = officerData.data.leavePeriods || []
      const now = new Date()
      const activeLeave = activeLeavePeriods.find((lp: { startDate: string; endDate: string; _id: string }) => {
        const start = new Date(lp.startDate)
        const end = new Date(lp.endDate)
        return start <= now && end >= now || start > now
      })

      if (!activeLeave) {
        alert('No active or upcoming leave found')
        return
      }

      const res = await fetch(`/api/personnel/${officerId}/leave`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId: activeLeave._id }),
      })
      const result = await res.json()
      if (result.success) {
        await fetchPersonnel()
      } else {
        alert(result.error || 'Failed to cancel leave')
      }
    } catch {
      alert('Error cancelling leave')
    }
  }

  const stats = {
    total: personnel.length,
    deployed: personnel.filter(p => p.status === "Deployed").length,
    standby: personnel.filter(p => p.status === "Standby").length,
    onLeave: personnel.filter(p => p.status === "OnLeave").length,
    highFatigue: personnel.filter(p => (p.fatigueScore ?? 0) > 20).length,
  }

  const filtered = personnel.filter(p => {
    const matchSearch =
      (p.name?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (p.badgeNumber ?? "").includes(searchQuery)
    const matchRank = !selectedRank || p.rank === selectedRank
    const matchTab =
      activeTab === "All" ||
      p.status === activeTab
    return matchSearch && matchRank && matchTab
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(tablePage, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const tabCount = (tab: StatusTab) =>
    tab === "All"
      ? personnel.filter(p => {
        const matchSearch = (p.name?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) || (p.badgeNumber ?? "").includes(searchQuery)
        const matchRank = !selectedRank || p.rank === selectedRank
        return matchSearch && matchRank
      }).length
      : personnel.filter(p => {
        const matchSearch = (p.name?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) || (p.badgeNumber ?? "").includes(searchQuery)
        const matchRank = !selectedRank || p.rank === selectedRank
        return matchSearch && matchRank && p.status === tab
      }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <span className="status-dot-pulse bg-primary" />
          <span className="mono-data">LOADING PERSONNEL...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-primary">PERSONNEL</span>
            <span className="tag-success">LIVE</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Personnel Management
          </h1>
          <p className="mono-data mt-1">Police Force Deployment · Status & Fatigue Tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowBulkUpload(v => !v); setShowAddForm(false); setBulkResult(null); setBulkError(null) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-opacity hover:opacity-90 ${showBulkUpload
              ? 'bg-surface-raised border border-border text-foreground'
              : 'bg-accent text-accent-foreground'
              }`}
          >
            {showBulkUpload ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {showBulkUpload ? 'Cancel' : 'Bulk Upload'}
          </button>
          <button
            onClick={() => { setShowAddForm(v => !v); setShowBulkUpload(false) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity font-semibold text-sm"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Cancel' : 'Add Officer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Personnel", value: stats.total, icon: Users, accent: "primary" },
          { label: "Deployed", value: stats.deployed, icon: Shield, accent: "success" },
          { label: "Standby", value: stats.standby, icon: Activity, accent: "accent" },
          { label: "On Leave", value: stats.onLeave, icon: Clock, accent: "muted" },
          { label: "High Fatigue", value: stats.highFatigue, icon: AlertCircle, accent: "danger" },
        ].map(s => (
          <div key={s.label} className={`sentinel-card border-t-2 p-4 ${s.accent === "primary" ? "border-t-primary" :
            s.accent === "success" ? "border-t-success" :
              s.accent === "accent" ? "border-t-accent" :
                s.accent === "danger" ? "border-t-danger" :
                  "border-t-border-strong"
            }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="mono-data text-[10px]">{s.label}</span>
              <s.icon className={`w-3.5 h-3.5 ${s.accent === "primary" ? "text-primary" :
                s.accent === "success" ? "text-success" :
                  s.accent === "accent" ? "text-accent" :
                    s.accent === "danger" ? "text-danger" :
                      "text-muted-foreground"
                }`} />
            </div>
            <p className={`font-display text-2xl font-bold ${s.accent === "primary" ? "text-primary" :
              s.accent === "success" ? "text-success" :
                s.accent === "accent" ? "text-accent" :
                  s.accent === "danger" ? "text-danger" :
                    "text-foreground"
              }`}>{s.value}</p>
          </div>
        ))}
      </div>

      {stats.highFatigue > 0 && (
        <div className="sentinel-card border-l-4 border-l-warning p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warning text-sm">{stats.highFatigue} Officers with High Fatigue Score</p>
              <p className="mono-data text-[11px] mt-0.5">These personnel should be prioritised for rest and assigned to low-density zones.</p>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="sentinel-card overflow-hidden animate-slide-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-success" />
              <span className="font-display font-semibold text-sm text-foreground">Enrol New Officer</span>
            </div>
            <button onClick={() => setShowAddForm(false)} className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[
                { label: "Full Name", placeholder: "Officer full name", key: "name", type: "text" },
                { label: "Badge Number", placeholder: "e.g. KA-2041", key: "badgeNumber", type: "text" },
              ].map(field => (
                <div key={field.key}>
                  <label className="mono-data text-[10px] block mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={newOfficer[field.key as keyof typeof newOfficer]}
                    onChange={e => setNewOfficer({ ...newOfficer, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="mono-data text-[10px] block mb-1.5">Rank</label>
                <select
                  value={newOfficer.rank}
                  onChange={e => setNewOfficer({ ...newOfficer, rank: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                >
                  {RANK_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={addOfficer}
              disabled={submitting || !newOfficer.name || !newOfficer.badgeNumber}
              className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? "Enrolling..." : "Enrol Officer"}
            </button>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <div className="sentinel-card overflow-hidden animate-slide-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-accent" />
              <span className="font-display font-semibold text-sm text-foreground">Bulk Personnel Upload</span>
            </div>
            <button onClick={() => { setShowBulkUpload(false); setBulkResult(null); setBulkError(null) }} className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-surface-raised border border-border rounded-md p-4">
              <p className="text-sm text-foreground mb-2 font-semibold">Required CSV columns:</p>
              <div className="flex flex-wrap gap-2">
                {['Badge Number', 'Name', 'Rank'].map(col => (
                  <span key={col} className="font-mono text-[10px] font-bold px-2 py-1 rounded-sm border bg-primary-muted border-primary text-primary">
                    {col}
                  </span>
                ))}
                {['Status (optional)', 'Email (optional)'].map(col => (
                  <span key={col} className="font-mono text-[10px] px-2 py-1 rounded-sm border bg-surface-overlay border-border text-muted-foreground">
                    {col}
                  </span>
                ))}
              </div>
              <p className="mono-data text-[10px] mt-2">Accepts .csv files. Column headers are matched flexibly.</p>
            </div>

            <label
              className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-150 ${bulkFile ? 'border-success bg-success-muted/30' : 'border-border hover:border-primary hover:bg-primary-muted/10'
                }`}
            >
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setBulkFile(f); setBulkResult(null); setBulkError(null) }
                }}
              />
              {bulkFile ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-success mb-2" />
                  <p className="font-semibold text-sm text-foreground">{bulkFile.name}</p>
                  <p className="mono-data text-[10px] mt-1">{(bulkFile.size / 1024).toFixed(1)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="font-semibold text-sm text-muted-foreground">Click to select CSV file</p>
                  <p className="mono-data text-[10px] mt-1">.csv</p>
                </>
              )}
            </label>

            <button
              onClick={handleBulkUpload}
              disabled={!bulkFile || bulkUploading}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className={`w-3.5 h-3.5 ${bulkUploading ? 'animate-bounce' : ''}`} />
              {bulkUploading ? 'Uploading & Processing...' : 'Upload & Import'}
            </button>

            {bulkError && (
              <div className="sentinel-card border-l-4 border-l-danger p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-sm text-danger">{bulkError}</p>
                </div>
              </div>
            )}

            {bulkResult && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <div className="sentinel-card border-t-2 border-t-primary p-3">
                    <p className="mono-data text-[10px] mb-1">Total Rows</p>
                    <p className="font-display text-xl font-bold text-primary">{bulkResult.totalRows}</p>
                  </div>
                  <div className="sentinel-card border-t-2 border-t-success p-3">
                    <p className="mono-data text-[10px] mb-1">Inserted</p>
                    <p className="font-display text-xl font-bold text-success">{bulkResult.inserted}</p>
                  </div>
                  <div className="sentinel-card border-t-2 border-t-warning p-3">
                    <p className="mono-data text-[10px] mb-1">Skipped</p>
                    <p className="font-display text-xl font-bold text-warning">{bulkResult.skipped}</p>
                  </div>
                </div>

                {bulkResult.errors.length > 0 && (
                  <div className="sentinel-card overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-surface-raised">
                      <span className="mono-data text-[10px] text-warning">{bulkResult.errors.length} ISSUES</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-border">
                      {bulkResult.errors.map((err, idx) => (
                        <div key={idx} className="px-4 py-2 flex items-start gap-2 text-xs">
                          {err.row > 0 && <span className="font-mono text-muted-foreground shrink-0">Row {err.row}:</span>}
                          <span className="text-warning">{err.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="sentinel-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-display font-semibold text-sm text-foreground">Personnel Directory</span>
          <span className="ml-auto mono-data text-[10px]">{filtered.length} RECORDS</span>
        </div>

        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or badge number..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setTablePage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
          <select
            value={selectedRank}
            onChange={e => { setSelectedRank(e.target.value); setTablePage(1) }}
            className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          >
            <option value="">All Ranks</option>
            {RANK_LIST.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex border-b border-border">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setTablePage(1) }}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150
                ${activeTab === tab
                  ? "border-b-primary text-primary bg-primary-muted/30"
                  : "border-b-transparent text-muted-foreground hover:text-foreground hover:bg-surface-raised"
                }
              `}
            >
              {tab === "OnLeave" ? "On Leave" : tab}
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-surface-overlay text-muted-foreground"
                }`}>
                {tabCount(tab)}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                {["Badge", "Name", "Rank", "Status", "Fatigue", "Zones", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left">
                    <span className="mono-data text-[10px]">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <span className="mono-data">NO PERSONNEL FOUND</span>
                  </td>
                </tr>
              ) : paginated.map(p => {
                const fatigue = getFatigueLevel(p.fatigueScore ?? 0)
                const statusAccent = getStatusAccent(p.status)
                return (
                  <tr key={p._id} className="hover:bg-surface-raised transition-colors duration-100 group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{p.badgeNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground text-sm">{p.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{p.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`
                        font-mono text-[10px] font-bold px-2 py-1 rounded-sm border
                        ${statusAccent === "success" ? "bg-success-muted border-success text-success" : ""}
                        ${statusAccent === "primary" ? "bg-primary-muted border-primary text-primary" : ""}
                        ${statusAccent === "accent" ? "bg-accent/10    border-accent  text-accent" : ""}
                        ${statusAccent === "danger" ? "bg-danger-muted  border-danger  text-danger" : ""}
                        ${statusAccent === "muted" ? "bg-muted         border-border  text-muted-foreground" : ""}
                      `}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`
                          font-mono text-[10px] font-bold px-2 py-1 rounded-sm border
                          ${fatigue.accent === "success" ? "bg-success-muted border-success text-success" : ""}
                          ${fatigue.accent === "accent" ? "bg-accent/10    border-accent  text-accent" : ""}
                          ${fatigue.accent === "warning" ? "bg-warning-muted border-warning text-warning" : ""}
                          ${fatigue.accent === "danger" ? "bg-danger-muted  border-danger  text-danger" : ""}
                        `}>
                          {fatigue.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {(p.fatigueScore ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.currentZones && p.currentZones.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.currentZones.map((z) => (
                            <span key={z._id} className="font-mono text-xs px-2 py-1 bg-surface-overlay border border-border rounded-sm text-foreground">
                              {z.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="mono-data">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                        <button
                          onClick={() => window.location.href = `/dashboard/personnel/${p._id}`}
                          title="View Officer Profile"
                          className="flex items-center justify-center w-7 h-7 rounded-sm border border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary-muted transition-all duration-150"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {p.status === 'OnLeave' ? (
                          <button
                            onClick={() => cancelLeave(p._id)}
                            title="Cancel Leave"
                            className="flex items-center justify-center w-7 h-7 rounded-sm border border-border text-muted-foreground hover:border-success hover:text-success hover:bg-success-muted transition-all duration-150"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => { setLeaveOfficer(p); setLeaveError(null); setLeaveForm({ startDate: '', endDate: '', reason: '' }) }}
                            title="Apply Leave"
                            className="flex items-center justify-center w-7 h-7 rounded-sm border border-border text-muted-foreground hover:border-warning hover:text-warning hover:bg-warning-muted transition-all duration-150"
                          >
                            <CalendarOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteOfficer(p._id)}
                          disabled={p.status === "Deployed"}
                          title="Remove Officer"
                          className="flex items-center justify-center w-7 h-7 rounded-sm border border-border text-muted-foreground hover:border-danger hover:text-danger hover:bg-danger-muted transition-all duration-150 disabled:opacity-0 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-raised">
          <span className="mono-data text-[10px]">
            SHOWING {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} OF {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setTablePage(p => p - 1)}
              className="flex items-center justify-center w-7 h-7 border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs px-3 py-1 bg-surface-overlay border border-border rounded-sm text-foreground">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setTablePage(p => p + 1)}
              className="flex items-center justify-center w-7 h-7 border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Leave Application Modal */}
      {leaveOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md mx-4 animate-slide-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-raised rounded-t-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarOff className="w-4 h-4 text-warning" />
                  <span className="font-display font-semibold text-sm text-foreground">Apply Leave</span>
                </div>
                <p className="mono-data text-[10px]">
                  {leaveOfficer.name} · {leaveOfficer.badgeNumber} · {leaveOfficer.rank}
                </p>
              </div>
              <button
                onClick={() => setLeaveOfficer(null)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono-data text-[10px] block mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="mono-data text-[10px] block mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="mono-data text-[10px] block mb-1.5">Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Medical leave, personal, training, etc."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                />
              </div>

              {leaveError && (
                <div className="sentinel-card border-l-4 border-l-danger p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{leaveError}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={applyLeave}
                  disabled={leaveSubmitting || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-warning text-warning-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CalendarOff className="w-3.5 h-3.5" />
                  {leaveSubmitting ? 'Processing...' : 'Confirm Leave'}
                </button>
                <button
                  onClick={() => setLeaveOfficer(null)}
                  className="px-4 py-2.5 border border-border rounded-md text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                >
                  Cancel
                </button>
              </div>

              <p className="mono-data text-[10px] text-center">
                Active deployments during the leave period will be automatically patched.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}