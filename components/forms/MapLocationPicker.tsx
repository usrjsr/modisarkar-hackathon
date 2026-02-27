"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

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

        // Custom red marker icon
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
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Zone Location</p>
                <p className="text-xs text-gray-500 font-mono">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </p>
            </div>
            <div
                ref={containerRef}
                style={{ height: "220px", width: "100%", borderRadius: "8px", border: "2px solid #e2e8f0" }}
            />
            <p className="text-xs text-gray-500 italic">
                Click on the map or drag the marker to set the zone centroid location.
            </p>
        </div>
    )
}
