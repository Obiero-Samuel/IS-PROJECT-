"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { ReportItem } from "@/lib/types";

const markerIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

interface PublicReportsMapProps {
    reports: ReportItem[];
    onUpvote?: (id: number) => void;
}

export default function PublicReportsMap({ reports, onUpvote }: PublicReportsMapProps) {
    const points = reports.filter(
        (report) => report.latitude != null && report.longitude != null
    );

    return (
        <div className="map-shell map-shell-500">
            <MapContainer center={[-1.286389, 36.817223]} zoom={11} className="map-canvas">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {points.map((report) => (
                    <Marker
                        key={report.id}
                        icon={markerIcon}
                        position={[Number(report.latitude), Number(report.longitude)]}
                    >
                        <Popup>
                            <div className="stack popup-min-width">
                                <strong>{report.title}</strong>
                                <span className="muted">{report.category_name}</span>
                                <span className="muted">{report.location_address || "No address"}</span>
                                <span className="badge">{report.status}</span>
                                <span>👍 {report.upvote_count}</span>
                                {onUpvote && (
                                    <button type="button" className="primary" onClick={() => onUpvote(report.id)}>
                                        Upvote
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
