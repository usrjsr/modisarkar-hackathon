import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import SystemConfigModel from '@/lib/db/models/SystemConfig'

export async function GET() {
    try {
        await connectDB()
        const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
        if (!config) {
            return NextResponse.json({ success: false, error: 'No system config found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, data: config })
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch config' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectDB()
        const body = await req.json()
        const {
            totalForce,
            weights,
            standbyPercentage,
            restHours,
            forceComposition,
        } = body

        if (!totalForce || !weights) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: totalForce, weights' },
                { status: 400 }
            )
        }

        const config = await SystemConfigModel.create({
            totalForce,
            weights,
            standbyPercentage: standbyPercentage ?? 0.15,
            restHours: restHours ?? { lowerRanks: 8, inspectors: 12 },
            forceComposition: forceComposition ?? {},
            shiftConfig: {
                morning: { start: '06:00', end: '14:00' },
                evening: { start: '14:00', end: '22:00' },
                night: { start: '22:00', end: '06:00' },
            },
            fatigueWeights: {
                standardShift: 1.0,
                nightShift: 1.5,
                emergencyDeployment: 2.0,
            },
            version: 0,
        })

        return NextResponse.json({ success: true, data: config }, { status: 201 })
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to save config' }, { status: 500 })
    }
}
