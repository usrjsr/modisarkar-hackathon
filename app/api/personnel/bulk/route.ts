import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'
import { RANK_TO_LEVEL } from '@/lib/constants/ranks'
import type { Rank } from '@/lib/constants/ranks'

const VALID_RANKS = [
    'DGP', 'ADGP', 'IG', 'DIG', 'SP',
    'DSP', 'ASP', 'Inspector', 'SI',
    'ASI', 'HeadConstable', 'Constable',
]

// Normalise column header to a known key
function normaliseHeader(raw: string): string | null {
    const h = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (['badgenumber', 'badge', 'badgeno', 'badgeid', 'id'].includes(h)) return 'badgeNumber'
    if (['name', 'fullname', 'officername'].includes(h)) return 'name'
    if (['rank', 'designation', 'post'].includes(h)) return 'rank'
    if (['status'].includes(h)) return 'status'
    if (['email', 'emailid'].includes(h)) return 'email'
    return null
}

// Best-effort rank normalisation
function normaliseRank(raw: string): string | null {
    const r = raw.trim()
    // Exact match
    if (VALID_RANKS.includes(r)) return r

    // Case-insensitive match
    const lower = r.toLowerCase()
    const found = VALID_RANKS.find(v => v.toLowerCase() === lower)
    if (found) return found

    // Common abbreviations/alternate names
    const aliases: Record<string, string> = {
        'head constable': 'HeadConstable',
        'headconstable': 'HeadConstable',
        'hc': 'HeadConstable',
        'sub inspector': 'SI',
        'subinspector': 'SI',
        'assistant sub inspector': 'ASI',
        'assistant superintendent': 'ASP',
        'deputy superintendent': 'DSP',
        'superintendent': 'SP',
        'inspector general': 'IG',
        'deputy inspector general': 'DIG',
        'additional director general': 'ADGP',
        'director general': 'DGP',
        'const': 'Constable',
        'insp': 'Inspector',
    }
    return aliases[lower] || null
}

/** Parse a CSV text into an array of row objects keyed by header. */
function parseCSV(text: string): Record<string, string>[] {
    // Normalise line endings
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

    // Find first non-empty line as header
    const nonEmpty = lines.filter(l => l.trim() !== '')
    if (nonEmpty.length < 2) return []

    const headers = nonEmpty[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const rows: Record<string, string>[] = []

    for (let i = 1; i < nonEmpty.length; i++) {
        const cells = nonEmpty[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
            row[h] = cells[idx] ?? ''
        })
        rows.push(row)
    }

    return rows
}

export async function POST(req: NextRequest) {
    try {
        await connectDB()

        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file uploaded' },
                { status: 400 }
            )
        }

        // Read CSV file
        const text = await file.text()
        const rows = parseCSV(text)

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'CSV file contains no data rows' },
                { status: 400 }
            )
        }

        // Detect column mapping from first row keys
        const rawHeaders = Object.keys(rows[0])
        const headerMap: Record<string, string> = {}
        for (const raw of rawHeaders) {
            const mapped = normaliseHeader(raw)
            if (mapped) headerMap[raw] = mapped
        }

        if (!Object.values(headerMap).includes('badgeNumber') ||
            !Object.values(headerMap).includes('name') ||
            !Object.values(headerMap).includes('rank')) {
            return NextResponse.json({
                success: false,
                error: 'CSV must have columns: Badge Number, Name, Rank. Detected columns: ' + rawHeaders.join(', '),
            }, { status: 400 })
        }

        // Parse rows
        const toInsert: Array<Record<string, unknown>> = []
        const errors: Array<{ row: number; reason: string }> = []

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i]
            const mapped: Record<string, string> = {}
            for (const [rawKey, normKey] of Object.entries(headerMap)) {
                mapped[normKey] = String(raw[rawKey] ?? '').trim()
            }

            const rowNum = i + 2 // +1 for 0-index, +1 for header row

            if (!mapped.badgeNumber) {
                errors.push({ row: rowNum, reason: 'Missing badge number' })
                continue
            }
            if (!mapped.name) {
                errors.push({ row: rowNum, reason: 'Missing name' })
                continue
            }
            if (!mapped.rank) {
                errors.push({ row: rowNum, reason: 'Missing rank' })
                continue
            }

            const normRank = normaliseRank(mapped.rank)
            if (!normRank) {
                errors.push({ row: rowNum, reason: `Invalid rank: "${mapped.rank}"` })
                continue
            }

            const commandLevel = RANK_TO_LEVEL[normRank as Rank]

            toInsert.push({
                badgeNumber: mapped.badgeNumber,
                name: mapped.name,
                rank: normRank,
                commandLevel,
                status: mapped.status || 'Active',
                email: mapped.email || null,
                homeZone: null,
                currentZone: null,
                fatigueScore: 0,
                fatigueHistory: [],
                leavePeriods: [],
                lastShiftEnd: null,
                consecutiveNightShifts: 0,
                totalDeployments: 0,
                nextAvailableAt: null,
                version: 0,
            })
        }

        if (toInsert.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No valid rows to insert',
                errors: errors.slice(0, 50),
            }, { status: 400 })
        }

        // Check for duplicate badge numbers within the file
        const badgeSet = new Set<string>()
        const dupeInFile: number[] = []
        for (let i = 0; i < toInsert.length; i++) {
            const badge = toInsert[i].badgeNumber as string
            if (badgeSet.has(badge)) {
                dupeInFile.push(i)
            }
            badgeSet.add(badge)
        }
        // Remove dupes from end to start
        for (const idx of dupeInFile.reverse()) {
            errors.push({ row: idx + 2, reason: `Duplicate badge number in file: "${toInsert[idx].badgeNumber}"` })
            toInsert.splice(idx, 1)
        }

        // Check DB for existing badge numbers
        const badges = toInsert.map(p => p.badgeNumber)
        const existing = await PersonnelModel.find({ badgeNumber: { $in: badges } }).select('badgeNumber').lean()
        const existingSet = new Set(existing.map((e: { badgeNumber: string }) => e.badgeNumber))

        const fresh = toInsert.filter(p => {
            if (existingSet.has(p.badgeNumber as string)) {
                errors.push({ row: -1, reason: `Badge "${p.badgeNumber}" already exists in database — skipped` })
                return false
            }
            return true
        })

        let inserted = 0
        if (fresh.length > 0) {
            // Bulk insert in chunks of 500
            for (let i = 0; i < fresh.length; i += 500) {
                const chunk = fresh.slice(i, i + 500)
                const result = await PersonnelModel.insertMany(chunk, { ordered: false })
                inserted += result.length
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                totalRows: rows.length,
                inserted,
                skipped: rows.length - inserted,
                errors: errors.slice(0, 100),
            },
        }, { status: 201 })
    } catch (error) {
        console.error('Bulk upload error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to process bulk upload' },
            { status: 500 }
        )
    }
}
