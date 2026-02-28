import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'

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

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or empty request body' }, { status: 400 })
    }
    const { name, code, sizeScore, densityScore, geometry, centroid } = body

    if (!name || !code || !sizeScore || !densityScore) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await ZoneModel.findOne({ code })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Zone code already exists' }, { status: 409 })
    }

    // Calculate initial zScore
    const w_s = 0.3, w_d = 0.7
    const zScore = (w_s * sizeScore + w_d * densityScore) / (w_s + w_d)
    const normalised = ((zScore - 1) / 9) * 10
    const heatmapColor = normalised >= 7.5 ? 'red' : normalised >= 5.0 ? 'orange' : normalised >= 2.5 ? 'yellow' : 'green'

    const zone = await ZoneModel.create({
      name,
      code,
      sizeScore,
      densityScore,
      baseDensity: densityScore,
      zScore,
      currentDeployment: 0,
      safeThreshold: 0,
      geometry,
      centroid: {
        type: 'Point',
        coordinates: centroid?.coordinates || [77.22, 28.60]
      },
      adjacency: [],
      distanceMatrix: [],
      heatmapColor,
      isActive: true,
      version: 0,
    })

    return NextResponse.json({ success: true, data: zone }, { status: 201 })
  } catch (error) {
    console.error('Zone creation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create zone'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}