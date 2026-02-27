import bcrypt from "bcryptjs"
import connectDB from "@/lib/db/mongodb"
import Personnel from "@/lib/db/models/Personnel"
import SystemConfigModel from "@/lib/db/models/SystemConfig"
import ZoneModel from "@/lib/db/models/Zone"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    await connectDB()

    console.log("DB connected")

    const results: Record<string, unknown> = {}

    const exists = await Personnel.findOne({ email: "admin@sentinel.com" })

    if (exists) {
      results.admin = { skipped: true, message: "Admin already exists" }
    } else {
      const hash = await bcrypt.hash("admin123", 10)
      const admin = await Personnel.create({
        name: "Control Room Admin",
        badgeNumber: "ADM001",
        email: "admin@sentinel.com",
        password: hash,
        role: "ADMIN",
        rank: "SP",
        commandLevel: "Strategic",
        status: "Active",
        fatigueScore: 0,
        fatigueHistory: [],
        leavePeriods: [],
        consecutiveNightShifts: 0,
        totalDeployments: 0,
        version: 0,
      })
      console.log(admin)
      results.admin = { created: true }
    }

    const existingConfig = await SystemConfigModel.findOne()
    if (existingConfig) {
      results.systemConfig = { skipped: true, message: "SystemConfig already exists" }
    } else {
      await SystemConfigModel.create({
        totalForce: 500,
        forceComposition: {
          DGP: 1,
          ADGP: 2,
          IG: 3,
          DIG: 5,
          SP: 8,
          DSP: 15,
          ASP: 20,
          Inspector: 30,
          SI: 60,
          ASI: 80,
          HeadConstable: 120,
          Constable: 156,
        },
        weights: { w_s: 0.3, w_d: 0.7 },
        standbyPercentage: 0.15,
        shiftConfig: {
          morning: { start: "06:00", end: "14:00" },
          evening: { start: "14:00", end: "22:00" },
          night: { start: "22:00", end: "06:00" },
        },
        restHours: {
          lowerRanks: 8,
          inspectors: 12,
        },
        fatigueWeights: {
          nightShift: 1.5,
          emergencyDeployment: 2.0,
          standardShift: 1.0,
        },
        version: 0,
      })
      results.systemConfig = { created: true, totalForce: 500 }
    }

    const existingZones = await ZoneModel.countDocuments()
    if (existingZones > 0) {
      results.zones = { skipped: true, message: `${existingZones} zones already exist` }
    } else {
      const seedZones = [
        { name: "Central Hub", code: "Z01", sizeScore: 8, densityScore: 9, centroid: { type: "Point", coordinates: [85.3096, 23.3441] } },
        { name: "North Gate", code: "Z02", sizeScore: 5, densityScore: 6, centroid: { type: "Point", coordinates: [85.3150, 23.3520] } },
        { name: "East Sector", code: "Z03", sizeScore: 6, densityScore: 7, centroid: { type: "Point", coordinates: [85.3200, 23.3480] } },
        { name: "South Perimeter", code: "Z04", sizeScore: 4, densityScore: 3, centroid: { type: "Point", coordinates: [85.3080, 23.3360] } },
        { name: "West Flank", code: "Z05", sizeScore: 3, densityScore: 2, centroid: { type: "Point", coordinates: [85.3020, 23.3430] } },
      ]

      await ZoneModel.insertMany(
        seedZones.map(z => ({
          ...z,
          baseDensity: z.densityScore,
          zScore: 0,
          currentDeployment: 0,
          safeThreshold: 0,
          adjacency: [],
          distanceMatrix: [],
          heatmapColor: "green",
          isActive: true,
          version: 0,
          geometry: {
            type: "Polygon",
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
          },
        }))
      )
      results.zones = { created: true, count: seedZones.length }
    }

    return NextResponse.json({ success: true, data: results })

  } catch (err: unknown) {
    const error = err as Error;
    console.error("SEED ERROR:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}