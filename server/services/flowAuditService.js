const db = require('../config/db');

const AUDIT_TABLE_MISSING_CODE = '42P01';

/**
 * Writes a normalized audit entry to the canonical audit_trail table.
 * If the flow-contract migration has not been applied yet, this fails open
 * (non-blocking) to avoid breaking production traffic.
 */
const recordAuditTrail = async ({
    reportId,
    actorUserId = null,
    actorRole = 'system',
    actionType,
    oldStatus = null,
    newStatus = null,
    notes = null,
    metadata = {},
}) => {
    if (!actionType) return;

    try {
        await db.query(
            `INSERT INTO audit_trail
         (report_id, actor_user_id, actor_role, action_type, old_status, new_status, notes, metadata)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
            [
                reportId || null,
                actorUserId || null,
                actorRole || 'system',
                actionType,
                oldStatus,
                newStatus,
                notes,
                JSON.stringify(metadata || {}),
            ]
        );
    } catch (error) {
        if (error?.code === AUDIT_TABLE_MISSING_CODE) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[flow-audit] audit_trail table not found. Apply latest migrations to enable canonical audit logging.');
            }
            return;
        }
        throw error;
    }
};

module.exports = {
    recordAuditTrail,
};
