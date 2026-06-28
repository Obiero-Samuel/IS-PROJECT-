const db = require('../config/db');

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
 * Returns reports assigned to the officer's ward or jurisdiction.
 */
const getAssignedReports = async (req, res, next) => {
  try {
    // In a full implementation, you would look up the officer's assigned authority_id
    // from a users_authorities join table. For simplicity in this demo, we assume
    // the user passes their authority_id as a query param, or it's attached to req.user
    // if extended in the future. We'll use a query param `authority_id` for now.
    const { authority_id, status } = req.query;

    if (!authority_id) {
      return res.status(400).json({ error: { message: 'authority_id is required' } });
    }

    const conditions = ['cam.authority_id = $1'];
    const params = [authority_id];

    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }

    const result = await db.query(
      `SELECT DISTINCT r.id, r.tracking_number, r.title, r.status, r.created_at, w.name as ward_name
       FROM reports r
       LEFT JOIN wards w ON r.ward_id = w.id
       JOIN category_authority_map cam ON r.category_id = cam.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params
    );

    res.json({ reports: result.rows });
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
    const reportId = parseInt(req.params.id);
    const { status, notes } = req.body;
    const userId = req.user.id;

    if (!status) {
      return res.status(400).json({ error: { message: 'status is required' } });
    }

    await db.query('BEGIN');

    // Get old status
    const reportRes = await db.query('SELECT status FROM reports WHERE id = $1', [reportId]);
    if (reportRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Report not found' } });
    }
    const oldStatus = reportRes.rows[0].status;

    // Update status
    await db.query(
      'UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, reportId]
    );

    // Insert log
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
    const reportId = parseInt(req.params.id);
    const { notes } = req.body;
    const userId = req.user.id;

    if (!notes) {
      return res.status(400).json({ error: { message: 'notes are required' } });
    }

    const reportRes = await db.query('SELECT status FROM reports WHERE id = $1', [reportId]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Report not found' } });
    }
    const currentStatus = reportRes.rows[0].status;

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

    const result = await db.query(
      `INSERT INTO escalations (report_id, authority_id, escalated_by, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [report_id, authority_id, userId, reason]
    );

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
    const { authority_id } = req.query;
    if (!authority_id) {
      return res.status(400).json({ error: { message: 'authority_id is required' } });
    }

    const result = await db.query(
      `SELECT e.*, r.title, r.tracking_number 
       FROM escalations e
       JOIN reports r ON e.report_id = r.id
       WHERE e.authority_id = $1
       ORDER BY e.escalated_at DESC`,
      [authority_id]
    );

    res.json({ escalations: result.rows });
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

    if (!['acknowledged', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status' } });
    }

    let timestampUpdate = '';
    if (status === 'acknowledged') timestampUpdate = ', acknowledged_at = NOW()';
    if (status === 'resolved' || status === 'rejected') timestampUpdate = ', resolved_at = NOW()';

    const result = await db.query(
      `UPDATE escalations 
       SET status = $1, authority_notes = COALESCE($2, authority_notes) ${timestampUpdate}
       WHERE id = $3 RETURNING *`,
      [status, authority_notes || null, escalationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Escalation not found' } });
    }

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
