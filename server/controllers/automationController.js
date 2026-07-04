/**
 * This file handles manual automation runs and session history APIs.
 */
// DB client for session history queries.
const db = require('../config/db');
// Job that recalculates overdue escalations.
const { checkOverdueEscalations } = require('../jobs/escalationOverdueJob');
// Job that computes weekly analytics snapshot.
const { runWeeklyAnalytics } = require('../jobs/weeklyAnalyticsJob');

const runAutomatedTriggers = async (req, res, next) => {
    try {
        // Run overdue-flag job first.
        const overdueCount = await checkOverdueEscalations();
        // Then run weekly analytics in same trigger cycle.
        const analyticsOutput = await runWeeklyAnalytics({
            triggeredBy: req.user?.role === 'admin' ? 'admin' : 'system',
            triggeredByUserId: req.user?.id || null,
        });

        // Return summary payload for admin visibility.
        res.json({
            message: 'Automated trigger cycle completed successfully.',
            overdueEscalationsFlagged: overdueCount,
            analytics: analyticsOutput.analytics,
            sessionId: analyticsOutput.sessionId,
        });
    } catch (error) {
        // Forward failure to global error middleware.
        next(error);
    }
};

const listAutomationSessions = async (req, res, next) => {
    try {
        // Optional limit with safe bounds.
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
        // Read recent automation sessions from newest to oldest.
        const result = await db.query(
            `SELECT id, trigger_name, triggered_by, triggered_by_user_id,
              status, started_at, ended_at, records_processed, error_message
       FROM sessions
       ORDER BY started_at DESC
       LIMIT $1`,
            [limit]
        );

        // Return session history for admin monitoring screen.
        res.json({ sessions: result.rows });
    } catch (error) {
        // Hand off errors to central handler.
        next(error);
    }
};

module.exports = {
    runAutomatedTriggers,
    listAutomationSessions,
};
