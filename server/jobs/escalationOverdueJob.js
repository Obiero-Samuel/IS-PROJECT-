/**
 * This file handles the overdue-escalation job and recalculates overdue flags.
 */
const db = require('../config/db');

/**
 * Recompute escalation overdue flags from mapped SLA (default 7 days).
 */
const checkOverdueEscalations = async () => {
  console.log('[CRON] Starting checkOverdueEscalations...');
  try {
    const query = `
      WITH recomputed AS (
        SELECT
          e.id,
          CASE
            WHEN e.status = 'pending'
              AND e.escalated_at < NOW() - make_interval(days => COALESCE(cam.response_deadline_days, 7))
            THEN TRUE
            ELSE FALSE
          END AS should_be_overdue
        FROM escalations e
        JOIN reports r ON r.id = e.report_id
        LEFT JOIN category_authority_map cam
          ON cam.category_id = r.category_id
         AND cam.authority_id = e.authority_id
      ),
      updated AS (
        UPDATE escalations e
        SET is_overdue = recomputed.should_be_overdue,
            updated_at = NOW()
        FROM recomputed
        WHERE e.id = recomputed.id
          AND e.is_overdue IS DISTINCT FROM recomputed.should_be_overdue
        RETURNING e.id, e.is_overdue
      )
      SELECT
        COUNT(*)::INT AS changed_count,
        COUNT(*) FILTER (WHERE is_overdue = TRUE)::INT AS flagged_count,
        COUNT(*) FILTER (WHERE is_overdue = FALSE)::INT AS cleared_count
      FROM updated;
    `;

    const result = await db.query(query);
    const summary = result.rows[0] || { changed_count: 0, flagged_count: 0, cleared_count: 0 };

    console.log(
      `[CRON] checkOverdueEscalations completed. Changed=${summary.changed_count}, Flagged=${summary.flagged_count}, Cleared=${summary.cleared_count}.`
    );

    return Number(summary.flagged_count || 0);
  } catch (error) {
    console.error('[CRON] checkOverdueEscalations failed:', error);
    throw error;
  }
};

module.exports = {
  checkOverdueEscalations
};
