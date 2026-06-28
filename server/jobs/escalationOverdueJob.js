const db = require('../config/db');

/**
 * Checks for escalations that have been 'pending' for > 7 days
 * and flags them as is_overdue = true.
 */
const checkOverdueEscalations = async () => {
  console.log('[CRON] Starting checkOverdueEscalations...');
  try {
    const query = `
      UPDATE escalations
      SET is_overdue = TRUE, updated_at = NOW()
      WHERE status = 'pending'
        AND is_overdue = FALSE
        AND escalated_at < NOW() - INTERVAL '7 days'
      RETURNING id;
    `;
    const result = await db.query(query);
    console.log(`[CRON] checkOverdueEscalations completed. Flagged ${result.rows.length} escalations as overdue.`);
    return result.rows.length;
  } catch (error) {
    console.error('[CRON] checkOverdueEscalations failed:', error);
    throw error;
  }
};

module.exports = {
  checkOverdueEscalations
};
