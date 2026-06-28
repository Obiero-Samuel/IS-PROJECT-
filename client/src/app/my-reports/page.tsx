"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getMyReports, toPublicAssetUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ReportItem } from "@/lib/types";

export default function MyReportsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reports, setReports] = useState<ReportItem[]>([]);

    useEffect(() => {
        const run = async () => {
            const token = getToken();

            if (!token) {
                setError("You need to login first to view your reports.");
                setLoading(false);
                return;
            }

            try {
                const data = await getMyReports(token);
                setReports(data.reports);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load reports.");
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, []);

    return (
        <>
            <NavBar />
            <main className="main">
                <div className="container stack">
                    <section className="card stack">
                        <h1 className="title">My reports</h1>
                        <p className="subtitle">Track all issues you have submitted.</p>
                        <div className="row">
                            <Link href="/reports/new" className="primary">Submit another report</Link>
                            <Link href="/reports" className="ghost">Browse public reports</Link>
                        </div>
                    </section>

                    {loading && <p className="message">Loading your reports...</p>}
                    {error && <p className="message error">{error}</p>}

                    {!loading && !error && reports.length === 0 && (
                        <section className="card">
                            <p className="muted">No reports yet. Start by submitting one.</p>
                        </section>
                    )}

                    <section className="grid two">
                        {reports.map((report) => (
                            <article key={report.id} className="card stack">
                                <div className="row">
                                    <strong>{report.title}</strong>
                                    <span className="badge">{report.status}</span>
                                </div>
                                <p className="muted">Tracking: {report.tracking_number}</p>
                                <p>{report.description}</p>
                                <p className="muted">Category: {report.category_name}</p>
                                <p className="muted">👍 {report.upvote_count}</p>
                                {report.media_url && (
                                    <img
                                        src={toPublicAssetUrl(report.media_url) ?? undefined}
                                        alt={report.title}
                                        className="report-image"
                                    />
                                )}
                            </article>
                        ))}
                    </section>
                </div>
            </main>
        </>
    );
}
