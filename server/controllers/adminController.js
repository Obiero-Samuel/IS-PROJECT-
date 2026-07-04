/**
 * This file handles admin operations for users, reports, mappings, and exports.
 */
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { recordAuditTrail } = require('../services/flowAuditService');

// Shared validators.
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
const parsePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const REPORT_EXPORTS_DIR = path.join(__dirname, '..', 'uploads', 'reports');
const WEEKLY_REPORT_PERIOD = 'weekly';
const DEFAULT_RESPONSE_DEADLINE_DAYS = 7;
const MAX_RESPONSE_DEADLINE_DAYS = 365;
const DEFAULT_WEEKLY_WINDOW_DAYS = 7;

const ADMIN_USER_SELECT = `
  id,
  username,
  email,
  role,
  ward_id,
  authority_id,
  is_active,
  last_login_at,
  deactivated_at,
  deactivation_reason,
  created_at
`;

const toIsoDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveDateWindow = ({ periodStartRaw, periodEndRaw }) => {
  // Use explicit YYYY-MM-DD or default to rolling 7-day window.
  if (periodStartRaw && !isIsoDate(periodStartRaw)) {
    throw new Error('period_start must use YYYY-MM-DD format.');
  }
  if (periodEndRaw && !isIsoDate(periodEndRaw)) {
    throw new Error('period_end must use YYYY-MM-DD format.');
  }

  if (periodStartRaw && periodEndRaw) {
    const start = new Date(`${periodStartRaw}T00:00:00.000Z`);
    const end = new Date(`${periodEndRaw}T23:59:59.999Z`);
    if (start > end) {
      throw new Error('period_start cannot be greater than period_end.');
    }
    return {
      periodStart: String(periodStartRaw),
      periodEnd: String(periodEndRaw),
      fromTimestamp: start.toISOString(),
      toTimestamp: end.toISOString(),
    };
  }

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (DEFAULT_WEEKLY_WINDOW_DAYS - 1));
  start.setUTCHours(0, 0, 0, 0);

  return {
    periodStart: toIsoDateOnly(start),
    periodEnd: toIsoDateOnly(end),
    fromTimestamp: start.toISOString(),
    toTimestamp: end.toISOString(),
  };
};

const ensureReportExportsDir = () => {
  fs.mkdirSync(REPORT_EXPORTS_DIR, { recursive: true });
};

const csvEscape = (value) => {
  const safe = String(value ?? '');
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
};

const buildExportFilename = ({ authorityId, periodStart, periodEnd, format }) => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `weekly-report-a${authorityId}-${periodStart}_${periodEnd}-${stamp}.${format}`;
};

