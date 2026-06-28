"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getPublicReports, toPublicAssetUrl, toggleUpvote } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ReportItem } from "@/lib/types";

export default function PublicReportsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [upvotingId, setUpvotingId] = useState<number | null>(null);

    useEffect(() => {
        const run = async () => {
            try {
                const data = await getPublicReports({ page: 1, limit: 60 });
                setReports(data.reports);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load reports.");
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, []);

    const handleUpvote = async (reportId: number) => {
        const token = getToken();
        if (!token) {
            setError("Please login to upvote reports.");
            return;
        }

        setError(null);
        setUpvotingId(reportId);

        try {
            const result = await toggleUpvote(token, reportId);
            setReports((current) =>
                current.map((report) =>
                    report.id === reportId ? { ...report, upvote_count: result.upvote_count } : report
                )
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upvote report.");
        } finally {
            setUpvotingId(null);
        }
    };

    return (
        <>
            <NavBar />
            <main className="main">
                <div className="container stack">
                    <section className="card stack">
                        <h1 className="title">Public reports</h1>
                        <p className="subtitle">Browse community-submitted issues and vote for what matters most.</p>
                        <div className="row">
                            <Link href="/ward-map" className="ghost">Open map view</Link>
                            <Link href="/reports/new" className="primary">Submit issue</Link>
                        </div>
                    </section>

                    {error && <p className="message error">{error}</p>}
                    {loading && <p className="message">Loading reports...</p>}

                    {!loading && (
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
                                    <p className="muted">Location: {report.location_address || "Not provided"}</p>

                                    {report.media_url && (
                                        <img
                                            src={toPublicAssetUrl(report.media_url) ?? undefined}
                                            alt={report.title}
                                            className="report-image"
                                        />
                                    )}

                                    <div className="row">
                                        <span>👍 {report.upvote_count}</span>
                                        <button
                                            type="button"
                                            className="primary"
                                            onClick={() => handleUpvote(report.id)}
                                            disabled={upvotingId === report.id}
                                        >
                                            {upvotingId === report.id ? "Saving..." : "Upvote"}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </section>
                    )}
                </div>
            </main>
        </>
    );
}
