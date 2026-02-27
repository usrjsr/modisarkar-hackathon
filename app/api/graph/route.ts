
import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import {
  buildAndApplyAdjacency,
  findIsolatedZones,
} from '@/lib/algorithms/graph/adjacencyBuilder'
import {
  findShortestPath,
  getRankedNeighbours,
  getZonesWithinTravelTime,
} from '@/lib/algorithms/graph/pathfinder'
import {
  runFullNetworkAnalysis,
} from '@/lib/algorithms/graph/centrality'
import type { Zone, ZoneSnapshot } from '@/lib/types/zone'
import type { ScaleMode } from '@/lib/algorithms/graph/adjacencyBuilder'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const mode = (searchParams.get('mode') ?? 'macro') as ScaleMode

    const allZones = await ZoneModel.find({ isActive: true })
    if (!allZones.length) {
      return NextResponse.json(
        { success: false, error: 'No active zones found' },
        { status: 404 }
      )
    }

    const zonesPlain = allZones.map(z => z.toObject()) as Zone[]
    const { zones: hydrated, adjacencyMap, isolated } = buildAndApplyAdjacency(zonesPlain, mode)

    const allocations = hydrated.map(z => ({
      zoneId: z._id,
      zScore: z.zScore ?? 0,
      allocation: z.currentDeployment ?? 0,
      safeThreshold: z.safeThreshold ?? 0,
      heatmapColor: z.heatmapColor ?? 'green',
    }))

    const { centrality, networkHealth } = runFullNetworkAnalysis(
      hydrated,
      adjacencyMap,
      allocations,
    )

    return NextResponse.json({
      success: true,
      data: {
        adjacencyMap,
        centrality,
        networkHealth,
        isolated: isolated.map(z => ({ id: z._id, name: z.name })),
        mode,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch graph data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { action, mode = 'macro' } = body

    const allZones = await ZoneModel.find({ isActive: true })
    const zonesPlain = allZones.map(z => z.toObject()) as Zone[]

    const { zones: hydrated, adjacencyMap } = buildAndApplyAdjacency(
      zonesPlain,
      mode as ScaleMode
    )

    if (action === 'rebuild') {
      for (const hz of hydrated) {
        await ZoneModel.findByIdAndUpdate(hz._id, {
          adjacency: hz.adjacency,
          distanceMatrix: hz.distanceMatrix,
          $inc: { version: 1 },
        })
      }

      const isolated = findIsolatedZones(hydrated, adjacencyMap)

      return NextResponse.json({
        success: true,
        data: {
          message: `Adjacency rebuilt for ${hydrated.length} zones`,
          isolatedZones: isolated.map(z => ({ id: z._id, name: z.name })),
          mode,
        },
      })
    }

    if (action === 'shortest_path') {
      const { sourceZoneId, targetZoneId } = body

      if (!sourceZoneId || !targetZoneId) {
        return NextResponse.json(
          { success: false, error: 'Missing sourceZoneId or targetZoneId' },
          { status: 400 }
        )
      }

      const path = findShortestPath(sourceZoneId, targetZoneId, adjacencyMap)

      if (!path) {
        return NextResponse.json(
          { success: false, error: 'No path found between zones' },
          { status: 404 }
        )
      }

      return NextResponse.json({ success: true, data: path })
    }

    if (action === 'within_travel_time') {
      const { sourceZoneId, maxMinutes } = body

      if (!sourceZoneId || !maxMinutes) {
        return NextResponse.json(
          { success: false, error: 'Missing sourceZoneId or maxMinutes' },
          { status: 400 }
        )
      }

      const reachable = getZonesWithinTravelTime(sourceZoneId, maxMinutes, adjacencyMap)

      return NextResponse.json({ success: true, data: reachable })
    }

    if (action === 'ranked_neighbours') {
      const { zoneId } = body

      if (!zoneId) {
        return NextResponse.json(
          { success: false, error: 'Missing zoneId' },
          { status: 400 }
        )
      }

      const zone = hydrated.find(z => z._id === zoneId)
      if (!zone) {
        return NextResponse.json(
          { success: false, error: 'Zone not found' },
          { status: 404 }
        )
      }

      const snapshots: ZoneSnapshot[] = hydrated.map(z => ({
        zone,
        currentDeployment: z.currentDeployment ?? 0,
        safeThreshold: z.safeThreshold ?? 0,
      }))

      const safeThresholds = new Map(
        hydrated.map(z => [z._id, z.safeThreshold ?? 0])
      )

      const ranked = getRankedNeighbours(
        zone,
        hydrated,
        adjacencyMap,
        snapshots,
        safeThresholds,
      )

      return NextResponse.json({ success: true, data: ranked })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: rebuild, shortest_path, within_travel_time, ranked_neighbours' },
      { status: 400 }
    )
  } catch {
    return NextResponse.json({ success: false, error: 'Graph operation failed' }, { status: 500 })
  }
}