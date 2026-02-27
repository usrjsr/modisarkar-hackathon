import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import { buildAndApplyAdjacency } from '@/lib/algorithms/graph/adjacencyBuilder'
import { distributeForce } from '@/lib/algorithms/proportionalDistributor'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import type { Zone } from '@/lib/types/zone'

interface Params {
  params: Promise<{ zoneId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params
    const zone = await ZoneModel.findById(zoneId)
    if (!zone) {
      return NextResponse.json({ success: false, error: 'Zone not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: zone })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch zone' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params

    const body = await req.json()
    const { version, ...updates } = body

    const zone = await ZoneModel.findById(zoneId)
    if (!zone) {
      return NextResponse.json({ success: false, error: 'Zone not found' }, { status: 404 })
    }

    if (version !== undefined && zone.version !== version) {
      return NextResponse.json(
        { success: false, error: 'Conflict: zone was modified by another admin', code: 'VERSION_CONFLICT' },
        { status: 409 }
      )
    }

    const disallowed = ['_id', 'code', 'createdAt']
    for (const key of disallowed) delete updates[key]

    const updated = await ZoneModel.findByIdAndUpdate(
      zoneId,
      { ...updates, $inc: { version: 1 } },
      { new: true }
    )

    if (
      updates.sizeScore !== undefined ||
      updates.densityScore !== undefined
    ) {
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
            safeThreshold: alloc.safeThreshold,
            heatmapColor: alloc.heatmapColor,
          })
        }
      }
    }

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update zone' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params

    const zone = await ZoneModel.findById(zoneId)
    if (!zone) {
      return NextResponse.json({ success: false, error: 'Zone not found' }, { status: 404 })
    }

    await ZoneModel.findByIdAndUpdate(zoneId, {
      isActive: false,
      $inc: { version: 1 },
    })

    await ZoneModel.updateMany(
      { adjacency: zoneId },
      { $pull: { adjacency: zoneId } }
    )

    return NextResponse.json({ success: true, message: 'Zone deactivated' })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete zone' }, { status: 500 })
  }
}