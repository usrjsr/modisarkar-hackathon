import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import mongoose from 'mongoose'
import ZoneModel from '@/lib/db/models/Zone'
import PersonnelModel from '@/lib/db/models/Personnel'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import { patchMassAbsence } from '@/lib/algorithms/deficitResolver'
import { buildAdjacencyMap } from '@/lib/algorithms/graph/adjacencyBuilder'
import type { Zone, ZoneSnapshot, ZoneAllocation } from '@/lib/types/zone'
import type { Personnel } from '@/lib/types/personnel'
import { FIELD_DEPLOYABLE_RANKS } from '@/lib/constants/ranks'
import { MASS_ABSENCE_FRACTION } from '@/lib/constants/thresholds'

interface Params {
    params: Promise<{ zoneId: string }>
}

/**
 * POST /api/zones/[zoneId]/absence
 *
 * Simulates a mass absence scenario where a percentage of a zone's force
 * goes on leave. The system patches the deployment using the same
 * cascading resolution (Step A → B → C) from Stage 3.
 *
 * Body:
 *   - shift: 'morning' | 'evening' | 'night'
 *   - shiftStart: ISO date string
 *   - absenceFraction?: number (default: MASS_ABSENCE_FRACTION = 0.10)
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        await connectDB()
        const { zoneId } = await params

        const body = await req.json()
        const { shift, shiftStart, absenceFraction } = body

        if (!shift || !shiftStart) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: shift, shiftStart' },
                { status: 400 }
            )
        }

        // Load config
        const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
        if (!config) {
            return NextResponse.json({ success: false, error: 'SystemConfig not found' }, { status: 404 })
        }

        // Load zone
        const zoneDoc = await ZoneModel.findById(zoneId)
        if (!zoneDoc || !zoneDoc.isActive) {
            return NextResponse.json({ success: false, error: 'Zone not found or inactive' }, { status: 404 })
        }

        const shiftDate = new Date(shiftStart)
        const fraction = absenceFraction ?? MASS_ABSENCE_FRACTION

        // Get all deployed personnel for this zone
        const deployedInZone = await PersonnelModel.find({
            currentZones: zoneId,
            status: 'Deployed',
            rank: { $in: FIELD_DEPLOYABLE_RANKS },
        }).lean()

        const deployedPlain = deployedInZone.map(o => ({
            ...o,
            _id: o._id.toString(),
        })) as Personnel[]

        // Determine how many go on leave (fraction of zone force)
        const absenceCount = Math.max(1, Math.ceil(deployedPlain.length * fraction))
        const absentOfficers = deployedPlain.slice(0, absenceCount)

        if (absentOfficers.length === 0) {
            return NextResponse.json({
                success: true,
                data: { message: 'No personnel to mark absent', absenceCount: 0 },
            })
        }

        // Mark absent officers as OnLeave in DB
        const absentIds = absentOfficers.map(o => new mongoose.Types.ObjectId(o._id))
        await PersonnelModel.updateMany(
            { _id: { $in: absentIds } },
            {
                $set: { status: 'OnLeave' },
                $pull: { currentZones: new mongoose.Types.ObjectId(zoneId) },
            }
        )

        // Update zone's currentDeployment
        const newDeployment = Math.max(0, (zoneDoc.currentDeployment ?? 0) - absenceCount)
        await ZoneModel.findOneAndUpdate(
            { _id: zoneId, version: zoneDoc.version },
            { currentDeployment: newDeployment, $inc: { version: 1 } }
        )

        // Build data for patchMassAbsence resolution
        const allZones = await ZoneModel.find({ isActive: true })
        const zonesPlain = allZones.map(z => {
            const o = z.toObject()
            return { ...o, _id: o._id.toString() } as Zone
        })
        const affectedZone = zonesPlain.find(z => z._id === zoneId)!

        // Hydrate adjacency
        const adjacencyMap = buildAdjacencyMap(zonesPlain, 'macro')
        for (const zp of zonesPlain) {
            zp.adjacency = (adjacencyMap[zp._id] ?? []).map(e => e.zoneId)
            zp.distanceMatrix = (adjacencyMap[zp._id] ?? []).map(e => ({
                zoneId: e.zoneId,
                distanceKm: e.distanceKm,
                travelTimeMinutes: e.travelTimeMinutes,
            }))
        }

        // Build deployed personnel map (post-absence)
        const deployedPersonnel = new Map<string, Personnel[]>()
        for (const zp of zonesPlain) {
            const officers = await PersonnelModel.find({
                currentZones: zp._id,
                status: 'Deployed',
                rank: { $in: FIELD_DEPLOYABLE_RANKS },
            }).lean()
            deployedPersonnel.set(
                zp._id,
                officers.map(o => ({ ...o, _id: o._id.toString() })) as Personnel[]
            )
        }

        const standbyOfficers = await PersonnelModel.find({
            status: 'Standby',
            rank: { $in: FIELD_DEPLOYABLE_RANKS },
        }).lean()
        const standbyPool = standbyOfficers.map(o => ({
            ...o,
            _id: o._id.toString(),
        })) as Personnel[]

        const allAllocations: ZoneAllocation[] = zonesPlain.map(z => ({
            zoneId: z._id,
            zScore: z.zScore ?? 0,
            allocation: z.allocation ?? 0,
            safeThreshold: z.safeThreshold ?? 0,
            heatmapColor: z.heatmapColor ?? 'green',
        }))

        const allZoneSnapshots: ZoneSnapshot[] = zonesPlain.map(zp => ({
            zone: zp,
            currentDeployment: deployedPersonnel.get(zp._id)?.length ?? 0,
            safeThreshold: zp.safeThreshold ?? 0,
        }))

        // Run cascading resolution to patch the gap
        const result = patchMassAbsence({
            affectedZone,
            absentOfficers,
            shift,
            shiftStart: shiftDate,
            allZoneSnapshots,
            allAllocations,
            deployedPersonnel,
            standbyPool,
            weights: config.weights,
        })

        // Apply resolution — move new personnel to zone
        if (result.movedPersonnel.length > 0) {
            const movedIds = result.movedPersonnel.map(p =>
                new mongoose.Types.ObjectId(String(p.officerId))
            )
            const zoneObjectId = new mongoose.Types.ObjectId(zoneId)

            await PersonnelModel.updateMany(
                { _id: { $in: movedIds } },
                { $set: { status: 'Deployed' }, $addToSet: { currentZones: zoneObjectId } },
            )

            // Update zone's deployment count with resolved troops
            await ZoneModel.findByIdAndUpdate(zoneId, {
                currentDeployment: newDeployment + result.troopsResolved,
            })
        }

        return NextResponse.json({
            success: true,
            data: {
                zoneId,
                absenceCount,
                absentOfficerIds: absentOfficers.map(o => o._id),
                resolution: {
                    status: result.status,
                    troopsResolved: result.troopsResolved,
                    remainingDeficit: result.remainingDeficit,
                    steps: result.steps,
                    warningMessage: result.warningMessage,
                    movedPersonnelCount: result.movedPersonnel.length,
                },
            },
        }, { status: 201 })
    } catch (error) {
        console.error('Mass absence simulation error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to simulate mass absence' },
            { status: 500 }
        )
    }
}
