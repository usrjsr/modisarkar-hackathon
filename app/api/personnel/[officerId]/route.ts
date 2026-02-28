import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'
import { RANK_TO_LEVEL } from '@/lib/constants/ranks'
import type { Rank } from '@/lib/constants/ranks'

interface Params {
  params: Promise<{ officerId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const officer = await PersonnelModel
      .findById(officerId)
      .populate('homeZone', 'name code heatmapColor')
      .populate('currentZones', 'name code heatmapColor')

    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: officer })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch officer' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const body = await req.json()
    const { version, ...updates } = body

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    if (version !== undefined && officer.version !== version) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conflict: officer record was modified by another admin',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 }
      )
    }

    const disallowed = ['_id', 'badgeNumber', 'createdAt', 'password']
    for (const key of disallowed) delete updates[key]

    if (updates.rank) {
      updates.commandLevel = RANK_TO_LEVEL[updates.rank as Rank]
    }

    const updated = await PersonnelModel.findByIdAndUpdate(
      officerId,
      { ...updates, $inc: { version: 1 } },
      { new: true }
    )
      .populate('homeZone', 'name code')
      .populate('currentZones', 'name code')

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update officer' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    if (officer.status === 'Deployed') {
      return NextResponse.json(
        { success: false, error: 'Cannot remove officer who is currently deployed' },
        { status: 400 }
      )
    }

    await PersonnelModel.findByIdAndUpdate(officerId, {
      status: 'Unavailable',
      $inc: { version: 1 },
    })

    return NextResponse.json({ success: true, message: 'Officer marked as unavailable' })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to remove officer' }, { status: 500 })
  }
}