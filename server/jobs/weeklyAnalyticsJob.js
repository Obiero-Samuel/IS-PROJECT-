const nodemailer = require('nodemailer');
const db = require('../config/db');

const getMailer = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

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

const toDateOnly = (date) => date.toISOString().slice(0, 10);

const getDefaultPeriod = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return {
        periodStart: toDateOnly(start),
        periodEnd: toDateOnly(end),
    };
};

const getRecipients = async () => {
    const configured = String(process.env.ANALYTICS_ALERT_EMAILS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    if (configured.length > 0) {
        return configured;
    }

    const result = await db.query(
        `SELECT DISTINCT email
     FROM users
     WHERE role = 'admin' AND email IS NOT NULL AND email <> ''
     ORDER BY email`
    );

    return result.rows.map((row) => row.email);
};

const sendWeeklySummaryEmail = async ({ analytics, periodStart, periodEnd, overdueEscalations }) => {
    const transporter = getMailer();
    if (!transporter) return;

    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    const responseRate = Number(analytics.response_rate_pct || 0).toFixed(2);

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
    const actor = ['system', 'admin', 'officer'].includes(triggeredBy) ? triggeredBy : 'system';
    const { periodStart, periodEnd } = getDefaultPeriod();

    const sessionRes = await db.query(
        `INSERT INTO sessions (trigger_name, triggered_by, triggered_by_user_id, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
        ['weekly-analytics', actor, triggeredByUserId]
    );

    const sessionId = sessionRes.rows[0].id;

    try {
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

        const overdueRes = await db.query(
            `SELECT COUNT(*)::int AS overdue_escalations
       FROM escalations
       WHERE is_overdue = TRUE AND status = 'pending'`
        );

        const totalReports = Number(metricsRes.rows[0].total_reports || 0);
        const resolvedReports = Number(metricsRes.rows[0].resolved_reports || 0);
        const pendingReports = Number(metricsRes.rows[0].pending_reports || 0);
        const inProgressReports = Number(metricsRes.rows[0].in_progress_reports || 0);
        const overdueEscalations = Number(overdueRes.rows[0].overdue_escalations || 0);
        const responseRate = totalReports > 0 ? Number(((resolvedReports / totalReports) * 100).toFixed(2)) : 0;

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

        await db.query(
            `UPDATE sessions
       SET status = 'completed', ended_at = NOW(), records_processed = $1
       WHERE id = $2`,
            [totalReports, sessionId]
        );

        await sendWeeklySummaryEmail({
            analytics: analyticsRes.rows[0],
            periodStart,
            periodEnd,
            overdueEscalations,
        });

        return {
            sessionId,
            analytics: analyticsRes.rows[0],
            periodStart,
            periodEnd,
        };
    } catch (error) {
        await db.query(
            `UPDATE sessions
       SET status = 'failed', ended_at = NOW(), error_message = $1
       WHERE id = $2`,
            [error.message, sessionId]
        );
        throw error;
    }
};

module.exports = {
    runWeeklyAnalytics,
};
