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
    coordinates: [number, number]
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

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(containerRef.current, {
      center: [28.6139, 77.209],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map)

    const validZones = zones.filter(
      (z) => z.centroid && z.centroid.coordinates && z.centroid.coordinates.length === 2
    )

    if (validZones.length > 0) {
      const bounds = L.latLngBounds(
        validZones.map((z) => [z.centroid!.coordinates[1], z.centroid!.coordinates[0]])
      )
      map.fitBounds(bounds.pad(0.3))
    }

    const coordKey = (z: ZoneMapData) =>
      z.centroid ? `${z.centroid.coordinates[0].toFixed(4)},${z.centroid.coordinates[1].toFixed(4)}` : ""
    const groups: Record<string, ZoneMapData[]> = {}
    for (const z of zones) {
      const key = coordKey(z)
      if (key) {
        groups[key] = groups[key] || []
        groups[key].push(z)
      }
    }

    const spreadCoords = new Map<string, [number, number]>()
    for (const [, group] of Object.entries(groups)) {
      if (group.length <= 1) {
        if (group[0].centroid) spreadCoords.set(group[0]._id, group[0].centroid.coordinates)
        continue
      }
      const [baseLng, baseLat] = group[0].centroid!.coordinates
      const radius = 0.008
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

      if (zone.boundaries && zone.boundaries.coordinates && zone.boundaries.coordinates.length > 0) {
        const latlngs = zone.boundaries.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
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

      const coords = spreadCoords.get(zone._id)
      if (coords) {
        const [lng, lat] = coords

        const circleMarker = L.circleMarker([lat, lng], {
          radius: Math.max(8, zone.sizeScore * 2),
          fillColor: color,
          color: "#1e3a5f",
          weight: 2.5,
          fillOpacity: 0.85,
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

    for (let i = 0; i < validZones.length; i++) {
      for (let j = i + 1; j < validZones.length; j++) {
        const a = spreadCoords.get(validZones[i]._id) || validZones[i].centroid!.coordinates
        const b = spreadCoords.get(validZones[j]._id) || validZones[j].centroid!.coordinates
        const dist = haversine(validZones[i].centroid!.coordinates, validZones[j].centroid!.coordinates)

        if (dist < 15) {
          L.polyline(
            [
              [a[1], a[0]],
              [b[1], b[0]],
            ],
            {
              color: "#64748b",
              weight: 1.5,
              dashArray: "5 5",
              opacity: 0.6,
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
    <div className="relative bg-surface rounded-md border border-border overflow-hidden">
      <div ref={containerRef} style={{ height: "420px", width: "100%" }} />

      <div className="absolute bottom-3 left-3 z-[1000]">
        <div className="sentinel-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="status-dot bg-danger" />
            <span className="mono-data text-[10px]">CRITICAL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot bg-warning" />
            <span className="mono-data text-[10px]">HIGH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot bg-warning/60" />
            <span className="mono-data text-[10px]">MEDIUM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot bg-success" />
            <span className="mono-data text-[10px]">LOW</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .zone-label-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #1e3a5f !important;
          font-weight: 800 !important;
          font-size: 10px !important;
          text-shadow: 0 0 3px rgba(255, 255, 255, 0.9), 0 0 5px rgba(255, 255, 255, 0.8) !important;
          pointer-events: none !important;
        }
        .zone-label-tooltip::before {
          display: none !important;
        }
        .leaflet-popup-content-wrapper {
          background-color: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .leaflet-popup-content {
          font-family: system-ui, -apple-system, sans-serif;
          margin: 0 !important;
        }
        .leaflet-popup-close-button {
          color: var(--muted-foreground);
        }
        .leaflet-popup-close-button:hover {
          color: var(--foreground);
        }
      `}</style>
    </div>
  )
}

function buildPopup(zone: ZoneMapData): string {
  const color = HEATMAP_COLORS[zone.heatmapColor] || "#22c55e"
  const threatLevel = getThreatLabel(zone.heatmapColor)
  const deficit = Math.max(0, zone.safeThreshold - zone.currentDeployment)

  return `
    <div style="min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 14px; color: #1e3a5f; border-bottom: 2px solid ${color}; padding-bottom: 6px; margin-bottom: 8px;">
        ${zone.name}
      </div>
      <div style="font-size: 12px; line-height: 1.7; color: #475569;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 600;">Code:</span>
          <span style="font-family: monospace; font-weight: 700;">${zone.code}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 600;">Size Score:</span>
          <span style="font-weight: 700;">${zone.sizeScore}/10</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 600;">Density:</span>
          <span style="font-weight: 700;">${zone.densityScore}/10</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 600;">Deployed:</span>
          <span style="font-weight: 700;">${zone.currentDeployment}/${zone.safeThreshold}</span>
        </div>
        ${deficit > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #ef4444;">
            <span style="font-weight: 600;">Deficit:</span>
            <span style="font-weight: 700;">${deficit}</span>
          </div>
        ` : ""}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; color: white; background: ${color};">
            ${threatLevel}
          </span>
        </div>
      </div>
    </div>
  `
}

function getThreatLabel(color: string): string {
  switch (color) {
    case "red":
      return "CRITICAL"
    case "orange":
      return "HIGH"
    case "yellow":
      return "MEDIUM"
    case "green":
      return "LOW"
    default:
      return "UNKNOWN"
  }
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