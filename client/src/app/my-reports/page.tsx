/**
 * This file handles the authenticated user's submitted reports list.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import RequireAuth from "@/components/RequireAuth";
import { deleteMyReport, getMyReports, toPublicAssetUrl } from "@/lib/api";
import type { ReportItem } from "@/lib/types";
import styles from "./page.module.css";

type ReportStatusTone = "resolved" | "active" | "attention";

const getStatusTone = (status: ReportItem["status"]): ReportStatusTone => {
    // Keep badge tone mapping resilient to slight status formatting differences.
    const normalized = status.toLowerCase();

    if (normalized === "resolved") {
        return "resolved";
    }

    if (normalized === "in-progress" || normalized === "in progress") {
        return "active";
    }

    return "attention";
};

export default function MyReportsPage() {
    // Basic async/page feedback states.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
    // User-owned reports collection.
    const [reports, setReports] = useState<ReportItem[]>([]);

    useEffect(() => {
        const run = async () => {
            try {
                const data = await getMyReports();
                setReports(data.reports);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load reports.");
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, []);

    const handleDeleteReport = async (report: ReportItem) => {
        const confirmed = window.confirm(
            `Delete report \"${report.title}\"? This action can only be done once for this report.`
        );

        if (!confirmed) {
            return;
        }

        setError(null);
        setSuccess(null);
        setDeletingReportId(report.id);

        try {
            const result = await deleteMyReport(report.id);
            setReports((current) => current.filter((item) => item.id !== report.id));
            setSuccess(result.message);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete report.");
        } finally {
            setDeletingReportId(null);
        }
    };

    // Resident summary cards shown above report list.
    const summary = useMemo(() => {
        let pending = 0;
        let inProgress = 0;
        let resolved = 0;
        let upvotes = 0;

        for (const report of reports) {
            upvotes += report.upvote_count;

            if (report.status === "resolved") {
                resolved += 1;
            } else if (report.status === "in-progress") {
                inProgress += 1;
            } else {
                pending += 1;
            }
        }

        return {
            total: reports.length,
            pending,
            inProgress,
            resolved,
            upvotes,
        };
    }, [reports]);

    return (
        <RequireAuth>
            <NavBar />
            <main className="main">
                <div className={`container ${styles.layout}`}>
                    <section className={styles.hero}>
                        <div className={styles.heroContent}>
                            <p className={styles.badge}>RESIDENT REPORTS</p>
                            <h1 className={styles.heroTitle}>My reports</h1>
                            <p className={styles.heroLead}>
                                Track every issue you have submitted, monitor status changes, and keep
                                momentum on community priorities.
                            </p>
                        </div>
                        <div className={styles.heroActions}>
                            <Link href="/reports/new" className="primary">Submit another report</Link>
                            <Link href="/reports" className="ghost">Browse public reports</Link>
                        </div>
                    </section>

                    {loading && <p className="message">Loading your reports...</p>}
                    {error && <p className="message error">{error}</p>}
                    {success && <p className="message success">{success}</p>}

                    {!loading && !error && reports.length > 0 && (
                        <section className={styles.metricsGrid}>
                            <article className={styles.metricCard}>
                                <p className={styles.metricLabel}>Total reports</p>
                                <p className={styles.metricValue}>{summary.total}</p>
                                <p className={styles.metricHint}>submitted by you</p>
                            </article>

                            <article className={styles.metricCard}>
                                <p className={styles.metricLabel}>Pending</p>
                                <p className={styles.metricValue}>{summary.pending}</p>
                                <p className={styles.metricHint}>awaiting progression</p>
                            </article>

                            <article className={styles.metricCard}>
                                <p className={styles.metricLabel}>In progress</p>
                                <p className={styles.metricValue}>{summary.inProgress}</p>
                                <p className={styles.metricHint}>currently being handled</p>
                            </article>

                            <article className={styles.metricCard}>
                                <p className={styles.metricLabel}>Resolved</p>
                                <p className={styles.metricValue}>{summary.resolved}</p>
                                <p className={styles.metricHint}>successfully closed</p>
                            </article>

                            <article className={styles.metricCard}>
                                <p className={styles.metricLabel}>Total upvotes</p>
                                <p className={styles.metricValue}>{summary.upvotes}</p>
                                <p className={styles.metricHint}>community support received</p>
                            </article>
                        </section>
                    )}

                    {!loading && !error && reports.length === 0 && (
                        <section className={styles.emptyCard}>
                            {/* Friendly empty state for first-time users. */}
                            <h2>No reports yet</h2>
                            <p className="muted">Start by submitting your first issue and get a tracking number.</p>
                            <Link href="/reports/new" className="primary">Submit your first report</Link>
                        </section>
                    )}

                    <section className={styles.reportsGrid}>
                        {reports.map((report) => {
                            // Per-report card with status, metadata, and optional image.
                            const reportImageUrl = report.media_url ? toPublicAssetUrl(report.media_url) : null;
                            const statusTone = getStatusTone(report.status);
                            const statusToneClass =
                                statusTone === "resolved"
                                    ? styles.statusResolved
                                    : statusTone === "active"
                                        ? styles.statusActive
                                        : styles.statusAttention;

                            return (
                                <article key={report.id} className={styles.reportCard}>
                                    <header className={styles.reportHeader}>
                                        <h2 className={styles.reportTitle}>{report.title}</h2>
                                        <span className={`${styles.statusPill} ${statusToneClass}`}>
                                            {report.status}
                                        </span>
                                    </header>

                                    <p className={styles.reportDescription}>{report.description}</p>

                                    <div className={styles.metaRow}>
                                        <span className={styles.metaChip}>
                                            Tracking: <strong>{report.tracking_number}</strong>
                                        </span>
                                        <span className={styles.metaChip}>
                                            Category: <strong>{report.category_name}</strong>
                                        </span>
                                    </div>

                                    <div className={styles.metaRow}>
                                        <span className={styles.metaChip}>
                                            Upvotes: <strong>👍 {report.upvote_count}</strong>
                                        </span>
                                        <span className={styles.metaChip}>
                                            Created: <strong>{new Date(report.created_at).toLocaleDateString()}</strong>
                                        </span>
                                    </div>

                                    {reportImageUrl && (
                                        <div className={styles.mediaFrame}>
                                            <Image
                                                src={reportImageUrl}
                                                alt={report.title}
                                                className={`report-image ${styles.reportImage}`}
                                                width={1200}
                                                height={680}
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                                unoptimized
                                            />
                                        </div>
                                    )}

                                    <div className={styles.cardActions}>
                                        <button
                                            type="button"
                                            className={styles.deleteButton}
                                            onClick={() => handleDeleteReport(report)}
                                            disabled={deletingReportId === report.id}
                                        >
                                            {deletingReportId === report.id ? "Deleting..." : "Delete report"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                </div>
            </main>
        </RequireAuth>
    );
}
