/**
 * Officer dashboard: queue, alerts, map, and case actions.
 */
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import RequireAuth from "@/components/RequireAuth";
import {
  addOfficerQueueNote,
  getOfficerEscalations,
  getOfficerQueue,
  toPublicAssetUrl,
  updateOfficerQueueStatus,
} from "@/lib/api";
import { authFromSnapshot, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";
import type {
  OfficerEscalationItem,
  OfficerQueueItem,
  ReportLifecycleStatus,
} from "@/lib/types";
import { useSyncExternalStore } from "react";
import styles from "./page.module.css";

// Leaflet map is loaded client-side only (no SSR) to avoid window/document issues.
const AuthorityReportsMap = dynamic(() => import("@/components/map/AuthorityReportsMap"), {
  ssr: false,
});

// Allowed lifecycle options the officer can set.
const STATUS_OPTIONS: ReportLifecycleStatus[] = ["pending", "in-progress", "resolved"];
// Dashboard supports table queue view and spatial map view.
type OfficerTab = "queue" | "map";
// Fixed timestamp keeps "resolved this week" stable per render.
const DASHBOARD_SNAPSHOT_NOW_MS = Date.now();

export default function OfficerPage() {
  // Read currently authenticated user details from shared auth store.
  const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
  const auth = authFromSnapshot(authRaw);

  // Core dashboard controls + filter inputs.
  const [activeTab, setActiveTab] = useState<OfficerTab>("queue");
  const [statusFilter, setStatusFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  // Loaded data collections.
  const [reports, setReports] = useState<OfficerQueueItem[]>([]);
  const [escalations, setEscalations] = useState<OfficerEscalationItem[]>([]);
  // Async/action feedback states.
  const [loading, setLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [feedback, setFeedback] = useState("");
  // Modal + per-report draft states.
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<number, ReportLifecycleStatus>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  // Currently focused report for modal details panel.
  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  const summary = useMemo(() => {
    const pendingCount = reports.filter((item) => item.status === "pending").length;
    const inProgressCount = reports.filter((item) => item.status === "in-progress").length;

    const days7 = 7 * 24 * 60 * 60 * 1000;
    const resolvedThisWeek = reports.filter(
      (item) =>
        item.status === "resolved" &&
        DASHBOARD_SNAPSHOT_NOW_MS - new Date(item.updated_at).getTime() <= days7
    ).length;

    // Header KPI values.
    return {
      totalAssigned: reports.length,
      pendingCount,
      inProgressCount,
      resolvedThisWeek,
      overdueEscalations: escalations.filter((item) => item.is_overdue).length,
    };
  }, [escalations, reports]);

  const escalationAlerts = useMemo(() => {
    // Prioritize overdue alerts, then newest pending.
    return escalations
      .filter((item) => item.is_overdue || item.status === "pending")
      .sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) {
          return a.is_overdue ? -1 : 1;
        }
        return new Date(b.escalated_at).getTime() - new Date(a.escalated_at).getTime();
      })
      .slice(0, 8);
  }, [escalations]);

  const availableWards = useMemo(() => {
    // Build ward filter options from current queue data.
    const wardMap = new Map<number, string>();
    reports.forEach((item) => {
      if (item.ward_id && item.ward_name) {
        wardMap.set(item.ward_id, item.ward_name);
      }
    });
    return Array.from(wardMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const reportCountLabel = useMemo(() => {
    if (reports.length === 0) {
      return "No reports found in your current authority queue filters.";
    }
    // Friendly grammar for singular vs plural count.
    return `${reports.length} report${reports.length === 1 ? "" : "s"} loaded in your authority queue.`;
  }, [reports.length]);

  const loadDashboardData = async () => {
    setLoading(true);
    setFeedback("");

    try {
      // Refresh queue and escalations together.
      const [queueData, escalationsData] = await Promise.all([
        getOfficerQueue({
          status: statusFilter || undefined,
          ward_id: wardFilter ? Number(wardFilter) : undefined,
          from_date: fromDateFilter || undefined,
          to_date: toDateFilter || undefined,
        }),
        getOfficerEscalations(),
      ]);

      setReports(queueData.reports);
      setEscalations(escalationsData.escalations);
      setFeedback("Officer queue and escalation alerts refreshed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed loading reports.";
      setFeedback(message);
    } finally {
      setLoading(false);
    }
  };

  const patchStatus = async (reportId: number) => {
    // Use per-report draft status selected in modal.
    const status = statusDrafts[reportId];
    if (!status) {
      setFeedback("Select a status first.");
      return;
    }

    const note = (noteDrafts[reportId] || "").trim();
    // Resolving requires a note for audit trail.
    if (status === "resolved" && !note) {
      setFeedback("Resolution note is required when setting a report to resolved.");
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await updateOfficerQueueStatus(reportId, {
        status,
        notes: note || undefined,
      });
      // Reload ensures table/map/modals all reflect latest backend truth.
      setFeedback(`Report #${reportId} status updated.`);
      await loadDashboardData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed updating status.";
      setFeedback(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const submitNote = async (reportId: number) => {
    // Use per-report note draft entered in modal text area.
    const notes = (noteDrafts[reportId] || "").trim();
    if (!notes) {
      setFeedback("Enter a note before saving.");
      return;
    }

    // Save note even when status stays the same.
    setIsSavingNote(true);
    try {
      await addOfficerQueueNote(reportId, notes);
      setFeedback(`Note added to report #${reportId}.`);
      await loadDashboardData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed adding note.";
      setFeedback(message);
    } finally {
      setIsSavingNote(false);
    }
  };

  const closeModal = () => setSelectedReportId(null);

  const openReportModal = (report: OfficerQueueItem) => {
    // Selecting report ID opens detailed modal for that specific row.
    setSelectedReportId(report.id);
  };

  const statusClass = (report: OfficerQueueItem) => {
    // Highlight overdue unresolved cases for triage.
    if (report.has_overdue_escalation && report.status !== "resolved") {
      return styles.statusOverdue;
    }
    if (report.status === "pending") return styles.statusPending;
    if (report.status === "in-progress") return styles.statusInProgress;
    return styles.statusResolved;
  };

  const selectedMediaUrl = toPublicAssetUrl(selectedReport?.media_url || null);

  return (
    <RequireAuth allowedRoles={["authority", "admin"]}>
      {/* Shared shell gives consistent header + navigation. */}
      <DashboardShell
        title="Officer Case Queue"
        subtitle="Monitor authority-scoped cases, prioritize overdue escalations, update statuses, and resolve reports with audited notes."
        showEyebrow={false}
      >
        {/* Identity header confirms current officer and mapped authority scope. */}
        <section className={styles.headerIdentity}>
          <div>
            <p className={styles.identityLabel}>Officer</p>
            <h2>{auth?.user?.username || "Authority Officer"}</h2>
            <p className={styles.identityMeta}>
              Authority ID: {auth?.user?.authority_id ?? "Not mapped"}
            </p>
          </div>
          <button
            className={styles.refreshButton}
            onClick={loadDashboardData}
            disabled={loading}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh queue"}
          </button>
        </section>

        {/* KPI cards summarize current filtered workload. */}
        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Total assigned</p>
            <p className={styles.statValue}>{summary.totalAssigned}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Pending</p>
            <p className={styles.statValue}>{summary.pendingCount}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>In progress</p>
            <p className={styles.statValue}>{summary.inProgressCount}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Resolved this week</p>
            <p className={styles.statValue}>{summary.resolvedThisWeek}</p>
          </article>
        </section>

        {/* Filter controls shape the queue dataset loaded from backend. */}
        <section className={styles.controls}>
          <div className={styles.field}>
            <label htmlFor="status-filter">Status filter</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="ward-filter">Ward filter</label>
            <select
              id="ward-filter"
              value={wardFilter}
              onChange={(event) => setWardFilter(event.target.value)}
            >
              <option value="">All wards</option>
              {availableWards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="from-date">From date</label>
            <input
              id="from-date"
              type="date"
              value={fromDateFilter}
              onChange={(event) => setFromDateFilter(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="to-date">To date</label>
            <input
              id="to-date"
              type="date"
              value={toDateFilter}
              onChange={(event) => setToDateFilter(event.target.value)}
            />
          </div>

          <button className={styles.loadButton} onClick={loadDashboardData} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </button>
        </section>

        {/* Feedback + tab switch controls. */}
        <div className={styles.feedbackWrap}>
          <p className={styles.feedback}>{feedback || reportCountLabel}</p>
          <div className={styles.tabSwitch}>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === "queue" ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab("queue")}
            >
              Queue view
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === "map" ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab("map")}
            >
              Map view
            </button>
          </div>
        </div>

        {/* Escalation panel highlights urgent and pending items. */}
        <section className={styles.alertPanel}>
          <h3>Escalation alerts {summary.overdueEscalations > 0 ? `(${summary.overdueEscalations} overdue)` : ""}</h3>
          {escalationAlerts.length === 0 ? (
            <p className={styles.alertEmpty}>No active escalation alerts for your authority queue.</p>
          ) : (
            <ul className={styles.alertList}>
              {escalationAlerts.map((item) => (
                <li key={item.id} className={item.is_overdue ? styles.alertOverdue : styles.alertPending}>
                  <div>
                    <strong>{item.tracking_number}</strong>
                    <p>
                      {item.title} · {item.category_name || "Uncategorized"}
                      {item.ward_name ? ` · ${item.ward_name}` : ""}
                    </p>
                  </div>
                  <span>
                    {item.is_overdue
                      ? `${item.days_overdue} day${item.days_overdue === 1 ? "" : "s"} overdue`
                      : "Pending response"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {activeTab === "queue" ? (
          // Queue tab shows table-based operational workflow.
          <section className={styles.tableSection}>
            {reports.length === 0 ? (
              <p className={styles.emptyState}>No queue records available. Apply filters and refresh.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tracking no.</th>
                      <th>Category</th>
                      <th>Ward</th>
                      <th>Reported on</th>
                      <th>Days open</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id}>
                        <td>{report.tracking_number}</td>
                        <td>{report.category_name || "Unknown"}</td>
                        <td>{report.ward_name || "Unassigned"}</td>
                        <td>{new Date(report.created_at).toLocaleString()}</td>
                        <td>
                          {report.days_open}
                          {report.has_overdue_escalation && report.status !== "resolved" ? (
                            <span className={styles.inlineDanger}> · Overdue</span>
                          ) : null}
                        </td>
                        <td>
                          <span className={`${styles.statusPill} ${statusClass(report)}`}>{report.status}</span>
                        </td>
                        <td>
                          <button
                            className={styles.viewButton}
                            type="button"
                            onClick={() => openReportModal(report)}
                          >
                            View / Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          // Map tab shows geospatial case distribution for this scope.
          <section className={styles.mapSection}>
            <AuthorityReportsMap
              reports={reports}
              selectedReportId={selectedReportId ?? reports[0]?.id ?? null}
              onSelectReport={openReportModal}
            />
          </section>
        )}

        {selectedReport && (
          // Modal shows full case context and status/note actions.
          <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Report details">
            <div className={styles.modalCard}>
              <header className={styles.modalHeader}>
                <div>
                  <p className={styles.modalTracking}>{selectedReport.tracking_number}</p>
                  <h3>{selectedReport.title}</h3>
                </div>
                <button type="button" className={styles.closeButton} onClick={closeModal}>
                  ×
                </button>
              </header>

              <p className={styles.modalMeta}>
                {selectedReport.category_name || "Uncategorized"}
                {selectedReport.ward_name ? ` · ${selectedReport.ward_name}` : ""}
                {` · Reported ${new Date(selectedReport.created_at).toLocaleString()}`}
              </p>

              <p className={styles.description}>{selectedReport.description}</p>

              <div className={styles.modalMediaGrid}>
                <div className={styles.mediaPane}>
                  <h4>Photo evidence</h4>
                  {selectedMediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedMediaUrl} alt="Issue evidence" className={styles.reportImage} />
                  ) : (
                    <p className={styles.emptyState}>No media attached to this report.</p>
                  )}
                </div>

                <div className={styles.mediaPane}>
                  <h4>Location map</h4>
                  {/* Compact map keeps modal layout tight while still showing location context. */}
                  <AuthorityReportsMap reports={[selectedReport]} selectedReportId={selectedReport.id} compact />
                  <p className={styles.locationText}>{selectedReport.location_address || "No location address provided."}</p>
                </div>
              </div>

              <div className={styles.formRow}>
                <label>
                  Update status
                  <select
                    value={statusDrafts[selectedReport.id] || ""}
                    onChange={(event) =>
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [selectedReport.id]: event.target.value as ReportLifecycleStatus,
                      }))
                    }
                  >
                    <option value="">Select status</option>
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => patchStatus(selectedReport.id)}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? "Updating..." : "Apply status"}
                </button>
              </div>

              <label className={styles.noteLabel}>
                Resolution / status note
                <textarea
                  placeholder="Add notes for audit trail and escalation context..."
                  value={noteDrafts[selectedReport.id] || ""}
                  onChange={(event) =>
                    setNoteDrafts((prev) => ({
                      ...prev,
                      [selectedReport.id]: event.target.value,
                    }))
                  }
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => submitNote(selectedReport.id)}
                  disabled={isSavingNote}
                >
                  {isSavingNote ? "Saving..." : "Save note"}
                </button>
                <button type="button" className={styles.closeModalButton} onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
    </RequireAuth>
  );
}
