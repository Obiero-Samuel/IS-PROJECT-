/**
 * This file handles map-based coordinate picking for new reports.
 */
"use client";

import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";

const markerIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

interface PickerProps {
    latitude?: number | null;
    longitude?: number | null;
    onPick: (lat: number, lng: number) => void;
}

function PickerEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    // Register click listener on the map and send clicked coordinates upstream.
    useMapEvents({
        click: (event) => {
            onPick(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

export default function LeafletMapPicker({ latitude, longitude, onPick }: PickerProps) {
    // If user already picked a point, center there; otherwise use default Nairobi center.
    const center = useMemo<LatLngExpression>(
        () => [latitude ?? -1.286389, longitude ?? 36.817223],
        [latitude, longitude]
    );

    return (
        <div className="map-shell map-shell-320">
            <MapContainer center={center} zoom={13} className="map-canvas">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* This invisible helper attaches the click behavior above. */}
                <PickerEvents onPick={onPick} />
                {latitude != null && longitude != null && (
                    // Show marker only after user has selected coordinates.
                    <Marker position={[latitude, longitude]} icon={markerIcon} />
                )}
            </MapContainer>
        </div>
    );
}
