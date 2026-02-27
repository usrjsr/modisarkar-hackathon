"use client";

import React from "react";
import AlertBanner from "@/components/dashboard/AlertBanner";
import ZoneHeatmap from "@/components/dashboard/ZoneHeatmap";
import ZoneCard from "@/components/dashboard/ZoneCard";
import IncidentPanel from "@/components/dashboard/IncidentPanel";
import DeploymentMap from "@/components/dashboard/DeploymentMap";
import RosterTable from "@/components/dashboard/RosterTable";
import ZoneDistribution from "@/components/charts/ZoneDistribution";
//import FatigueTrend from "@/components/charts/FatigueTrend";

// Import Forms for testing
import ZoneConfigForm from "@/components/forms/ZoneConfigForm";
import SystemSettingsForm from "@/components/forms/SystemSettingsForm";
import PersonnelForm from "@/components/forms/PersonnelForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- MOCK DATA ---
const mockZones: any[] = [
  { _id: "1", name: "Red Fort Zone", code: "Z01", densityScore: 9, currentDeployment: 120, safeThreshold: 150, zScore: 0.95, heatmapColor: "red", centroid: { coordinates: [77.2410, 28.6562] } },
  { _id: "2", name: "Connaught Place", code: "Z02", densityScore: 7, currentDeployment: 80, safeThreshold: 80, zScore: 0.5, heatmapColor: "yellow", centroid: { coordinates: [77.2181, 28.6315] } },
  { _id: "3", name: "India Gate", code: "Z03", densityScore: 4, currentDeployment: 60, safeThreshold: 40, zScore: 0.2, heatmapColor: "green", centroid: { coordinates: [77.2295, 28.6129] } },
  { _id: "4", name: "Karol Bagh", code: "Z04", densityScore: 6, currentDeployment: 90, safeThreshold: 100, zScore: 0.6, heatmapColor: "orange", centroid: { coordinates: [77.1906, 28.6520] } },
];

const mockChartData = [
  { name: "Z01", current: 120, required: 150 },
  { name: "Z02", current: 80, required: 80 },
  { name: "Z03", current: 60, required: 40 },
  { name: "Z04", current: 90, required: 100 },
];

const mockFatigueData = [
  { date: "Mon", averageScore: 2.5, criticalCount: 2 },
  { date: "Tue", averageScore: 3.0, criticalCount: 5 },
  { date: "Wed", averageScore: 4.2, criticalCount: 8 },
  { date: "Thu", averageScore: 3.8, criticalCount: 6 },
  { date: "Fri", averageScore: 6.5, criticalCount: 15 },
  { date: "Sat", averageScore: 7.2, criticalCount: 20 },
  { date: "Sun", averageScore: 5.0, criticalCount: 10 },
];

const mockRoster = [
  {
    date: new Date(),
    shifts: {
      morning: [{ status: 'Scheduled', officerName: 'Insp. Sharma' }, { status: 'Empty' }],
      evening: [{ status: 'Fatigue_Warning', officerName: 'HC Singh' }, { status: 'Scheduled', officerName: 'Cst. Kumar' }],
      night: [{ status: 'Leave', officerName: 'SI Verma' }, { status: 'Empty' }]
    }
  }
] as any[]; // Simplified casting for test

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen">

      {/* 1. Header & Alerts */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Operation Sentinel: Control Room</h1>
        <AlertBanner
          type="critical"
          title="Force Deficit Detected"
          message="Zone Z01 (Red Fort) is operating at 80% of required strength. Immediate redistribution recommended."
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Strategic Overview</TabsTrigger>
          <TabsTrigger value="configuration">System Configuration (Forms)</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: DASHBOARD VISUALIZATION --- */}
        <TabsContent value="overview" className="space-y-4">

          {/* Top Row: Map & Incident Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <div className="lg:col-span-5 border rounded-lg bg-white shadow-sm">
              <DeploymentMap zones={mockZones} />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <ZoneHeatmap zones={mockZones} />
              <IncidentPanel zones={mockZones} />
            </div>
          </div>

          {/* Middle Row: Zone Cards */}
          <h2 className="text-xl font-semibold mt-6">Zone Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockZones.map((zone) => (
              <ZoneCard key={zone._id} zone={zone} />
            ))}
          </div>

          {/* Bottom Row: Charts & Roster */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <ZoneDistribution data={mockChartData} />
            {/* <FatigueTrend data={mockFatigueData} /> */}
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Upcoming Roster</h2>
            <RosterTable schedule={mockRoster} />
          </div>
        </TabsContent>

        {/* --- TAB 2: FORMS TESTING --- */}
        <TabsContent value="configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            {/* Test Zone Config Form */}
            <div className="space-y-2">
              <h3 className="font-bold text-lg">1. Edit Zone</h3>
              <ZoneConfigForm defaultValues={{ name: "Red Fort", code: "Z01", sizeScore: 8, densityScore: 9 }} />
            </div>

            {/* Test Personnel Form */}
            <div className="space-y-2">
              <h3 className="font-bold text-lg">2. Add Personnel</h3>
              <PersonnelForm />
            </div>

            {/* Test System Settings Form */}
            <div className="space-y-2">
              <h3 className="font-bold text-lg">3. Algorithm Weights</h3>
              <SystemSettingsForm />
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}