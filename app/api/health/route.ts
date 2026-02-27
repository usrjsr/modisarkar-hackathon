import { NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import PersonnelModel from '@/lib/db/models/Personnel'
import RosterModel from '@/lib/db/models/Roster'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import DeploymentModel from '@/lib/db/models/Deployment'
import IncidentModel from '@/lib/db/models/Incident'

export async function GET() {
  const start = Date.now()

  try {
    await connectDB()

    const [
      totalZones,
      activeZones,
      totalPersonnel,
      deployedPersonnel,
      activeRoster,
      systemConfig,
      openIncidents,
      todayDeployments,
    ] = await Promise.all([
      ZoneModel.countDocuments(),
      ZoneModel.countDocuments({ isActive: true }),
      PersonnelModel.countDocuments(),
      PersonnelModel.countDocuments({ status: 'Deployed' }),
      RosterModel.findOne({ isActive: true }).select('validFrom validUntil generatedAt'),
      SystemConfigModel.findOne().sort({ createdAt: -1 }).select('totalForce weights standbyPercentage'),
      IncidentModel.countDocuments({ 'resolution.status': { $in: ['Pending', 'Escalation'] } }),
      DeploymentModel.countDocuments({
        date: {
          $gte: new Date(new Date().toDateString()),
          $lt: new Date(new Date().setDate(new Date().getDate() + 1)),
        },
        status: { $in: ['Active', 'Scheduled'] },
      }),
    ])

    const responseTime = Date.now() - start

    const warnings: string[] = []

    if (!systemConfig) {
      warnings.push('SystemConfig not found — run seed before using the system')
    }
    if (activeZones === 0) {
      warnings.push('No active zones — create zones before generating roster')
    }
    if (!activeRoster) {
      warnings.push('No active roster — generate a roster to begin deployments')
    }
    if (openIncidents > 0) {
      warnings.push(`${openIncidents} unresolved incident(s) require attention`)
    }

    const status = warnings.length === 0 ? 'healthy' : warnings.length <= 2 ? 'degraded' : 'critical'

    return NextResponse.json({
      success: true,
      status,
      data: {
        database: 'connected',
        responseMs: responseTime,
        timestamp: new Date().toISOString(),
        system: {
          totalForce: systemConfig?.totalForce ?? 0,
          weights: systemConfig?.weights ?? null,
          standbyPercentage: systemConfig?.standbyPercentage ?? 0.15,
        },
        zones: {
          total: totalZones,
          active: activeZones,
        },
        personnel: {
          total: totalPersonnel,
          deployed: deployedPersonnel,
          available: totalPersonnel - deployedPersonnel,
        },
        roster: activeRoster
          ? {
            active: true,
            generatedAt: activeRoster.generatedAt,
            validFrom: activeRoster.validFrom,
            validUntil: activeRoster.validUntil,
          }
          : { active: false },
        incidents: {
          open: openIncidents,
        },
        deployments: {
          today: todayDeployments,
        },
      },
      warnings,
    })
  } catch {
    const responseTime = Date.now() - start
    return NextResponse.json(
      {
        success: false,
        status: 'critical',
        data: {
          database: 'disconnected',
          responseMs: responseTime,
          timestamp: new Date().toISOString(),
        },
        warnings: ['Database connection failed'],
      },
      { status: 503 }
    )
  }
}
