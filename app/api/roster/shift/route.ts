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

		// ── Get ALL active zones so we can match flexibly ──
		const allZones = await ZoneModel.find({ isActive: true })
			.select('name code heatmapColor')
			.lean()

		// Build lookup map: normalised ID string → zone info
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const zoneById = new Map<string, { name: string; code: string; heatmapColor: string }>()
		for (const z of allZones) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const raw = z as any
			const id = String(raw._id).trim()
			zoneById.set(id, { name: raw.name, code: raw.code, heatmapColor: raw.heatmapColor })
		}

		const findZone = (zoneId: string) => zoneById.get(String(zoneId).trim()) || null

		// ── Collect all personnelIds for bulk fetch ──
		const allPersonnelIds: string[] = []
		for (const dep of deployments as Array<{ zoneId: string; personnelIds?: string[] }>) {
			if (dep.personnelIds?.length) {
				allPersonnelIds.push(...dep.personnelIds.map((id: unknown) => String(id).trim()))
			}
		}

		// Fetch personnel from DB
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let personnelById: Map<string, any> = new Map()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let fallbackPersonnel: any[] = []

		if (allPersonnelIds.length) {
			const fetched = await PersonnelModel.find({ _id: { $in: allPersonnelIds } })
				.select('name badgeNumber rank status fatigueScore currentZones')
				.lean()
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			personnelById = new Map(fetched.map((p: any) => [String(p._id).trim(), p]))
		} else {
			// Legacy fallback: no personnelIds stored, use currentZones
			const zoneIds = deployments.map((d: { zoneId: string }) => d.zoneId)
			fallbackPersonnel = await PersonnelModel.find({
				currentZones: { $in: zoneIds },
			})
				.select('name badgeNumber rank status fatigueScore currentZones')
				.lean()
		}

		// ── Build enriched deployments ──
		const enrichedDeployments = deployments.map(
			(dep: { zoneId: string; personnelIds?: string[]; totalStrength: number; requiredStrength: number; deficit: number; status: string }) => {
				const zone = findZone(dep.zoneId)

				// Resolve personnel for this zone
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let zonePersonnel: any[]
				if (dep.personnelIds?.length) {
					zonePersonnel = dep.personnelIds
						.map((id: unknown) => personnelById.get(String(id).trim()))
						.filter(Boolean)
				} else {
					zonePersonnel = fallbackPersonnel.filter(
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(p: any) => p.currentZones?.some((z: any) => String(z).trim() === String(dep.zoneId).trim())
					)
				}

				// Map personnel — in roster context, assigned to this shift = "Deployed"
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const mappedPersonnel = zonePersonnel.map((p: any) => ({
					_id: String(p._id),
					name: p.name || 'Unknown',
					badgeNumber: p.badgeNumber || '—',
					rank: p.rank || 'Unknown',
					status: 'Deployed',  // They're in the roster deployment = Deployed for this shift
					fatigueScore: p.fatigueScore ?? 0,
				}))

				return {
					zoneId: dep.zoneId,
					zoneName: zone?.name || 'Unknown Zone',
					zoneCode: zone?.code || '—',
					heatmapColor: zone?.heatmapColor || 'green',
					totalStrength: dep.totalStrength,
					requiredStrength: dep.requiredStrength,
					deficit: dep.deficit,
					status: dep.status,
					personnel: mappedPersonnel,
					personnelCount: mappedPersonnel.length,
				}
			}
		)

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
