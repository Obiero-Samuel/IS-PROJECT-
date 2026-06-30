const db = require('../config/db');
const { runWeeklyAnalytics } = require('../jobs/weeklyAnalyticsJob');

const listAnalytics = async (req, res, next) => {
    try {
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10)));
        const result = await db.query(
            `SELECT id, period_start, period_end, total_reports, resolved_reports,
              pending_reports, in_progress_reports, overdue_escalations,
              response_rate_pct, generated_session_id, generated_at
       FROM analytics
       ORDER BY generated_at DESC
       LIMIT $1`,
            [limit]
        );

        res.json({ analytics: result.rows });
    } catch (error) {
        next(error);
    }
};

const getLatestAnalytics = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT id, period_start, period_end, total_reports, resolved_reports,
              pending_reports, in_progress_reports, overdue_escalations,
              response_rate_pct, generated_session_id, generated_at
       FROM analytics
       ORDER BY generated_at DESC
       LIMIT 1`
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'No analytics snapshots available yet.' } });
        }

        res.json({ analytics: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

const generateWeeklyAnalytics = async (req, res, next) => {
    try {
        const output = await runWeeklyAnalytics({
            triggeredBy: req.user?.role === 'admin' ? 'admin' : 'system',
            triggeredByUserId: req.user?.id || null,
        });

        res.status(201).json({
            message: 'Weekly analytics generated successfully.',
            ...output,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listAnalytics,
    getLatestAnalytics,
    generateWeeklyAnalytics,
};
