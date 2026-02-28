"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin } from "lucide-react"

interface MapLocationPickerProps {
  latitude: number
  longitude: number
  onChange: (lat: number, lng: number) => void
}

export default function MapLocationPicker({ latitude, longitude, onChange }: MapLocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ lat: latitude, lng: longitude })

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map)

    const redIcon = L.divIcon({
      className: "",
      html: `<div style="width:24px;height:24px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    const marker = L.marker([latitude, longitude], {
      icon: redIcon,
      draggable: true,
    }).addTo(map)

    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      setCoords({ lat: pos.lat, lng: pos.lng })
      onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)))
    })

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
      onChange(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)))
    })

    markerRef.current = marker
    mapRef.current = map

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [latitude, longitude, onChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="mono-data text-[10px] uppercase tracking-widest">Zone Location</span>
        </div>
        <span className="font-mono text-xs text-foreground font-bold">
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          height: "220px",
          width: "100%",
          borderRadius: "6px",
          border: "1px solid var(--border)",
        }}
      />
      <p className="mono-data text-[10px] text-muted-foreground leading-relaxed">
        Click on the map or drag the marker to set the zone centroid location.
      </p>
    </div>
  )
}