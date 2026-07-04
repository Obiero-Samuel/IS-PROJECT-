/**
 * This file handles authority and officer report queues, status updates, notes, and escalations.
 */
const db = require('../config/db');
const { recordAuditTrail } = require('../services/flowAuditService');

// Allowed report statuses for officer actions.
const VALID_REPORT_STATUSES = new Set(['pending', 'in-progress', 'resolved']);
// Escalation states considered active in workload views.
const ACTIVE_ESCALATION_STATUSES = ['pending', 'acknowledged'];

// Read and validate authority_id from authenticated user.
const parseAuthorityIdFromUser = (req) => {
  const authorityId = Number(req.user?.authority_id);
  if (!Number.isInteger(authorityId) || authorityId <= 0) {
    return null;
  }
  return authorityId;
};

// Parse CSV status filters (e.g. pending,in-progress).
const parseStatusFilter = (value) => {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

// ============================================================================
// Authority Routing
// ============================================================================

/**
 * GET /api/authority/routing?category_id=1
 * Returns the authorities responsible for a specific category.
 */
const getAuthoritiesForCategory = async (req, res, next) => {
  try {
    const { category_id } = req.query;
    if (!category_id) {
      return res.status(400).json({ error: { message: 'category_id is required' } });
    }

    const result = await db.query(
      `SELECT a.id, a.name, a.type, a.jurisdiction
       FROM authorities a
       JOIN category_authority_map cam ON cam.authority_id = a.id
       WHERE cam.category_id = $1 AND a.is_active = TRUE`,
      [category_id]
    );

    res.json({ authorities: result.rows });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Officer Endpoints (Role: authority)
// ============================================================================

/**
 * GET /api/authority/reports
 * Returns reports assigned to the logged-in officer authority.
 */
const getAssignedReports = async (req, res, next) => {
  try {
    const authorityId = parseAuthorityIdFromUser(req);

    if (!authorityId) {
      return res.status(403).json({
        error: { message: 'Officer account is not mapped to an authority. Contact admin.' }
      });
    }

    // Build optional filters incrementally.
    const conditions = ['r.resident_deleted_at IS NULL', 'cam.authority_id = $1'];
    const params = [authorityId];

    const statusFilters = parseStatusFilter(req.query.status);
    if (statusFilters.length > 0) {
      const invalidStatuses = statusFilters.filter((item) => !VALID_REPORT_STATUSES.has(item));
      if (invalidStatuses.length > 0) {
        return res.status(400).json({
          error: { message: `Invalid status filter value(s): ${invalidStatuses.join(', ')}` }
        });
      }

      params.push(statusFilters);
      conditions.push(`r.status = ANY($${params.length}::text[])`);
    }

    const wardIdRaw = req.query.ward_id;
    if (wardIdRaw !== undefined) {
      const wardId = Number(wardIdRaw);
      if (!Number.isInteger(wardId) || wardId <= 0) {
        return res.status(400).json({ error: { message: 'ward_id must be a positive integer.' } });
      }
      params.push(wardId);
      conditions.push(`r.ward_id = $${params.length}`);
    }

    const fromDate = req.query.from_date || req.query.start_date;
    if (fromDate !== undefined && fromDate !== '') {
      if (!isIsoDate(fromDate)) {
        return res.status(400).json({ error: { message: 'from_date must use YYYY-MM-DD format.' } });
      }
      params.push(String(fromDate).trim());
      conditions.push(`r.created_at::date >= $${params.length}::date`);
    }

    const toDate = req.query.to_date || req.query.end_date;
    if (toDate !== undefined && toDate !== '') {
      if (!isIsoDate(toDate)) {
        return res.status(400).json({ error: { message: 'to_date must use YYYY-MM-DD format.' } });
      }
      params.push(String(toDate).trim());
      conditions.push(`r.created_at::date <= $${params.length}::date`);
    }

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({ error: { message: 'from_date cannot be greater than to_date.' } });
    }

    // Enriched queue query (report + escalation context) in one round-trip.
    const result = await db.query(
      `SELECT
         r.id,
         r.tracking_number,
         r.title,
         r.description,
         r.status,
         r.created_at,
         r.updated_at,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400)::INT AS days_open,
         r.media_url,
         r.latitude,
         r.longitude,
         r.location_address,
         r.ward_id,
         w.name AS ward_name,
         r.category_id,
         c.name AS category_name,
         cam.authority_id,
         a.name AS authority_name,
         COALESCE(esc.escalation_count, 0) AS escalation_count,
         COALESCE(esc.active_escalation_count, 0) AS active_escalation_count,
         COALESCE(esc.has_overdue, FALSE) AS has_overdue_escalation,
         esc.latest_escalation_id,
         esc.latest_escalation_status,
         esc.latest_escalated_at,
         COALESCE(esc.latest_is_overdue, FALSE) AS latest_escalation_is_overdue,
         CASE
           WHEN COALESCE(esc.has_overdue, FALSE) THEN GREATEST(
             FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(esc.latest_active_escalated_at, r.created_at))) / 86400)::INT - 7,
             1
           )
           ELSE 0
         END AS days_overdue
       FROM reports r
       JOIN category_authority_map cam ON r.category_id = cam.category_id
       JOIN authorities a ON a.id = cam.authority_id
       LEFT JOIN wards w ON r.ward_id = w.id
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::INT AS escalation_count,
           COUNT(*) FILTER (WHERE e.status = ANY($${params.length + 1}::text[]))::INT AS active_escalation_count,
           COALESCE(BOOL_OR(e.is_overdue AND e.status = ANY($${params.length + 1}::text[])), FALSE) AS has_overdue,
           MAX(e.escalated_at) FILTER (WHERE e.status = ANY($${params.length + 1}::text[])) AS latest_active_escalated_at,
           (ARRAY_AGG(e.id ORDER BY e.escalated_at DESC))[1] AS latest_escalation_id,
           (ARRAY_AGG(e.status::text ORDER BY e.escalated_at DESC))[1] AS latest_escalation_status,
           (ARRAY_AGG(e.escalated_at ORDER BY e.escalated_at DESC))[1] AS latest_escalated_at,
           (ARRAY_AGG(e.is_overdue ORDER BY e.escalated_at DESC))[1] AS latest_is_overdue
         FROM escalations e
         WHERE e.report_id = r.id
           AND e.authority_id = cam.authority_id
       ) esc ON TRUE
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE
           WHEN COALESCE(esc.has_overdue, FALSE) = TRUE AND r.status <> 'resolved' THEN 0
           WHEN r.status = 'pending' THEN 1
           WHEN r.status = 'in-progress' THEN 2
           WHEN r.status = 'resolved' THEN 3
           ELSE 4
         END ASC,
         CASE WHEN r.status = 'pending' THEN r.created_at END DESC,
         CASE WHEN r.status = 'in-progress' THEN r.created_at END ASC,
         CASE WHEN r.status = 'resolved' THEN r.updated_at END DESC,
         r.created_at DESC`,
      [...params, ACTIVE_ESCALATION_STATUSES]
    );

    res.json({
      reports: result.rows,
      authority_id: authorityId,
      filters: {
        status: statusFilters,
        ward_id: wardIdRaw !== undefined ? Number(wardIdRaw) : null,
        from_date: fromDate || null,
        to_date: toDate || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/authority/reports/:id/status
 * Updates report status and logs it.
 */
const updateReportStatus = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const status = String(req.body?.status || '').trim().toLowerCase();
    const notes = String(req.body?.notes || '').trim();
    const userId = req.user.id;
    const authorityId = parseAuthorityIdFromUser(req);

    if (!authorityId) {
      return res.status(403).json({
        error: { message: 'Officer account is not mapped to an authority. Contact admin.' }
      });
    }

    if (!status) {
      return res.status(400).json({ error: { message: 'status is required' } });
    }

    if (!VALID_REPORT_STATUSES.has(status)) {
      return res.status(400).json({ error: { message: 'Invalid status value.' } });
    }

    if (status === 'resolved' && !notes) {
      return res.status(400).json({
        error: { message: 'Resolution notes are required when setting status to resolved.' }
      });
    }

    // Keep report status and status_logs in one transaction.
    await db.query('BEGIN');

    // Lock only reports in officer authority scope.
    const reportRes = await db.query(
      `SELECT r.status
       FROM reports r
       JOIN category_authority_map cam ON cam.category_id = r.category_id
       WHERE r.id = $1
         AND r.resident_deleted_at IS NULL
         AND cam.authority_id = $2
       LIMIT 1`,
      [reportId, authorityId]
    );

    if (reportRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Report not found in your authority scope.' } });
    }

    const oldStatus = reportRes.rows[0].status;

    // Update canonical report state.
    await db.query(
      'UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2 AND resident_deleted_at IS NULL',
      [status, reportId]
    );

    // Append transition log for audit trail.
    await db.query(
      `INSERT INTO status_logs (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, userId, oldStatus, status, notes || null]
    );

    await db.query('COMMIT');
    res.json({ message: 'Status updated successfully', new_status: status });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  }
};

/**
 * POST /api/authority/reports/:id/notes
 * Adds a resolution note without changing status.
 */
const addResolutionNote = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const notes = String(req.body?.notes || '').trim();
    const userId = req.user.id;
    const authorityId = parseAuthorityIdFromUser(req);

    if (!authorityId) {
      return res.status(403).json({
        error: { message: 'Officer account is not mapped to an authority. Contact admin.' }
      });
    }

    if (!notes) {
      return res.status(400).json({ error: { message: 'notes are required' } });
    }

    const reportRes = await db.query(
      `SELECT r.status
       FROM reports r
       JOIN category_authority_map cam ON cam.category_id = r.category_id
       WHERE r.id = $1
         AND r.resident_deleted_at IS NULL
         AND cam.authority_id = $2
       LIMIT 1`,
      [reportId, authorityId]
    );

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Report not found in your authority scope.' } });
    }

    const currentStatus = reportRes.rows[0].status;

    // Persist note without changing status.
    await db.query(
      `INSERT INTO status_logs (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, userId, currentStatus, currentStatus, notes]
    );

    res.status(201).json({ message: 'Note added successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Escalation Management
// ============================================================================

/**
 * POST /api/authority/escalations
 */
const createEscalation = async (req, res, next) => {
  try {
    const { report_id, authority_id, reason } = req.body;
    const userId = req.user.id;

    if (!report_id || !authority_id || !reason) {
      return res.status(400).json({ error: { message: 'report_id, authority_id, and reason required' } });
    }

    const reportCheck = await db.query(
      'SELECT id FROM reports WHERE id = $1 AND resident_deleted_at IS NULL',
      [report_id]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Report not found or no longer available.' } });
    }

    // Create escalation, then mirror it to audit trail.
    const result = await db.query(
      `INSERT INTO escalations (report_id, authority_id, escalated_by, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [report_id, authority_id, userId, reason]
    );

    await recordAuditTrail({
      reportId: Number(report_id),
      actorUserId: userId,
      actorRole: req.user.role,
      actionType: 'escalation_created',
      notes: reason,
      metadata: {
        module: 'Escalation Engine & Audit Logger',
        escalation_id: result.rows[0].id,
        authority_id: Number(authority_id),
      },
    });

    res.status(201).json({ message: 'Escalation created', escalation: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/authority/escalations
 */
const getEscalationsForAuthority = async (req, res, next) => {
  try {
    const requestedAuthorityId = req.query.authority_id;
    let authorityId;

    // Officers are self-scoped; admins may query a specific authority.
    if (req.user.role === 'authority') {
      authorityId = parseAuthorityIdFromUser(req);

      if (!authorityId) {
        return res.status(403).json({
          error: { message: 'Officer account is not mapped to an authority. Contact admin.' }
        });
      }

      if (requestedAuthorityId !== undefined && Number(requestedAuthorityId) !== authorityId) {
        return res.status(403).json({
          error: { message: 'Forbidden: cannot view escalations for another authority.' }
        });
      }
    } else {
      authorityId = Number(requestedAuthorityId);
      if (!Number.isInteger(authorityId) || authorityId <= 0) {
        return res.status(400).json({ error: { message: 'authority_id is required for admin view.' } });
      }
    }

    // Optional multi-value status filter.
    const escalationStatuses = parseStatusFilter(req.query.status);
    const conditions = ['e.authority_id = $1', 'r.resident_deleted_at IS NULL'];
    const params = [authorityId];

    if (escalationStatuses.length > 0) {
      const validEscalationStatuses = new Set(['pending', 'acknowledged', 'resolved', 'rejected']);
      const invalidEscalationStatuses = escalationStatuses.filter((item) => !validEscalationStatuses.has(item));
      if (invalidEscalationStatuses.length > 0) {
        return res.status(400).json({
          error: { message: `Invalid escalation status value(s): ${invalidEscalationStatuses.join(', ')}` }
        });
      }

      params.push(escalationStatuses);
      conditions.push(`e.status::text = ANY($${params.length}::text[])`);
    }

    const result = await db.query(
      `SELECT
         e.*,
         r.title,
         r.tracking_number,
         r.status AS report_status,
         r.created_at AS report_created_at,
         c.name AS category_name,
         w.name AS ward_name,
         COALESCE(cam.response_deadline_days, 7) AS response_deadline_days,
         GREATEST(
           FLOOR(EXTRACT(EPOCH FROM (NOW() - e.escalated_at)) / 86400)::INT - COALESCE(cam.response_deadline_days, 7),
           0
         ) AS days_overdue
       FROM escalations e
       JOIN reports r ON e.report_id = r.id
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN wards w ON w.id = r.ward_id
       LEFT JOIN category_authority_map cam
         ON cam.category_id = r.category_id
        AND cam.authority_id = e.authority_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.is_overdue DESC, e.escalated_at DESC`,
      params
    );

    res.json({ escalations: result.rows, authority_id: authorityId });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/authority/escalations/:id
 */
const updateEscalationStatus = async (req, res, next) => {
  try {
    const escalationId = parseInt(req.params.id);
    const { status, authority_notes } = req.body;

    // Restrict to allowed escalation transitions.
    if (!['acknowledged', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status' } });
    }

    const previousRes = await db.query(
      `SELECT e.id, e.report_id, e.status
       FROM escalations e
       JOIN reports r ON r.id = e.report_id
       WHERE e.id = $1
         AND r.resident_deleted_at IS NULL`,
      [escalationId]
    );
    if (previousRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Escalation not found' } });
    }

    const previous = previousRes.rows[0];

    // Set timeline timestamp by target state.
    let timestampUpdate = '';
    if (status === 'acknowledged') timestampUpdate = ', acknowledged_at = NOW()';
    if (status === 'resolved' || status === 'rejected') timestampUpdate = ', resolved_at = NOW()';

    const result = await db.query(
      `UPDATE escalations 
       SET status = $1, authority_notes = COALESCE($2, authority_notes) ${timestampUpdate}
       WHERE id = $3 RETURNING *`,
      [status, authority_notes || null, escalationId]
    );

    await recordAuditTrail({
      reportId: previous.report_id,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'escalation_status_updated',
      oldStatus: previous.status,
      newStatus: status,
      notes: authority_notes || null,
      metadata: {
        module: 'Escalation Engine & Audit Logger',
        escalation_id: escalationId,
      },
    });

    res.json({ message: 'Escalation updated', escalation: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuthoritiesForCategory,
  getAssignedReports,
  updateReportStatus,
  addResolutionNote,
  createEscalation,
  getEscalationsForAuthority,
  updateEscalationStatus
};
