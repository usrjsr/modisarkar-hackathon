import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import { buildAndApplyAdjacency } from '@/lib/algorithms/graph/adjacencyBuilder'
import { distributeForce } from '@/lib/algorithms/proportionalDistributor'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import type { Zone } from '@/lib/types/zone'

export async function GET() {
  try {
    await connectDB()
    const zones = await ZoneModel.find({ isActive: true }).sort({ zScore: -1 })
    return NextResponse.json({ success: true, data: zones })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch zones' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { name, code, sizeScore, densityScore, geometry, centroid } = body

    if (!name || !code || !sizeScore || !densityScore) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await ZoneModel.findOne({ code })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Zone code already exists' }, { status: 409 })
    }

    const zone = await ZoneModel.create({
      name,
      code,
      sizeScore,
      densityScore,
      baseDensity: densityScore,
      zScore: 0,
      currentDeployment: 0,
      safeThreshold: 0,
      geometry,
      centroid: {
        type: 'Point',
        coordinates: centroid?.coordinates || [77.22, 28.60]
      },
      adjacency: [],
      distanceMatrix: [],
      heatmapColor: 'green',
      isActive: true,
      version: 0,
    })

    const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
    if (config) {
      const allZones = await ZoneModel.find({ isActive: true })
      const zonesPlain = allZones.map(z => z.toObject()) as Zone[]

      const { zones: hydrated } = buildAndApplyAdjacency(zonesPlain, 'macro')

      const distribution = distributeForce({
        totalForce: config.totalForce,
        zones: hydrated,
        weights: config.weights,
      })

      for (const alloc of distribution.allocations) {
        await ZoneModel.findByIdAndUpdate(alloc.zoneId, {
          zScore: alloc.zScore,
          allocation: alloc.allocation,
          safeThreshold: alloc.safeThreshold,
          heatmapColor: alloc.heatmapColor,
        })
      }

      for (const hz of hydrated) {
        await ZoneModel.findByIdAndUpdate(hz._id, {
          adjacency: hz.adjacency,
          distanceMatrix: hz.distanceMatrix,
        })
      }
    }

    const updated = await ZoneModel.findById(zone._id)
    return NextResponse.json({ success: true, data: updated }, { status: 201 })
  } catch (error) {
    console.error('Zone creation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create zone'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}