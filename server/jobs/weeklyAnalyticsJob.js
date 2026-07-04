/**
 * This file handles weekly analytics generation and optional summary email sending.
 */
// Nodemailer sends summary emails when SMTP is configured.
const nodemailer = require('nodemailer');
// DB client for sessions/analytics/report metrics queries.
const db = require('../config/db');

const getMailer = () => {
    // Read SMTP values from environment.
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    // If any required SMTP setting is missing, disable email sending.
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

    // Build and return configured SMTP transporter.
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: parseInt(SMTP_PORT, 10) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
};

// Convert Date object to YYYY-MM-DD format.
const toDateOnly = (date) => date.toISOString().slice(0, 10);

const getDefaultPeriod = () => {
    // End date is today.
    const end = new Date();
    // Start date is 6 days earlier (7-day window total).
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    // Return both dates in DB-friendly date-only format.
    return {
        periodStart: toDateOnly(start),
        periodEnd: toDateOnly(end),
    };
};

const getRecipients = async () => {
    // First priority: comma-separated emails from env config.
    const configured = String(process.env.ANALYTICS_ALERT_EMAILS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    // Use configured list when present.
    if (configured.length > 0) {
        return configured;
    }

    // Fallback: all admin emails from users table.
    const result = await db.query(
        `SELECT DISTINCT email
     FROM users
     WHERE role = 'admin' AND email IS NOT NULL AND email <> ''
     ORDER BY email`
    );

    // Return plain email string list.
    return result.rows.map((row) => row.email);
};

const sendWeeklySummaryEmail = async ({ analytics, periodStart, periodEnd, overdueEscalations }) => {
    // Build transporter (or disable if SMTP missing).
    const transporter = getMailer();
    if (!transporter) return;

    // Resolve recipient list from env or admin users.
    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    // Format response rate for human-readable email text.
    const responseRate = Number(analytics.response_rate_pct || 0).toFixed(2);

    // Send one summary email to all recipients.
    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: recipients.join(', '),
        subject: `IS PROJECT Weekly Analytics (${periodStart} to ${periodEnd})`,
        text: [
            `Weekly analytics snapshot for ${periodStart} to ${periodEnd}`,
            `Total reports: ${analytics.total_reports}`,
            `Resolved reports: ${analytics.resolved_reports}`,
            `Pending reports: ${analytics.pending_reports}`,
            `In-progress reports: ${analytics.in_progress_reports}`,
            `Response rate: ${responseRate}%`,
            `Overdue escalations: ${overdueEscalations}`,
        ].join('\n'),
    });
};

const runWeeklyAnalytics = async ({ triggeredBy = 'system', triggeredByUserId = null } = {}) => {
    // Keep only known trigger labels.
    const actor = ['system', 'admin', 'officer'].includes(triggeredBy) ? triggeredBy : 'system';
    // Determine reporting period.
    const { periodStart, periodEnd } = getDefaultPeriod();

    // Start automation session row (status: running).
    const sessionRes = await db.query(
        `INSERT INTO sessions (trigger_name, triggered_by, triggered_by_user_id, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
        ['weekly-analytics', actor, triggeredByUserId]
    );

    const sessionId = sessionRes.rows[0].id;

    try {
        // Query report counts by status for this date range.
        const metricsRes = await db.query(
            `SELECT
         COUNT(*)::int AS total_reports,
         COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_reports,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_reports,
         COUNT(*) FILTER (WHERE status = 'in-progress')::int AS in_progress_reports
       FROM reports
       WHERE created_at::date BETWEEN $1::date AND $2::date`,
            [periodStart, periodEnd]
        );

        // Query currently overdue pending escalations.
        const overdueRes = await db.query(
            `SELECT COUNT(*)::int AS overdue_escalations
       FROM escalations
       WHERE is_overdue = TRUE AND status = 'pending'`
        );

        // Normalize metric values from SQL rows.
        const totalReports = Number(metricsRes.rows[0].total_reports || 0);
        const resolvedReports = Number(metricsRes.rows[0].resolved_reports || 0);
        const pendingReports = Number(metricsRes.rows[0].pending_reports || 0);
        const inProgressReports = Number(metricsRes.rows[0].in_progress_reports || 0);
        const overdueEscalations = Number(overdueRes.rows[0].overdue_escalations || 0);
        // Compute response rate percentage.
        const responseRate = totalReports > 0 ? Number(((resolvedReports / totalReports) * 100).toFixed(2)) : 0;

        // Upsert analytics snapshot for this weekly period.
        const analyticsRes = await db.query(
            `INSERT INTO analytics (
         period_start,
         period_end,
         total_reports,
         resolved_reports,
         pending_reports,
         in_progress_reports,
         overdue_escalations,
         response_rate_pct,
         generated_session_id,
         generated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (period_start, period_end)
       DO UPDATE SET
         total_reports = EXCLUDED.total_reports,
         resolved_reports = EXCLUDED.resolved_reports,
         pending_reports = EXCLUDED.pending_reports,
         in_progress_reports = EXCLUDED.in_progress_reports,
         overdue_escalations = EXCLUDED.overdue_escalations,
         response_rate_pct = EXCLUDED.response_rate_pct,
         generated_session_id = EXCLUDED.generated_session_id,
         generated_at = NOW()
       RETURNING *`,
            [
                periodStart,
                periodEnd,
                totalReports,
                resolvedReports,
                pendingReports,
                inProgressReports,
                overdueEscalations,
                responseRate,
                sessionId,
            ]
        );

        // Mark session completed and store processed count.
        await db.query(
            `UPDATE sessions
       SET status = 'completed', ended_at = NOW(), records_processed = $1
       WHERE id = $2`,
            [totalReports, sessionId]
        );

        // Optionally send weekly summary email.
        await sendWeeklySummaryEmail({
            analytics: analyticsRes.rows[0],
            periodStart,
            periodEnd,
            overdueEscalations,
        });

        // Return output payload to caller endpoints/jobs.
        return {
            sessionId,
            analytics: analyticsRes.rows[0],
            periodStart,
            periodEnd,
        };
    } catch (error) {
        // Mark session as failed before rethrowing.
        await db.query(
            `UPDATE sessions
       SET status = 'failed', ended_at = NOW(), error_message = $1
       WHERE id = $2`,
            [error.message, sessionId]
        );
        // Bubble up error to caller.
        throw error;
    }
};

module.exports = {
    runWeeklyAnalytics,
};
