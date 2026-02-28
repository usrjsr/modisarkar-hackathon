import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import RosterModel from '@/lib/db/models/Roster'
import PersonnelModel from '@/lib/db/models/Personnel'
import ZoneModel from '@/lib/db/models/Zone'

export async function GET(req: NextRequest) {
	try {
		await connectDB()

		const { searchParams } = new URL(req.url)
		const date = searchParams.get('date')
		const shift = searchParams.get('shift')

		if (!date || !shift) {
			return NextResponse.json(
				{ success: false, error: 'Missing required params: date, shift' },
				{ status: 400 }
			)
		}

		// Find the active roster
		const roster = await RosterModel.findOne({ isActive: true })
		if (!roster) {
			return NextResponse.json(
				{ success: false, error: 'No active roster found' },
				{ status: 404 }
			)
		}

		// Find the matching day in the schedule
		const targetDate = new Date(date)
		const dayEntry = roster.schedule.find((d: { date: Date }) => {
			const dDate = new Date(d.date)
			return (
				dDate.getFullYear() === targetDate.getFullYear() &&
				dDate.getMonth() === targetDate.getMonth() &&
				dDate.getDate() === targetDate.getDate()
			)
		})

		if (!dayEntry) {
			return NextResponse.json(
				{ success: false, error: 'Day not found in roster schedule' },
				{ status: 404 }
			)
		}

		const shiftBlock = dayEntry.shifts?.[shift as string]
		if (!shiftBlock) {
			return NextResponse.json(
				{ success: false, error: `Shift "${shift}" not found for this day` },
				{ status: 404 }
			)
		}

		const deployments = shiftBlock.deployments || []

		// Get zone details and personnel for each deployment
		const zoneIds = deployments.map((d: { zoneId: string }) => d.zoneId)
		const zones = await ZoneModel.find({ _id: { $in: zoneIds } })
			.select('name code heatmapColor')
			.lean()

		const zoneMap = new Map(zones.map((z: { _id: { toString: () => string }; name: string; code: string; heatmapColor: string }) => [z._id.toString(), z]))

		// Get all currently deployed personnel grouped by zone
		const personnel = await PersonnelModel.find({
			currentZone: { $in: zoneIds },
		})
			.select('name badgeNumber rank status fatigueScore currentZone')
			.lean()

		// Build enriched deployments
		const enrichedDeployments = deployments.map((dep: { zoneId: string; totalStrength: number; requiredStrength: number; deficit: number; status: string }) => {
			const zone = zoneMap.get(dep.zoneId)
			const zonePersonnel = personnel.filter(
				(p: { currentZone?: { toString: () => string } }) => p.currentZone?.toString() === dep.zoneId
			)

			return {
				zoneId: dep.zoneId,
				zoneName: (zone as { name?: string })?.name || 'Unknown',
				zoneCode: (zone as { code?: string })?.code || '—',
				heatmapColor: (zone as { heatmapColor?: string })?.heatmapColor || 'green',
				totalStrength: dep.totalStrength,
				requiredStrength: dep.requiredStrength,
				deficit: dep.deficit,
				status: dep.status,
				personnel: zonePersonnel,
			}
		})

		return NextResponse.json({
			success: true,
			data: {
				date: dayEntry.date,
				shift,
				startTime: shiftBlock.startTime,
				endTime: shiftBlock.endTime,
				standbyCount: shiftBlock.standbyCount ?? 0,
				totalDeployed: shiftBlock.totalDeployed ?? deployments.reduce((s: number, d: { totalStrength: number }) => s + (d.totalStrength ?? 0), 0),
				totalRequired: shiftBlock.totalRequired ?? deployments.reduce((s: number, d: { requiredStrength: number }) => s + (d.requiredStrength ?? 0), 0),
				deployments: enrichedDeployments,
			},
		})
	} catch (error) {
		console.error('Shift detail error:', error)
		return NextResponse.json(
			{ success: false, error: 'Failed to fetch shift details' },
			{ status: 500 }
		)
	}
}
