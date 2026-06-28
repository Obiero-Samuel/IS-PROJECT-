"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { apiRequest, loadStoredToken, storeToken } from "@/lib/api";
import styles from "./page.module.css";

type AssignedReport = {
  id: number;
  tracking_number: string;
  title: string;
  status: string;
  created_at: string;
  ward_name: string | null;
};

type AssignedReportsResponse = {
  reports: AssignedReport[];
};

const STATUS_OPTIONS = ["pending", "in-progress", "resolved"] as const;

export default function OfficerPage() {
  const [token, setToken] = useState(() => loadStoredToken());
  const [authorityId, setAuthorityId] = useState("1");
  const [statusFilter, setStatusFilter] = useState("");
  const [reports, setReports] = useState<AssignedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const reportCountLabel = useMemo(() => {
    if (!reports.length) {
      return "No assigned reports";
    }
    return `${reports.length} assigned report${reports.length === 1 ? "" : "s"}`;
  }, [reports.length]);

  const saveToken = () => {
    storeToken(token);
    setFeedback("Token saved locally.");
  };

  const loadReports = async () => {
    setLoading(true);
    setFeedback("");

    try {
      const query = new URLSearchParams({ authority_id: authorityId });
      if (statusFilter) {
        query.set("status", statusFilter);
      }

      const data = await apiRequest<AssignedReportsResponse>(`/authority/reports?${query.toString()}`, {
        token,
      });

      setReports(data.reports);
      setFeedback("Assigned reports loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed loading reports.";
      setFeedback(message);
    } finally {
      setLoading(false);
    }
  };

  const patchStatus = async (reportId: number) => {
    const status = statusDrafts[reportId];
    if (!status) {
      setFeedback("Select a status first.");
      return;
    }

    try {
      await apiRequest(`/authority/reports/${reportId}/status`, {
        method: "PATCH",
        token,
        body: {
          status,
          notes: noteDrafts[reportId] || undefined,
        },
      });
      setFeedback(`Report #${reportId} status updated.`);
      await loadReports();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed updating status.";
      setFeedback(message);
    }
  };

  const submitNote = async (reportId: number) => {
    const notes = (noteDrafts[reportId] || "").trim();
    if (!notes) {
      setFeedback("Enter a note before saving.");
      return;
    }

    try {
      await apiRequest(`/authority/reports/${reportId}/notes`, {
        method: "POST",
        token,
        body: { notes },
      });
      setFeedback(`Note added to report #${reportId}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed adding note.";
      setFeedback(message);
    }
  };

  return (
    <DashboardShell
      title="Officer Dashboard"
      subtitle="Review assigned reports, update issue status, and attach response notes."
      token={token}
      onTokenChange={setToken}
      onSaveToken={saveToken}
    >
      <section className={styles.controls}>
        <div className={styles.field}>
          <label htmlFor="authority-id">Authority ID</label>
          <input
            id="authority-id"
            value={authorityId}
            onChange={(event) => setAuthorityId(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="status-filter">Status filter</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button className={styles.loadButton} onClick={loadReports} disabled={loading}>
          {loading ? "Loading..." : "Load assigned reports"}
        </button>
      </section>

      <p className={styles.feedback}>{feedback || reportCountLabel}</p>

      <section className={styles.grid}>
        {reports.map((report) => (
          <article key={report.id} className={styles.card}>
            <div className={styles.cardTop}>
              <p className={styles.tracking}>{report.tracking_number}</p>
              <span className={styles.status}>{report.status}</span>
            </div>
            <h2>{report.title}</h2>
            <p className={styles.meta}>
              Ward: {report.ward_name || "Unassigned"} | Logged: {new Date(report.created_at).toLocaleString()}
            </p>

            <div className={styles.inlineFields}>
              <select
                value={statusDrafts[report.id] || ""}
                onChange={(event) =>
                  setStatusDrafts((prev) => ({
                    ...prev,
                    [report.id]: event.target.value,
                  }))
                }
              >
                <option value="">Select new status</option>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button onClick={() => patchStatus(report.id)}>Update status</button>
            </div>

            <textarea
              placeholder="Add resolution note"
              value={noteDrafts[report.id] || ""}
              onChange={(event) =>
                setNoteDrafts((prev) => ({
                  ...prev,
                  [report.id]: event.target.value,
                }))
              }
            />
            <button className={styles.noteButton} onClick={() => submitNote(report.id)}>
              Save note
            </button>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
