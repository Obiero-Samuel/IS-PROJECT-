/**
 * This file handles analytics snapshots and manual weekly analytics generation.
 */
// Shared database client for SQL queries.
const db = require('../config/db');
// Weekly analytics job used by manual trigger endpoint.
const { runWeeklyAnalytics } = require('../jobs/weeklyAnalyticsJob');

const listAnalytics = async (req, res, next) => {
    try {
        // Read optional ?limit= and keep it in safe range.
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10)));
        // Query latest analytics rows first.
        const result = await db.query(
            `SELECT id, period_start, period_end, total_reports, resolved_reports,
              pending_reports, in_progress_reports, overdue_escalations,
              response_rate_pct, generated_session_id, generated_at
       FROM analytics
       ORDER BY generated_at DESC
       LIMIT $1`,
            [limit]
        );

        // Return analytics list for table rendering in UI.
        res.json({ analytics: result.rows });
    } catch (error) {
        // Pass errors to centralized error handler.
        next(error);
    }
};

const getLatestAnalytics = async (req, res, next) => {
    try {
        // Fetch exactly one latest snapshot.
        const result = await db.query(
            `SELECT id, period_start, period_end, total_reports, resolved_reports,
              pending_reports, in_progress_reports, overdue_escalations,
              response_rate_pct, generated_session_id, generated_at
       FROM analytics
       ORDER BY generated_at DESC
       LIMIT 1`
        );

        // If analytics table is empty, return a clear 404.
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'No analytics snapshots available yet.' } });
        }

        // Return only one object for quick dashboard KPI usage.
        res.json({ analytics: result.rows[0] });
    } catch (error) {
        // Delegate errors to global middleware.
        next(error);
    }
};

const generateWeeklyAnalytics = async (req, res, next) => {
    try {
        // Trigger analytics job; tag trigger source for auditing.
        const output = await runWeeklyAnalytics({
            triggeredBy: req.user?.role === 'admin' ? 'admin' : 'system',
            triggeredByUserId: req.user?.id || null,
        });

        // Return created snapshot/session details.
        res.status(201).json({
            message: 'Weekly analytics generated successfully.',
            ...output,
        });
    } catch (error) {
        // Bubble up errors.
        next(error);
    }
};

module.exports = {
    listAnalytics,
    getLatestAnalytics,
    generateWeeklyAnalytics,
};
