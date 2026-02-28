import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'
import { RANK_TO_LEVEL, FIELD_DEPLOYABLE_RANKS } from '@/lib/constants/ranks'
import type { Rank } from '@/lib/constants/ranks'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const rank = searchParams.get('rank')
    const status = searchParams.get('status')
    const zoneId = searchParams.get('zoneId')
    const deployable = searchParams.get('deployable')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const skip = (page - 1) * limit

    const query: Record<string, unknown> = {}

    if (rank) query.rank = rank
    if (status) query.status = status
    if (zoneId) query.currentZones = zoneId
    if (deployable === 'true') query.rank = { $in: FIELD_DEPLOYABLE_RANKS }

    const [personnel, total] = await Promise.all([
      PersonnelModel
        .find(query)
        .sort({ rank: 1, fatigueScore: 1 })
        .skip(skip)
        .limit(limit)
        .populate('homeZone', 'name code')
        .populate('currentZones', 'name code'),
      PersonnelModel.countDocuments(query),
    ])

    return NextResponse.json({
      success: true,
      data: personnel,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch personnel' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const {
      badgeNumber,
      name,
      rank,
      homeZone,
      status = 'Active',
      email,
      password,
      role = 'OFFICER',
    } = body

    if (!badgeNumber || !name || !rank) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: badgeNumber, name, rank' },
        { status: 400 }
      )
    }

    const validRanks = [
      'DGP', 'ADGP', 'IG', 'DIG', 'SP',
      'DSP', 'ASP', 'Inspector', 'SI',
      'ASI', 'HeadConstable', 'Constable',
    ]
    if (!validRanks.includes(rank)) {
      return NextResponse.json(
        { success: false, error: `Invalid rank. Must be one of: ${validRanks.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await PersonnelModel.findOne({ badgeNumber })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Badge number already exists' },
        { status: 409 }
      )
    }

    const commandLevel = RANK_TO_LEVEL[rank as Rank]

    const officer = await PersonnelModel.create({
      badgeNumber,
      name,
      rank,
      commandLevel,
      homeZone: homeZone ?? null,
      currentZones: [],
      fatigueScore: 0,
      fatigueHistory: [],
      status,
      leavePeriods: [],
      lastShiftEnd: null,
      consecutiveNightShifts: 0,
      totalDeployments: 0,
      nextAvailableAt: null,
      version: 0,
      email: email ?? null,
      password: password ?? null,
      role,
    })

    return NextResponse.json({ success: true, data: officer }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create officer' }, { status: 500 })
  }
}