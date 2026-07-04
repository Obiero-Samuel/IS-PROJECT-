/**
 * This file handles audit trail writes for workflow actions.
 */
// Shared DB client for writing audit entries.
const db = require('../config/db');

// PostgreSQL code for "relation does not exist" (missing table).
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
    // Do nothing if caller forgot action type.
    if (!actionType) return;

    try {
        // Insert one normalized row into audit_trail table.
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
        // If migration isn't applied yet, skip logging without breaking requests.
        if (error?.code === AUDIT_TABLE_MISSING_CODE) {
            // Show warning only in non-production for developer visibility.
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[flow-audit] audit_trail table not found. Apply latest migrations to enable canonical audit logging.');
            }
            return;
        }
        // Re-throw unknown errors so caller can handle/report them.
        throw error;
    }
};

module.exports = {
    recordAuditTrail,
};
