"use client";

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { Zone } from '@/lib/types/dashboard';

// Dynamic imports to prevent SSR "window is not defined" error
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import('react-leaflet').then((mod) => mod.Marker),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);

// Fix for Leaflet default icon not showing in React
// This logic usually goes inside a useEffect or a separate util
const fixLeafletIcon = async () => {
    const L = (await import('leaflet')).default;
    // @ts-expect-error leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
};

export default function DeploymentMap({ zones }: { zones: Zone[] }) {
    useEffect(() => {
        fixLeafletIcon();
    }, []);

    // Default center (placeholder coords)
    const center: [number, number] = [28.61, 77.20];

    return (
        <div className="h-[400px] w-full rounded-lg overflow-hidden border z-0 relative">
            <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {zones.map((zone) => (
                    <Marker
                        key={zone._id}
                        position={[zone.centroid.coordinates[1], zone.centroid.coordinates[0]]}
                    >
                        <Popup>
                            <strong>{zone.name}</strong><br />
                            Force: {zone.currentDeployment}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}