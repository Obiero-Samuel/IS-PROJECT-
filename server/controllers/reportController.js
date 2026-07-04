/**
 * This file handles report submission, listing, detail lookup, and upvote actions.
 */
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { recordAuditTrail } = require('../services/flowAuditService');

// Tracking number format: CP-YYYYMMDD-XXXX.
const generateTrackingNumber = () => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const randomPart = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4);
  return `CP-${datePart}-${randomPart}`;
};

// ---------------------------------------------------------------------------
// GET /api/reports/categories  (public)
// ---------------------------------------------------------------------------
const getCategories = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, description
       FROM categories
       ORDER BY name ASC`
    );

    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/reports  (auth required)
// Accepts multipart/form-data
// ---------------------------------------------------------------------------
const createReport = async (req, res, next) => {
  try {
    const { title, description, category_id, ward_id, latitude, longitude, location_address } = req.body;

    if (!title || !description || !category_id) {
      return res.status(400).json({ error: { message: 'title, description, and category_id are required.' } });
    }

    // Guard foreign-key references before insert.
    const catCheck = await db.query('SELECT id FROM categories WHERE id = $1', [category_id]);
    if (catCheck.rows.length === 0) {
      return res.status(400).json({ error: { message: 'Invalid category_id.' } });
    }

    // Resolve ward from payload or authenticated resident context.
    const parsedWardId = Number(ward_id || req.user.ward_id);
    if (!Number.isInteger(parsedWardId) || parsedWardId <= 0) {
      return res.status(400).json({ error: { message: 'ward_id is required for resident report submission.' } });
    }

    const wardCheck = await db.query('SELECT id FROM wards WHERE id = $1', [parsedWardId]);
    if (wardCheck.rows.length === 0) {
      return res.status(400).json({ error: { message: 'Invalid ward_id.' } });
    }

    // Save media path only when a file is uploaded.
    const media_url = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    // Retry on rare tracking-number collisions.
    let tracking_number;
    let attempts = 0;
    while (attempts < 5) {
      tracking_number = generateTrackingNumber();
      const collision = await db.query(
        'SELECT id FROM reports WHERE tracking_number = $1',
        [tracking_number]
      );
      if (collision.rows.length === 0) break;
      attempts++;
    }

    // Insert report and mirror event to audit trail.
    const result = await db.query(
      `INSERT INTO reports
         (user_id, category_id, ward_id, title, description, latitude, longitude,
          location_address, media_url, tracking_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, tracking_number, title, status, ward_id, created_at`,
      [
        req.user.id,
        category_id,
        parsedWardId,
        title,
        description,
        latitude || null,
        longitude || null,
        location_address || null,
        media_url,
        tracking_number
      ]
    );

    await recordAuditTrail({
      reportId: result.rows[0].id,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actionType: 'report_submitted',
      newStatus: result.rows[0].status,
      metadata: {
        module: 'Report Submission',
        category_id: Number(category_id),
        ward_id: parsedWardId,
        tracking_number: result.rows[0].tracking_number,
      },
    });

    res.status(201).json({
      message: 'Report submitted successfully.',
      report: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/reports  (public)
// Query params: ?category_id=&status=&page=1&limit=10
// ---------------------------------------------------------------------------
const getReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    // Compose optional list filters.
    const conditions = ['r.resident_deleted_at IS NULL'];
    const params = [];

    if (req.query.category_id) {
      params.push(req.query.category_id);
      conditions.push(`r.category_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`r.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const dataQuery = `
      SELECT
        r.id, r.tracking_number, r.title, r.description,
        r.latitude, r.longitude, r.location_address,
        r.status, r.media_url, r.created_at,
        c.name AS category_name,
        u.username AS submitted_by,
        COUNT(uv.report_id)::int AS upvote_count
      FROM reports r
      LEFT JOIN categories c ON c.id = r.category_id
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN upvotes uv ON uv.report_id = r.id
      ${whereClause}
      GROUP BY r.id, c.name, u.username
      ORDER BY r.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    // Run list and count together for pagination metadata.
    const countParams = params.slice(0, params.length - 2);
    const countQuery = `
      SELECT COUNT(*) FROM reports r ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, params),
      db.query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      reports: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/reports/mine  (auth required)
// ---------------------------------------------------------------------------
const getMyReports = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         r.id, r.tracking_number, r.title, r.description,
         r.latitude, r.longitude, r.location_address,
         r.status, r.media_url, r.created_at,
         c.name AS category_name,
         COUNT(uv.report_id)::int AS upvote_count
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN upvotes uv ON uv.report_id = r.id
       WHERE r.user_id = $1
         AND r.resident_deleted_at IS NULL
       GROUP BY r.id, c.name
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/reports/:id  (public)
// ---------------------------------------------------------------------------
const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
         r.id, r.tracking_number, r.title, r.description,
         r.latitude, r.longitude, r.location_address,
         r.status, r.media_url, r.created_at, r.updated_at,
         c.name AS category_name,
         u.username AS submitted_by,
         COUNT(uv.report_id)::int AS upvote_count
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN upvotes uv ON uv.report_id = r.id
       WHERE r.id = $1
         AND r.resident_deleted_at IS NULL
       GROUP BY r.id, c.name, u.username`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Report not found.' } });
    }

    res.json({ report: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/reports/:id/upvote  (auth required) — toggles upvote
// ---------------------------------------------------------------------------
const upvoteReport = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    const userId = req.user.id;

    // Upvotes require an existing report.
    const reportCheck = await db.query(
      'SELECT id FROM reports WHERE id = $1 AND resident_deleted_at IS NULL',
      [reportId]
    );
    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Report not found or no longer available.' } });
    }

    // Toggle existing upvote on/off.
    const existing = await db.query(
      'SELECT * FROM upvotes WHERE user_id = $1 AND report_id = $2',
      [userId, reportId]
    );

    let action;
    if (existing.rows.length > 0) {
      await db.query(
        'DELETE FROM upvotes WHERE user_id = $1 AND report_id = $2',
        [userId, reportId]
      );
      action = 'removed';
    } else {
      await db.query(
        'INSERT INTO upvotes (user_id, report_id) VALUES ($1, $2)',
        [userId, reportId]
      );
      action = 'added';
    }

    // Return fresh vote count.
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS upvote_count FROM upvotes WHERE report_id = $1',
      [reportId]
    );

    res.json({
      message: `Upvote ${action}.`,
      upvoted: action === 'added',
      upvote_count: countResult.rows[0].upvote_count
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/reports/:id  (resident owner only, one-time soft delete)
// ---------------------------------------------------------------------------
const deleteMyReport = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id, 10);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid report id.' } });
    }

    const userId = req.user.id;

    // Soft delete only once per report by owner.
    const updateResult = await db.query(
      `UPDATE reports
       SET resident_deleted_at = NOW(),
           resident_deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND resident_deleted_at IS NULL
       RETURNING id, tracking_number, resident_deleted_at`,
      [reportId, userId]
    );

    if (updateResult.rows.length === 0) {
      const reportStateRes = await db.query(
        `SELECT resident_deleted_at
         FROM reports
         WHERE id = $1
           AND user_id = $2
         LIMIT 1`,
        [reportId, userId]
      );

      if (reportStateRes.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Report not found in your account.' } });
      }

      if (reportStateRes.rows[0].resident_deleted_at) {
        return res.status(409).json({
          error: { message: 'This report has already been deleted once and cannot be deleted again.' }
        });
      }

      return res.status(409).json({ error: { message: 'Report deletion could not be completed.' } });
    }

    const deletedReport = updateResult.rows[0];

    await recordAuditTrail({
      actorUserId: userId,
      actorRole: req.user.role,
      actionType: 'resident_report_deleted',
      notes: 'Resident deleted own report.',
      metadata: {
        module: 'Resident Reports',
        report_id: deletedReport.id,
        tracking_number: deletedReport.tracking_number,
        deleted_at: deletedReport.resident_deleted_at,
      },
    });

    res.json({
      message: 'Report deleted successfully.',
      report_id: deletedReport.id,
      deleted_at: deletedReport.resident_deleted_at,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategories,
  createReport,
  getReports,
  getMyReports,
  getReportById,
  upvoteReport,
  deleteMyReport
};
