import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'

interface Params {
    params: Promise<{ zoneId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        await connectDB()
        const { zoneId } = await params

        const personnel = await PersonnelModel.find({
            currentZones: zoneId,
        })
            .select('name badgeNumber rank status fatigueScore')
            .sort({ rank: 1, name: 1 })
            .lean()

        return NextResponse.json({ success: true, data: personnel })
    } catch {
        return NextResponse.json(
            { success: false, error: 'Failed to fetch zone personnel' },
            { status: 500 }
        )
    }
}
