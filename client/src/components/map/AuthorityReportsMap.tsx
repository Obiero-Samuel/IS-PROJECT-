/**
 * This file handles authority report map rendering with status-aware markers.
 */
"use client";

import { useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { OfficerQueueItem, ReportLifecycleStatus } from "@/lib/types";

interface AuthorityReportsMapProps {
    reports: OfficerQueueItem[];
    selectedReportId?: number | null;
    compact?: boolean;
    onSelectReport?: (report: OfficerQueueItem) => void;
}

type Point = OfficerQueueItem & {
    _lat: number;
    _lng: number;
};

const statusColor = (status: ReportLifecycleStatus, overdue: boolean) => {
    // Overdue unresolved cases are forced to red for urgency.
    if (overdue && status !== "resolved") return "#dc2626";
    // Non-overdue colors follow normal lifecycle progression.
    if (status === "pending") return "#f59e0b";
    if (status === "in-progress") return "#2563eb";
    return "#16a34a";
};

const createStatusIcon = (status: ReportLifecycleStatus, overdue: boolean, selected = false) => {
    // Marker circle style adapts to both status and selection state.
    const color = statusColor(status, overdue);
    const border = selected ? "3px" : "2px";
    const size = selected ? 22 : 18;

    return L.divIcon({
        className: "",
        html: `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:999px;background:${color};border:${border} solid #ffffff;box-shadow:0 0 0 2px rgba(15,23,42,0.2);"></span>`,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
        popupAnchor: [0, -Math.round(size / 2)],
    });
};

export default function AuthorityReportsMap({
    reports,
    selectedReportId,
    compact = false,
    onSelectReport,
}: AuthorityReportsMapProps) {
    const points = useMemo<Point[]>(() => {
        // Convert possibly mixed string/number lat-lng into clean finite numbers.
        return reports
            .map((report) => {
                const lat = Number(report.latitude);
                const lng = Number(report.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    return null;
                }

                return {
                    ...report,
                    _lat: lat,
                    _lng: lng,
                };
            })
            .filter((item): item is Point => Boolean(item));
    }, [reports]);

    const center = useMemo<LatLngExpression>(() => {
        // Keep the selected report centered when one is chosen.
        const selected = points.find((point) => point.id === selectedReportId);
        if (selected) {
            return [selected._lat, selected._lng];
        }

        // Otherwise center on first available point.
        if (points.length > 0) {
            return [points[0]._lat, points[0]._lng];
        }

        // Final fallback when no valid coordinates exist.
        return [-1.286389, 36.817223];
    }, [points, selectedReportId]);

    if (points.length === 0) {
        return <p className="message">No mapped report coordinates available for this authority scope yet.</p>;
    }

    return (
        <div className={`map-shell ${compact ? "map-shell-320" : "map-shell-500"}`}>
            <MapContainer center={center} zoom={12} className="map-canvas">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {points.map((report) => {
                    // Selected marker is drawn slightly larger.
                    const selected = report.id === selectedReportId;

                    return (
                        <Marker
                            key={report.id}
                            position={[report._lat, report._lng]}
                            icon={createStatusIcon(report.status, Boolean(report.has_overdue_escalation), selected)}
                        >
                            <Popup>
                                <div className="stack popup-min-width">
                                    <strong>{report.title}</strong>
                                    <span className="muted">{report.tracking_number}</span>
                                    <span className="muted">
                                        {report.category_name || "Unknown category"}
                                        {report.ward_name ? ` • ${report.ward_name}` : ""}
                                    </span>
                                    <span className="badge">{report.status}</span>
                                    {report.has_overdue_escalation && (
                                        <span className="message error">
                                            Overdue escalation ({report.days_overdue} day{report.days_overdue === 1 ? "" : "s"})
                                        </span>
                                    )}
                                    {onSelectReport && (
                                        // Parent page can open a details modal from this callback.
                                        <button type="button" className="primary" onClick={() => onSelectReport(report)}>
                                            View / update
                                        </button>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
