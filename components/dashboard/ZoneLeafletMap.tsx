"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface ZoneMapData {
    _id: string
    name: string
    code: string
    sizeScore: number
    densityScore: number
    currentDeployment: number
    safeThreshold: number
    heatmapColor: string
    centroid?: {
        type?: string
        coordinates: [number, number] // [lng, lat]
    }
    boundaries?: {
        type: string
        coordinates: number[][][]
    }
}

const HEATMAP_COLORS: Record<string, string> = {
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
}

export default function ZoneLeafletMap({
    zones,
    onZoneClick,
}: {
    zones: ZoneMapData[]
    onZoneClick?: (zoneId: string) => void
}) {
    const mapRef = useRef<L.Map | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        // Don't re-init if map already exists
        if (mapRef.current) {
            mapRef.current.remove()
            mapRef.current = null
        }

        const map = L.map(containerRef.current, {
            center: [28.6139, 77.209], // Default: New Delhi
            zoom: 12,
            zoomControl: true,
            attributionControl: false,
        })

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        }).addTo(map)

        // Fit bounds to zones if available
        const validZones = zones.filter(
            (z) => z.centroid && z.centroid.coordinates && z.centroid.coordinates.length === 2
        )

        if (validZones.length > 0) {
            const bounds = L.latLngBounds(
                validZones.map((z) => [z.centroid!.coordinates[1], z.centroid!.coordinates[0]])
            )
            map.fitBounds(bounds.pad(0.3))
        }
        // Spread out zones that share the same centroid coordinates
        const coordKey = (z: ZoneMapData) =>
            z.centroid ? `${z.centroid.coordinates[0].toFixed(4)},${z.centroid.coordinates[1].toFixed(4)}` : ''
        const groups: Record<string, ZoneMapData[]> = {}
        for (const z of zones) {
            const key = coordKey(z)
            if (key) { groups[key] = groups[key] || []; groups[key].push(z) }
        }
        // For groups with duplicate coords, spread them in a circle
        const spreadCoords = new Map<string, [number, number]>() // zoneId -> [lng, lat]
        for (const [, group] of Object.entries(groups)) {
            if (group.length <= 1) {
                if (group[0].centroid) spreadCoords.set(group[0]._id, group[0].centroid.coordinates)
                continue
            }
            const [baseLng, baseLat] = group[0].centroid!.coordinates
            const radius = 0.008 // ~0.8km spread
            group.forEach((z, i) => {
                const angle = (2 * Math.PI * i) / group.length
                spreadCoords.set(z._id, [
                    baseLng + radius * Math.cos(angle),
                    baseLat + radius * Math.sin(angle),
                ])
            })
        }


        for (const zone of zones) {
            const color = HEATMAP_COLORS[zone.heatmapColor] || HEATMAP_COLORS.green

            // Draw boundaries if available
            if (zone.boundaries && zone.boundaries.coordinates && zone.boundaries.coordinates.length > 0) {
                const latlngs = zone.boundaries.coordinates[0].map(
                    ([lng, lat]) => [lat, lng] as [number, number]
                )
                const polygon = L.polygon(latlngs, {
                    color,
                    fillColor: color,
                    fillOpacity: 0.25,
                    weight: 2,
                }).addTo(map)

                polygon.bindPopup(buildPopup(zone))
                if (onZoneClick) {
                    polygon.on("click", () => onZoneClick(zone._id))
                }
            }

            // Draw centroid marker using spread coordinates
            const coords = spreadCoords.get(zone._id)
            if (coords) {
                const [lng, lat] = coords

                const circleMarker = L.circleMarker([lat, lng], {
                    radius: Math.max(8, zone.sizeScore * 2),
                    fillColor: color,
                    color: "#1e3a5f",
                    weight: 2,
                    fillOpacity: 0.8,
                }).addTo(map)

                circleMarker.bindPopup(buildPopup(zone))
                circleMarker.bindTooltip(zone.code, {
                    permanent: true,
                    direction: "center",
                    className: "zone-label-tooltip",
                })

                if (onZoneClick) {
                    circleMarker.on("click", () => onZoneClick(zone._id))
                }
            }
        }

        // Draw adjacency lines between nearby zones
        for (let i = 0; i < validZones.length; i++) {
            for (let j = i + 1; j < validZones.length; j++) {
                const a = spreadCoords.get(validZones[i]._id) || validZones[i].centroid!.coordinates
                const b = spreadCoords.get(validZones[j]._id) || validZones[j].centroid!.coordinates
                const dist = haversine(validZones[i].centroid!.coordinates, validZones[j].centroid!.coordinates)

                if (dist < 15) {
                    // within 15km — draw adjacency line
                    L.polyline(
                        [
                            [a[1], a[0]],
                            [b[1], b[0]],
                        ],
                        {
                            color: "#94a3b8",
                            weight: 1,
                            dashArray: "5 5",
                            opacity: 0.5,
                        }
                    ).addTo(map)
                }
            }
        }

        mapRef.current = map

        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, [zones, onZoneClick])

    return (
        <div className="relative">
            <div ref={containerRef} style={{ height: "420px", width: "100%", borderRadius: "8px" }} />
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs shadow z-[1000]">
                <p className="font-semibold text-gray-700 mb-1">Threat Level</p>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> High</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Elevated</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Moderate</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Low</span>
                </div>
            </div>
            <style jsx global>{`
        .zone-label-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #1e3a5f;
          font-weight: 800;
          font-size: 10px;
          text-shadow: 0 0 3px white, 0 0 5px white;
        }
        .zone-label-tooltip::before {
          display: none !important;
        }
      `}</style>
        </div>
    )
}

function buildPopup(zone: ZoneMapData): string {
    const color = HEATMAP_COLORS[zone.heatmapColor] || "#22c55e"
    return `
    <div style="min-width:160px;font-family:system-ui">
      <div style="font-weight:700;font-size:14px;color:#1e3a5f;border-bottom:2px solid ${color};padding-bottom:4px;margin-bottom:6px">
        ${zone.name} (${zone.code})
      </div>
      <div style="font-size:12px;line-height:1.6">
        <div><b>Size Score:</b> ${zone.sizeScore}/10</div>
        <div><b>Density Score:</b> ${zone.densityScore}/10</div>
        <div><b>Deployed:</b> ${zone.currentDeployment}</div>
        <div><b>Safe Threshold:</b> ${zone.safeThreshold}</div>
        <div style="margin-top:4px">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;color:white;background:${color}">
            ${zone.heatmapColor?.toUpperCase() || 'GREEN'}
          </span>
        </div>
      </div>
    </div>
  `
}

function haversine([lng1, lat1]: number[], [lng2, lat2]: number[]): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