const createCsvWeeklyExport = ({ filePath, rows }) => {
  const headers = [
    'tracking_number',
    'title',
    'status',
    'category_name',
    'ward_name',
    'authority_name',
    'created_at',
  ];

  const csvRows = rows.map((row) => [
    row.tracking_number,
    row.title,
    row.status,
    row.category_name,
    row.ward_name,
    row.authority_name,
    row.created_at,
  ]);

  const content = [
    headers.join(','),
    ...csvRows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n');

  fs.writeFileSync(filePath, content, 'utf8');
};

const createPdfWeeklyExport = async ({ filePath, rows, authorityName, periodStart, periodEnd }) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // Header block.
  doc.fontSize(18).text('Weekly Unresolved Reports Export', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Authority: ${authorityName}`);
  doc.text(`Period: ${periodStart} to ${periodEnd}`);
  doc.text(`Generated at: ${new Date().toISOString()}`);
  doc.text(`Total unresolved reports: ${rows.length}`);
  doc.moveDown(1);

  if (rows.length === 0) {
    doc.fontSize(11).text('No unresolved reports found for the selected filters.');
  } else {
    rows.forEach((row, index) => {
      // Keep rows compact to fit page.
      doc.fontSize(10).text(
        `${index + 1}. ${row.tracking_number} | ${row.title} | ${row.status}`,
        { continued: false }
      );
      doc.fontSize(9).fillColor('#444').text(
        `   Category: ${row.category_name || 'N/A'} | Ward: ${row.ward_name || 'N/A'} | Authority: ${row.authority_name || 'N/A'}`
      );
      doc.text(`   Created: ${new Date(row.created_at).toLocaleString()}`);
      doc.fillColor('#000');
      doc.moveDown(0.5);

      if (doc.y > 740) {
        doc.addPage();
      }
    });
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

// ============================================================================
// Users Management
// ============================================================================

const listUsers = async (req, res, next) => {
  try {
    // Include lifecycle and authority context for admin controls.
    const result = await db.query(`
      SELECT ${ADMIN_USER_SELECT}
      FROM users
      ORDER BY created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (!['resident', 'authority', 'admin'].includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid role' } });
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } });
    res.json({ message: 'User role updated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateUserLifecycle = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { is_active, deactivation_reason } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid user id.' } });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: { message: 'is_active boolean is required.' } });
    }

    const reason = String(deactivation_reason || '').trim();

    // Prevent self-deactivation lockout.
    if (req.user?.id === userId && is_active === false) {
      return res.status(400).json({ error: { message: 'You cannot deactivate your own account.' } });
    }

    if (is_active === false && !reason) {
      return res.status(400).json({ error: { message: 'deactivation_reason is required when deactivating a user.' } });
    }

    await db.query('BEGIN');

    const currentUserRes = await db.query(
      `SELECT ${ADMIN_USER_SELECT}
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (currentUserRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const currentUser = currentUserRes.rows[0];

    const updateRes = is_active
      ? await db.query(
        `UPDATE users
           SET is_active = TRUE,
               deactivated_at = NULL,
               deactivation_reason = NULL
           WHERE id = $1
           RETURNING ${ADMIN_USER_SELECT}`,
        [userId]
      )
      : await db.query(
        `UPDATE users
           SET is_active = FALSE,
               deactivated_at = NOW(),
               deactivation_reason = $2
           WHERE id = $1
           RETURNING ${ADMIN_USER_SELECT}`,
        [userId, reason]
      );

    await db.query('COMMIT');

    await recordAuditTrail({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: is_active ? 'admin_user_reactivated' : 'admin_user_deactivated',
      oldStatus: currentUser.is_active ? 'active' : 'inactive',
      newStatus: is_active ? 'active' : 'inactive',
      notes: reason || null,
      metadata: {
        module: 'Admin User Lifecycle',
        target_user_id: currentUser.id,
        target_username: currentUser.username,
        target_email: currentUser.email,
        target_role: currentUser.role,
        target_authority_id: currentUser.authority_id,
      },
    });

    res.json({
      message: is_active ? 'User reactivated successfully.' : 'User deactivated successfully.',
      user: updateRes.rows[0],
    });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {
      // no-op
    }
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Reports Oversight
// ============================================================================

const listReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Compose optional report filters.
    const conditions = [];
    const params = [];

    if (req.query.ward_id !== undefined && req.query.ward_id !== '') {
      const wardId = Number(req.query.ward_id);
      if (!Number.isInteger(wardId) || wardId <= 0) {
        return res.status(400).json({ error: { message: 'ward_id must be a positive integer.' } });
      }
      params.push(wardId);
      conditions.push(`r.ward_id = $${params.length}`);
    }

    if (req.query.category_id !== undefined && req.query.category_id !== '') {
      const categoryId = Number(req.query.category_id);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: { message: 'category_id must be a positive integer.' } });
      }
      params.push(categoryId);
      conditions.push(`r.category_id = $${params.length}`);
    }

    if (req.query.status) {
      const allowedStatuses = new Set(['pending', 'in-progress', 'resolved']);
      const statusFilters = String(req.query.status)
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      const invalid = statusFilters.filter((item) => !allowedStatuses.has(item));
      if (invalid.length > 0) {
        return res.status(400).json({ error: { message: `Invalid status filter value(s): ${invalid.join(', ')}` } });
      }

      if (statusFilters.length > 0) {
        params.push(statusFilters);
        conditions.push(`r.status = ANY($${params.length}::text[])`);
      }
    }

    if (req.query.authority_id !== undefined && req.query.authority_id !== '') {
      const authorityId = Number(req.query.authority_id);
      if (!Number.isInteger(authorityId) || authorityId <= 0) {
        return res.status(400).json({ error: { message: 'authority_id must be a positive integer.' } });
      }

      params.push(authorityId);
      const authorityParam = `$${params.length}`;
      conditions.push(`(
        EXISTS (
          SELECT 1
          FROM category_authority_map cam_filter
          WHERE cam_filter.category_id = r.category_id
            AND cam_filter.authority_id = ${authorityParam}
        )
        OR EXISTS (
          SELECT 1
          FROM escalations esc_filter
          WHERE esc_filter.report_id = r.id
            AND esc_filter.authority_id = ${authorityParam}
        )
      )`);
    }

    const fromDate = req.query.from_date;
    if (fromDate !== undefined && fromDate !== '') {
      if (!isIsoDate(fromDate)) {
        return res.status(400).json({ error: { message: 'from_date must use YYYY-MM-DD format.' } });
      }
      params.push(String(fromDate).trim());
      conditions.push(`r.created_at::date >= $${params.length}::date`);
    }

    const toDate = req.query.to_date;
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

    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      params.push(search);
      conditions.push(`(r.tracking_number ILIKE $${params.length} OR r.title ILIKE $${params.length})`);
    }

    // Reuse whereClause so list and count stay aligned.
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataParams = [...params, limit, offset];
    const limitPlaceholder = `$${dataParams.length - 1}`;
    const offsetPlaceholder = `$${dataParams.length}`;

    const dataQuery = `
      SELECT
        r.id,
        r.tracking_number,
        r.title,
        r.description,
        r.status,
        r.created_at,
        r.updated_at,
        r.closed_by_admin,
        r.admin_override_notes,
        r.closed_at,
        r.category_id,
        c.name AS category_name,
        r.ward_id,
        w.name AS ward_name,
        reporter.id AS reporter_id,
        reporter.username AS reporter_username,
        route.primary_authority_id AS authority_id,
        route.primary_authority_name AS authority_name,
        COALESCE(route.mapped_authorities, '[]'::jsonb) AS mapped_authorities,
        esc.latest_escalation_id,
        esc.latest_escalation_status,
        esc.latest_escalated_at,
        COALESCE(esc.overdue_escalation_count, 0) AS overdue_escalation_count
      FROM reports r
      LEFT JOIN categories c ON c.id = r.category_id
      LEFT JOIN wards w ON w.id = r.ward_id
      LEFT JOIN users reporter ON reporter.id = r.user_id
      LEFT JOIN LATERAL (
        SELECT
          (ARRAY_AGG(a.id ORDER BY a.id))[1] AS primary_authority_id,
          (ARRAY_AGG(a.name ORDER BY a.id))[1] AS primary_authority_name,
          COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('id', a.id, 'name', a.name))
              FILTER (WHERE a.id IS NOT NULL),
            '[]'::jsonb
          ) AS mapped_authorities
        FROM category_authority_map cam
        JOIN authorities a ON a.id = cam.authority_id
        WHERE cam.category_id = r.category_id
      ) route ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          (ARRAY_AGG(e.id ORDER BY e.escalated_at DESC))[1] AS latest_escalation_id,
          (ARRAY_AGG(e.status::text ORDER BY e.escalated_at DESC))[1] AS latest_escalation_status,
          (ARRAY_AGG(e.escalated_at ORDER BY e.escalated_at DESC))[1] AS latest_escalated_at,
          COUNT(*) FILTER (WHERE e.is_overdue = TRUE)::INT AS overdue_escalation_count
        FROM escalations e
        WHERE e.report_id = r.id
      ) esc ON TRUE
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const countQuery = `
      SELECT COUNT(*)::INT AS total
      FROM reports r
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, dataParams),
      db.query(countQuery, params),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      reports: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

const reassignReport = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const authorityId = Number(req.body?.authority_id);
    const categoryIdRaw = req.body?.category_id;
    const note = String(req.body?.note || req.body?.reason || '').trim();

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid report id.' } });
    }

    if (!Number.isInteger(authorityId) || authorityId <= 0) {
      return res.status(400).json({ error: { message: 'authority_id must be a positive integer.' } });
    }

    if (!note) {
      return res.status(400).json({ error: { message: 'note is required for report reassignment.' } });
    }

    const hasCategoryOverride = categoryIdRaw !== undefined && categoryIdRaw !== null && categoryIdRaw !== '';
    const categoryId = hasCategoryOverride ? Number(categoryIdRaw) : null;

    if (hasCategoryOverride && (!Number.isInteger(categoryId) || categoryId <= 0)) {
      return res.status(400).json({ error: { message: 'category_id must be a positive integer when provided.' } });
    }

    // Keep reassignment, escalation, and log writes atomic.
    await db.query('BEGIN');

    const reportRes = await db.query(
      `SELECT id, tracking_number, category_id, status
       FROM reports
       WHERE id = $1
       FOR UPDATE`,
      [reportId]
    );

    if (reportRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Report not found.' } });
    }

    const currentReport = reportRes.rows[0];
    const previousCategoryId = Number(currentReport.category_id);
    const targetCategoryId = hasCategoryOverride ? Number(categoryId) : previousCategoryId;

    // Validate target authority/category first.
    const authorityRes = await db.query(
      'SELECT id, name FROM authorities WHERE id = $1 AND is_active = TRUE',
      [authorityId]
    );
    if (authorityRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Target authority not found or inactive.' } });
    }

    if (hasCategoryOverride) {
      const categoryRes = await db.query('SELECT id FROM categories WHERE id = $1', [targetCategoryId]);
      if (categoryRes.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: { message: 'Target category not found.' } });
      }

      await db.query(
        `UPDATE reports
         SET category_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [targetCategoryId, reportId]
      );
    }

    // Ensure routing edge exists for target category-authority pair.
    await db.query(
      `INSERT INTO category_authority_map (category_id, authority_id)
       VALUES ($1, $2)
       ON CONFLICT (category_id, authority_id) DO NOTHING`,
      [targetCategoryId, authorityId]
    );

    const escalationRes = await db.query(
      `INSERT INTO escalations (report_id, authority_id, escalated_by, reason, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, authority_id, status, escalated_at`,
      [reportId, authorityId, req.user.id, note]
    );

    await db.query(
      `INSERT INTO status_logs (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, req.user.id, currentReport.status, currentReport.status, `Admin reassignment: ${note}`]
    );

    const updatedRes = await db.query(
      `SELECT
         r.id,
         r.tracking_number,
         r.title,
         r.status,
         r.category_id,
         c.name AS category_name,
         r.ward_id,
         w.name AS ward_name,
         a.id AS authority_id,
         a.name AS authority_name,
         r.updated_at
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN wards w ON w.id = r.ward_id
       LEFT JOIN authorities a ON a.id = $2
       WHERE r.id = $1`,
      [reportId, authorityId]
    );

    await db.query('COMMIT');

    await recordAuditTrail({
      reportId,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'admin_report_reassigned',
      oldStatus: currentReport.status,
      newStatus: currentReport.status,
      notes: note,
      metadata: {
        module: 'Admin Reports Management',
        target_authority_id: authorityId,
        previous_category_id: previousCategoryId,
        new_category_id: targetCategoryId,
        escalation_id: escalationRes.rows[0]?.id,
      },
    });

    res.json({
      message: 'Report reassigned successfully.',
      report: updatedRes.rows[0],
      escalation: escalationRes.rows[0],
    });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {
      // no-op
    }
    next(error);
  }
};

const overrideCloseReport = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const note = String(req.body?.note || req.body?.admin_override_notes || '').trim();

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid report id.' } });
    }

    if (!note) {
      return res.status(400).json({ error: { message: 'note is required for override-close.' } });
    }

    // Keep close action and status log in one transaction.
    await db.query('BEGIN');

    const reportRes = await db.query(
      `SELECT id, tracking_number, status
       FROM reports
       WHERE id = $1
       FOR UPDATE`,
      [reportId]
    );

    if (reportRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Report not found.' } });
    }

    const currentReport = reportRes.rows[0];

    const updatedRes = await db.query(
      `UPDATE reports
       SET status = 'resolved',
           closed_by_admin = TRUE,
           admin_override_notes = $1,
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, tracking_number, status, closed_by_admin, admin_override_notes, closed_at, updated_at`,
      [note, reportId]
    );

    await db.query(
      `INSERT INTO status_logs (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, req.user.id, currentReport.status, 'resolved', `Admin override close: ${note}`]
    );

    await db.query('COMMIT');

    await recordAuditTrail({
      reportId,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'admin_override_closed',
      oldStatus: currentReport.status,
      newStatus: 'resolved',
      notes: note,
      metadata: {
        module: 'Admin Reports Management',
        closed_by_admin: true,
      },
    });

    res.json({
      message: 'Report override-closed successfully.',
      report: updatedRes.rows[0],
    });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {
      // no-op
    }
    next(error);
  }
};

