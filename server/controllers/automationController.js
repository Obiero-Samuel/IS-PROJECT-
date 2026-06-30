const db = require('../config/db');
const { checkOverdueEscalations } = require('../jobs/escalationOverdueJob');
const { runWeeklyAnalytics } = require('../jobs/weeklyAnalyticsJob');

const runAutomatedTriggers = async (req, res, next) => {
    try {
        const overdueCount = await checkOverdueEscalations();
        const analyticsOutput = await runWeeklyAnalytics({
            triggeredBy: req.user?.role === 'admin' ? 'admin' : 'system',
            triggeredByUserId: req.user?.id || null,
        });

        res.json({
            message: 'Automated trigger cycle completed successfully.',
            overdueEscalationsFlagged: overdueCount,
            analytics: analyticsOutput.analytics,
            sessionId: analyticsOutput.sessionId,
        });
    } catch (error) {
        next(error);
    }
};

const listAutomationSessions = async (req, res, next) => {
    try {
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const result = await db.query(
            `SELECT id, trigger_name, triggered_by, triggered_by_user_id,
              status, started_at, ended_at, records_processed, error_message
       FROM sessions
       ORDER BY started_at DESC
       LIMIT $1`,
            [limit]
        );

        res.json({ sessions: result.rows });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    runAutomatedTriggers,
    listAutomationSessions,
};
