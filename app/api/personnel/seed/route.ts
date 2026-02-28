import { NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import mongoose from 'mongoose'
import { RANK_TO_LEVEL } from '@/lib/constants/ranks'
import type { Rank } from '@/lib/constants/ranks'

const FIRST_NAMES = ['Raj', 'Priya', 'Amit', 'Suman', 'Vikram', 'Anita', 'Deepak', 'Kavita', 'Suresh', 'Meera', 'Rahul', 'Pooja', 'Arun', 'Neha', 'Manoj', 'Ritu', 'Sanjay', 'Geeta', 'Ravi', 'Anjali', 'Kiran', 'Mohit', 'Sunita', 'Devendra', 'Preeti', 'Nikhil', 'Rekha', 'Ashok', 'Sarita', 'Varun']
const LAST_NAMES = ['Kumar', 'Singh', 'Sharma', 'Verma', 'Patel', 'Gupta', 'Shah', 'Mehta', 'Joshi', 'Yadav', 'Malik', 'Chauhan', 'Tiwari', 'Pandey', 'Mishra', 'Rao', 'Nair', 'Reddy', 'Das', 'Bhat', 'Khan', 'Dubey', 'Jain', 'Saxena', 'Kapoor']

const RANK_COUNTS: Record<string, number> = {
    DGP: 2, ADGP: 5, IG: 10, DIG: 20, SP: 30,
    DSP: 50, ASP: 60, Inspector: 150,
    SI: 300, ASI: 400, HeadConstable: 800, Constable: 3173,
}

export async function POST() {
    try {
        await connectDB()
        const collection = mongoose.connection.db!.collection('personnels')

        // Delete existing
        await collection.deleteMany({})

        const batch: Record<string, unknown>[] = []
        let badgeNum = 1

        for (const [rank, count] of Object.entries(RANK_COUNTS)) {
            for (let i = 0; i < count; i++) {
                const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
                const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
                batch.push({
                    badgeNumber: `OP-${String(badgeNum).padStart(5, '0')}`,
                    name: `${firstName} ${lastName}`,
                    rank,
                    commandLevel: RANK_TO_LEVEL[rank as Rank],
                    homeZone: null,
                    currentZones: [],
                    fatigueScore: 0,
                    fatigueHistory: [],
                    status: 'Active',
                    leavePeriods: [],
                    lastShiftEnd: null,
                    consecutiveNightShifts: 0,
                    totalDeployments: 0,
                    nextAvailableAt: null,
                    version: 0,
                    role: 'OFFICER',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                badgeNum++
            }
        }

        // Insert in batches of 500
        for (let i = 0; i < batch.length; i += 500) {
            await collection.insertMany(batch.slice(i, i + 500))
        }

        return NextResponse.json({ success: true, count: batch.length }, { status: 201 })
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: (error as Error)?.message || 'Failed' }, { status: 500 })
    }
}