// ============================================================================
// Wards Management
// ============================================================================

const listWards = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM wards ORDER BY name');
    res.json({ wards: result.rows });
  } catch (error) {
    next(error);
  }
};

const createWard = async (req, res, next) => {
  try {
    const { name, code, county, constituency, authority_id } = req.body;
    if (!name || !county) return res.status(400).json({ error: { message: 'name and county required' } });

    const result = await db.query(
      `INSERT INTO wards (name, code, county, constituency, authority_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code, county, constituency, authority_id || null]
    );
    res.status(201).json({ ward: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateWard = async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.id);
    const { name, code, county, constituency, authority_id, is_active } = req.body;

    const result = await db.query(
      `UPDATE wards 
       SET name = COALESCE($1, name), code = COALESCE($2, code), county = COALESCE($3, county),
           constituency = COALESCE($4, constituency), authority_id = COALESCE($5, authority_id),
           is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [name, code, county, constituency, authority_id, is_active, wardId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Ward not found' } });
    res.json({ ward: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteWard = async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.id);
    const result = await db.query('DELETE FROM wards WHERE id = $1 RETURNING id', [wardId]);
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Ward not found' } });
    res.json({ message: 'Ward deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Categories Management
// ============================================================================

const listCategories = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: { message: 'name required' } });

    const result = await db.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const catId = parseInt(req.params.id);
    const { name, description } = req.body;
    const result = await db.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, catId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Category not found' } });
    res.json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const catId = parseInt(req.params.id);
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [catId]);
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Category not found' } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Authorities Management
// ============================================================================

const listAuthorities = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM authorities ORDER BY name');
    res.json({ authorities: result.rows });
  } catch (error) {
    next(error);
  }
};

const createAuthority = async (req, res, next) => {
  try {
    const { name, type, jurisdiction, contact_email, phone, website } = req.body;
    if (!name || !type) return res.status(400).json({ error: { message: 'name and type required' } });

    const result = await db.query(
      `INSERT INTO authorities (name, type, jurisdiction, contact_email, phone, website)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, jurisdiction, contact_email, phone, website]
    );
    res.status(201).json({ authority: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateAuthority = async (req, res, next) => {
  try {
    const authId = parseInt(req.params.id);
    const { name, type, jurisdiction, contact_email, phone, website, is_active } = req.body;

    const result = await db.query(
      `UPDATE authorities 
       SET name = COALESCE($1, name), type = COALESCE($2, type), jurisdiction = COALESCE($3, jurisdiction),
           contact_email = COALESCE($4, contact_email), phone = COALESCE($5, phone), website = COALESCE($6, website),
           is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [name, type, jurisdiction, contact_email, phone, website, is_active, authId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Authority not found' } });
    res.json({ authority: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Category-Authority Mapping
// ============================================================================

const listCategoryAuthorityMappings = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         cam.category_id,
         c.name AS category_name,
         cam.authority_id,
         a.name AS authority_name,
         a.is_active AS authority_is_active,
         cam.response_deadline_days
       FROM category_authority_map cam
       JOIN categories c ON c.id = cam.category_id
       JOIN authorities a ON a.id = cam.authority_id
       ORDER BY c.name ASC, a.name ASC`
    );

    res.json({ mappings: result.rows });
  } catch (error) {
    next(error);
  }
};

const mapCategoryToAuthority = async (req, res, next) => {
  try {
    const categoryId = parsePositiveInt(req.body?.category_id);
    const authorityId = parsePositiveInt(req.body?.authority_id);

    if (!categoryId || !authorityId) {
      return res.status(400).json({ error: { message: 'category_id and authority_id must be positive integers.' } });
    }

    let responseDeadlineDays = DEFAULT_RESPONSE_DEADLINE_DAYS;
    const incomingDeadline = req.body?.response_deadline_days;

    // Optional per-route SLA override.
    if (incomingDeadline !== undefined && incomingDeadline !== null && incomingDeadline !== '') {
      const parsedDeadline = parsePositiveInt(incomingDeadline);
      if (!parsedDeadline || parsedDeadline > MAX_RESPONSE_DEADLINE_DAYS) {
        return res.status(400).json({
          error: { message: `response_deadline_days must be between 1 and ${MAX_RESPONSE_DEADLINE_DAYS}.` },
        });
      }
      responseDeadlineDays = parsedDeadline;
    }

    const [categoryRes, authorityRes] = await Promise.all([
      db.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]),
      db.query('SELECT id, name FROM authorities WHERE id = $1', [authorityId]),
    ]);

    if (categoryRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Category not found.' } });
    }

    if (authorityRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Authority not found.' } });
    }

    // Upsert keeps mapping idempotent.
    const result = await db.query(
      `INSERT INTO category_authority_map (category_id, authority_id, response_deadline_days)
       VALUES ($1, $2, $3)
       ON CONFLICT (category_id, authority_id)
       DO UPDATE SET response_deadline_days = EXCLUDED.response_deadline_days
       RETURNING category_id, authority_id, response_deadline_days`,
      [categoryId, authorityId, responseDeadlineDays]
    );

    await recordAuditTrail({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'admin_category_authority_mapping_saved',
      metadata: {
        module: 'Admin Deadline Management',
        category_id: categoryId,
        category_name: categoryRes.rows[0].name,
        authority_id: authorityId,
        authority_name: authorityRes.rows[0].name,
        response_deadline_days: responseDeadlineDays,
      },
    });

    res.status(201).json({
      message: 'Category-authority mapping saved successfully.',
      mapping: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

const unmapCategoryFromAuthority = async (req, res, next) => {
  try {
    const categoryId = parsePositiveInt(req.body?.category_id);
    const authorityId = parsePositiveInt(req.body?.authority_id);

    if (!categoryId || !authorityId) {
      return res.status(400).json({ error: { message: 'category_id and authority_id must be positive integers.' } });
    }

    const result = await db.query(
      'DELETE FROM category_authority_map WHERE category_id = $1 AND authority_id = $2',
      [categoryId, authorityId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: 'Category-authority mapping not found.' } });
    }

    res.json({ message: 'Mapping removed successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Weekly Report Exports (CSV/PDF metadata + downloads)
// ============================================================================

const listWeeklyExports = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const authorityId =
      req.query.authority_id === undefined || req.query.authority_id === ''
        ? null
        : parsePositiveInt(req.query.authority_id);

    if (req.query.authority_id !== undefined && req.query.authority_id !== '' && !authorityId) {
      return res.status(400).json({ error: { message: 'authority_id must be a positive integer.' } });
    }

    const formatFilter = req.query.format ? String(req.query.format).trim().toLowerCase() : '';
    if (formatFilter && !['csv', 'pdf'].includes(formatFilter)) {
      return res.status(400).json({ error: { message: 'format must be either csv or pdf.' } });
    }

    const params = [];
    // Only expose weekly exports with attached files.
    const conditions = ["sr.report_file_url IS NOT NULL", "sr.report_period = 'weekly'::report_period"];

    if (authorityId) {
      params.push(authorityId);
      conditions.push(`sr.authority_id = $${params.length}`);
    }

    if (formatFilter) {
      params.push(formatFilter);
      conditions.push(`LOWER(sr.report_file_type) = $${params.length}`);
    }

    params.push(limit);
    const query = `
      SELECT
        sr.id,
        sr.authority_id,
        a.name AS authority_name,
        sr.ward_id,
        w.name AS ward_name,
        sr.period_start,
        sr.period_end,
        sr.total_issues,
        sr.open_issues,
        sr.resolved_issues,
        sr.pending_issues,
        sr.escalated_issues,
        sr.generated_at,
        sr.report_file_url,
        sr.report_file_type
      FROM summary_reports sr
      JOIN authorities a ON a.id = sr.authority_id
      LEFT JOIN wards w ON w.id = sr.ward_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sr.generated_at DESC
      LIMIT $${params.length}
    `;

    const result = await db.query(query, params);
    res.json({ exports: result.rows });
  } catch (error) {
    next(error);
  }
};

const generateWeeklyExport = async (req, res, next) => {
  try {
    const authorityId = parsePositiveInt(req.body?.authority_id);
    const wardIdRaw = req.body?.ward_id;
    const wardId =
      wardIdRaw === undefined || wardIdRaw === null || wardIdRaw === '' ? null : parsePositiveInt(wardIdRaw);
    const format = String(req.body?.format || 'csv').trim().toLowerCase();

    if (!authorityId) {
      return res.status(400).json({ error: { message: 'authority_id is required and must be a positive integer.' } });
    }

    if (wardIdRaw !== undefined && wardIdRaw !== null && wardIdRaw !== '' && !wardId) {
      return res.status(400).json({ error: { message: 'ward_id must be a positive integer when provided.' } });
    }

    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: { message: 'format must be either csv or pdf.' } });
    }

    let dateWindow;
    try {
      dateWindow = resolveDateWindow({
        periodStartRaw: req.body?.period_start,
        periodEndRaw: req.body?.period_end,
      });
    } catch (windowError) {
      return res.status(400).json({ error: { message: windowError.message } });
    }

    // Validate authority/ward before export work.
    const authorityRes = await db.query('SELECT id, name FROM authorities WHERE id = $1', [authorityId]);
    if (authorityRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Authority not found.' } });
    }

    if (wardId) {
      const wardRes = await db.query('SELECT id FROM wards WHERE id = $1', [wardId]);
      if (wardRes.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Ward not found.' } });
      }
    }

    const scopedParams = [authorityId, dateWindow.fromTimestamp, dateWindow.toTimestamp];
    let wardFilter = '';
    if (wardId) {
      scopedParams.push(wardId);
      wardFilter = `AND r.ward_id = $${scopedParams.length}`;
    }

    // Export unresolved reports mapped or escalated to this authority.
    const unresolvedRes = await db.query(
      `SELECT
         r.id,
         r.tracking_number,
         r.title,
         r.status,
         r.created_at,
         c.name AS category_name,
         w.name AS ward_name,
         $1::INT AS authority_id,
         $${wardId ? 5 : 4}::TEXT AS authority_name
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN wards w ON w.id = r.ward_id
       WHERE r.status <> 'resolved'
         AND r.created_at >= $2
         AND r.created_at <= $3
         ${wardFilter}
         AND (
           EXISTS (
             SELECT 1
             FROM category_authority_map cam
             WHERE cam.category_id = r.category_id
               AND cam.authority_id = $1
           )
           OR EXISTS (
             SELECT 1
             FROM escalations esc
             WHERE esc.report_id = r.id
               AND esc.authority_id = $1
           )
         )
       ORDER BY r.created_at ASC`,
      wardId
        ? [...scopedParams, authorityRes.rows[0].name]
        : [...scopedParams, authorityRes.rows[0].name]
    );

    const rows = unresolvedRes.rows;

    // Metrics feed both file output and metadata row.
    const pendingIssues = rows.filter((row) => row.status === 'pending').length;
    const openIssues = rows.filter((row) => row.status === 'in-progress').length;
    const resolvedIssues = rows.filter((row) => row.status === 'resolved').length;

    const categoryFrequency = rows.reduce((acc, row) => {
      const key = row.category_name || 'Uncategorized';
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map());

    let topCategory = null;
    for (const [categoryName, count] of categoryFrequency.entries()) {
      if (!topCategory || count > topCategory.count) {
        topCategory = { name: categoryName, count };
      }
    }

    ensureReportExportsDir();
    const filename = buildExportFilename({
      authorityId,
      periodStart: dateWindow.periodStart,
      periodEnd: dateWindow.periodEnd,
      format,
    });

    const absolutePath = path.join(REPORT_EXPORTS_DIR, filename);
    const publicUrl = `/uploads/reports/${filename}`;

    // Write file first, then save metadata pointer.
    if (format === 'csv') {
      createCsvWeeklyExport({ filePath: absolutePath, rows });
    } else {
      await createPdfWeeklyExport({
        filePath: absolutePath,
        rows,
        authorityName: authorityRes.rows[0].name,
        periodStart: dateWindow.periodStart,
        periodEnd: dateWindow.periodEnd,
      });
    }

    const escalatedRes = await db.query(
      `SELECT COUNT(*)::INT AS escalated_issues
       FROM escalations e
       JOIN reports r ON r.id = e.report_id
       WHERE e.authority_id = $1
         AND e.escalated_at >= $2
         AND e.escalated_at <= $3
         ${wardFilter}`,
      scopedParams
    );

    // Persist export metadata for admin listing/download.
    const insertRes = await db.query(
      `INSERT INTO summary_reports (
         authority_id,
         ward_id,
         report_period,
         period_start,
         period_end,
         total_issues,
         open_issues,
         resolved_issues,
         pending_issues,
         escalated_issues,
         avg_resolution_days,
         top_category,
         report_notes,
         generated_at,
         report_file_url,
         report_file_type
       ) VALUES (
         $1,
         $2,
         'weekly',
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         NULL,
         $10,
         $11,
         NOW(),
         $12,
         $13
       )
       RETURNING
         id,
         authority_id,
         ward_id,
         period_start,
         period_end,
         total_issues,
         open_issues,
         resolved_issues,
         pending_issues,
         escalated_issues,
         generated_at,
         report_file_url,
         report_file_type`,
      [
        authorityId,
        wardId,
        dateWindow.periodStart,
        dateWindow.periodEnd,
        rows.length,
        openIssues,
        resolvedIssues,
        pendingIssues,
        Number(escalatedRes.rows[0]?.escalated_issues || 0),
        topCategory?.name || null,
        `${WEEKLY_REPORT_PERIOD}_export:${format}`,
        publicUrl,
        format,
      ]
    );

    await recordAuditTrail({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'admin_weekly_export_generated',
      notes: `Generated ${format.toUpperCase()} weekly export`,
      metadata: {
        module: 'Admin Weekly Exports',
        authority_id: authorityId,
        ward_id: wardId,
        period_start: dateWindow.periodStart,
        period_end: dateWindow.periodEnd,
        format,
        summary_report_id: insertRes.rows[0].id,
      },
    });

    res.status(201).json({
      message: `Weekly ${format.toUpperCase()} export generated successfully.`,
      export: {
        ...insertRes.rows[0],
        authority_name: authorityRes.rows[0].name,
      },
    });
  } catch (error) {
    next(error);
  }
};

const downloadWeeklyExport = async (req, res, next) => {
  try {
    const exportId = parseInt(req.params.id, 10);
    if (!Number.isInteger(exportId) || exportId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid export id.' } });
    }

    const result = await db.query(
      `SELECT
         sr.id,
         sr.authority_id,
         a.name AS authority_name,
         sr.period_start,
         sr.period_end,
         sr.report_file_url,
         sr.report_file_type
       FROM summary_reports sr
       JOIN authorities a ON a.id = sr.authority_id
       WHERE sr.id = $1`,
      [exportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Export not found.' } });
    }

    const exportRow = result.rows[0];
    if (!exportRow.report_file_url) {
      return res.status(404).json({ error: { message: 'This export has no file attached.' } });
    }

    const relativePath = String(exportRow.report_file_url)
      .replace(/^\/uploads\//, '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/');

    const uploadsRoot = path.normalize(path.join(__dirname, '..', 'uploads'));
    const absolutePath = path.normalize(path.join(__dirname, '..', relativePath));
    const uploadsRootWithSep = uploadsRoot.endsWith(path.sep)
      ? uploadsRoot
      : `${uploadsRoot}${path.sep}`;

    // Block path traversal outside uploads/.
    if (absolutePath !== uploadsRoot && !absolutePath.startsWith(uploadsRootWithSep)) {
      return res.status(400).json({ error: { message: 'Invalid export file path.' } });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: { message: 'Export file not found on server.' } });
    }

    const filename = path.basename(absolutePath);
    const normalizedType = String(exportRow.report_file_type || '').toLowerCase();
    const mimeType = normalizedType === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8';

    await recordAuditTrail({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'admin_weekly_export_downloaded',
      metadata: {
        module: 'Admin Weekly Exports',
        summary_report_id: exportRow.id,
        authority_id: exportRow.authority_id,
        format: normalizedType || 'csv',
      },
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listReports, reassignReport, overrideCloseReport,
  listUsers, updateUserRole, updateUserLifecycle, deleteUser,
  listWards, createWard, updateWard, deleteWard,
  listCategories, createCategory, updateCategory, deleteCategory,
  listAuthorities, createAuthority, updateAuthority,
  listCategoryAuthorityMappings, mapCategoryToAuthority, unmapCategoryFromAuthority,
  listWeeklyExports, generateWeeklyExport, downloadWeeklyExport
};
