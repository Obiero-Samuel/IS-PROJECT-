"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import RequireAuth from "@/components/RequireAuth";
import { apiRequest, loadStoredToken, storeToken } from "@/lib/api";
import styles from "./page.module.css";

type SummaryReport = {
  id: number;
  authority_id: number;
  ward_id: number | null;
  report_period: string;
  period_start: string;
  period_end: string;
  total_issues: number;
  open_issues: number;
  resolved_issues: number;
  pending_issues: number;
  escalated_issues: number;
  avg_resolution_days: number;
  top_category: string | null;
  generated_at: string;
};

export default function AnalyticsPage() {
  const [token, setToken] = useState(() => loadStoredToken());
  const [message, setMessage] = useState("");
  const [reports, setReports] = useState<SummaryReport[]>([]);

  const [authorityId, setAuthorityId] = useState("1");
  const [wardId, setWardId] = useState("");
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");

  const saveToken = () => {
    storeToken(token);
    setMessage("Token saved locally.");
  };

  const generateSummary = async () => {
    if (!authorityId.trim()) {
      setMessage("Authority ID is required.");
      return;
    }

    try {
      await apiRequest<{ report: SummaryReport }>("/summary/generate", {
        method: "POST",
        token,
        body: {
          authority_id: Number(authorityId),
          ward_id: wardId ? Number(wardId) : undefined,
          report_period: reportPeriod,
          period_start: startDate,
          period_end: endDate,
        },
      });
      setMessage("Summary report generated.");
      await loadSummaries();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Generate summary failed.";
      setMessage(msg);
    }
  };

  const loadSummaries = async () => {
    try {
      const query = authorityId ? `?authority_id=${authorityId}` : "";
      const result = await apiRequest<{ reports: SummaryReport[] }>(`/summary${query}`, {
        token,
      });
      setReports(result.reports);
      setMessage("Summary reports loaded.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Load summaries failed.";
      setMessage(msg);
    }
  };

  const totals = useMemo(() => {
    return reports.reduce(
      (acc, item) => {
        acc.total += item.total_issues;
        acc.resolved += item.resolved_issues;
        acc.escalated += item.escalated_issues;
        return acc;
      },
      { total: 0, resolved: 0, escalated: 0 },
    );
  }, [reports]);

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <DashboardShell
        title="Analytics Dashboard"
        subtitle="Generate authority summaries and monitor issue throughput trends."
        token={token}
        onTokenChange={setToken}
        onSaveToken={saveToken}
      >
        <section className={styles.generator}>
          <div className={styles.field}>
            <label htmlFor="authority-id">Authority ID</label>
            <input
              id="authority-id"
              value={authorityId}
              onChange={(event) => setAuthorityId(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="ward-id">Ward ID (optional)</label>
            <input id="ward-id" value={wardId} onChange={(event) => setWardId(event.target.value)} />
          </div>

          <div className={styles.field}>
            <label htmlFor="report-period">Period</label>
            <select
              id="report-period"
              value={reportPeriod}
              onChange={(event) => setReportPeriod(event.target.value)}
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="yearly">yearly</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="start-date">Start date</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="end-date">End date</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className={styles.buttons}>
            <button onClick={generateSummary}>Generate</button>
            <button onClick={loadSummaries}>Load summaries</button>
          </div>
        </section>

        <p className={styles.message}>{message}</p>

        <section className={styles.stats}>
          <article>
            <h3>Total issues</h3>
            <p>{totals.total}</p>
          </article>
          <article>
            <h3>Resolved issues</h3>
            <p>{totals.resolved}</p>
          </article>
          <article>
            <h3>Escalated issues</h3>
            <p>{totals.escalated}</p>
          </article>
        </section>

        <section className={styles.reportGrid}>
          {reports.map((report) => (
            <article key={report.id} className={styles.reportCard}>
              <div className={styles.reportTop}>
                <p>#{report.id}</p>
                <span>{report.report_period}</span>
              </div>
              <h2>{report.top_category || "No dominant category"}</h2>
              <p>
                {report.period_start.slice(0, 10)} to {report.period_end.slice(0, 10)}
              </p>
              <ul>
                <li>Total: {report.total_issues}</li>
                <li>Open: {report.open_issues}</li>
                <li>Pending: {report.pending_issues}</li>
                <li>Resolved: {report.resolved_issues}</li>
                <li>Escalated: {report.escalated_issues}</li>
                <li>Avg resolution days: {Number(report.avg_resolution_days).toFixed(2)}</li>
              </ul>
            </article>
          ))}
        </section>
      </DashboardShell>
    </RequireAuth>
  );
}
