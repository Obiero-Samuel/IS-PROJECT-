/**
 * This file handles the ward map view with report markers and upvote actions.
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import RequireAuth from "@/components/RequireAuth";
import { getPublicReports, toggleUpvote } from "@/lib/api";
import type { ReportItem } from "@/lib/types";

const PublicReportsMap = dynamic(() => import("@/components/map/PublicReportsMap"), {
    ssr: false,
});

export default function WardMapPage() {
    // Async load/error states for map data.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Reports array is passed into map markers.
    const [reports, setReports] = useState<ReportItem[]>([]);

    useEffect(() => {
        const run = async () => {
            try {
                const data = await getPublicReports({ page: 1, limit: 100 });
                setReports(data.reports);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load map data.");
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, []);

    const handleUpvote = async (reportId: number) => {
        setError(null);

        try {
            const result = await toggleUpvote(reportId);
            // Keep local marker popup counts in sync with server result.
            setReports((current) =>
                current.map((report) =>
                    report.id === reportId ? { ...report, upvote_count: result.upvote_count } : report
                )
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update upvote.");
        }
    };

    return (
        <RequireAuth>
            <NavBar />
            <main className="main">
                <div className="container stack">
                    <section className="card stack">
                        <h1 className="title">Public ward map view</h1>
                        <p className="subtitle">See issue locations and open each marker for status and upvote actions.</p>
                        <div className="row">
                            <Link href="/reports" className="ghost">Back to report list</Link>
                            <Link href="/reports/new" className="primary">Submit report</Link>
                        </div>
                    </section>

                    {error && <p className="message error">{error}</p>}
                    {loading && <p className="message">Loading map data...</p>}

                    {/* Map renders once report data has loaded. */}
                    {!loading && <PublicReportsMap reports={reports} onUpvote={handleUpvote} />}
                </div>
            </main>
        </RequireAuth>
    );
}
