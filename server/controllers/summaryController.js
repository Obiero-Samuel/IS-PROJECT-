/**
 * This file handles summary report generation and summary report retrieval.
 */
const db = require('../config/db');

// ============================================================================
// Summary Reports Generation & Retrieval
// ============================================================================

/**
 * POST /api/summary/generate
 * Generates or updates a summary report for a given authority (and optionally ward)
 * over a specified date range.
 */
const generateSummaryReport = async (req, res, next) => {
  try {
    const { authority_id, ward_id, report_period, period_start, period_end } = req.body;

    if (!authority_id || !report_period || !period_start || !period_end) {
      return res.status(400).json({ error: { message: 'Missing required fields for generation.' } });
    }

    // Optional ward scope.
    const wardFilter = ward_id ? `AND r.ward_id = ${parseInt(ward_id)}` : '';

    // 1) Core report metrics in this authority scope.
    const statsQuery = `
      SELECT 
        COUNT(r.id) as total_issues,
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_issues,
        COUNT(CASE WHEN r.status = 'in-progress' THEN 1 END) as open_issues,
        COUNT(CASE WHEN r.status = 'resolved' THEN 1 END) as resolved_issues,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/86400) as avg_resolution_days
      FROM reports r
      JOIN category_authority_map cam ON r.category_id = cam.category_id
      WHERE cam.authority_id = $1 
        ${wardFilter}
        AND r.created_at >= $2 
        AND r.created_at <= $3
    `;

    const statsRes = await db.query(statsQuery, [authority_id, period_start, period_end]);
    const stats = statsRes.rows[0];

    // 2) Escalation volume in same window.
    const escQuery = `
      SELECT COUNT(id) as escalated_issues
      FROM escalations
      WHERE authority_id = $1
        AND escalated_at >= $2 
        AND escalated_at <= $3
    `;
    const escRes = await db.query(escQuery, [authority_id, period_start, period_end]);
    const escalated_issues = escRes.rows[0].escalated_issues;

    // 3) Top category for summary narration.
    const topCatQuery = `
      SELECT c.name, COUNT(r.id) as count
      FROM reports r
      JOIN categories c ON r.category_id = c.id
      JOIN category_authority_map cam ON r.category_id = cam.category_id
      WHERE cam.authority_id = $1 
        ${wardFilter}
        AND r.created_at >= $2 
        AND r.created_at <= $3
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 1
    `;
    const topCatRes = await db.query(topCatQuery, [authority_id, period_start, period_end]);
    const top_category = topCatRes.rows.length > 0 ? topCatRes.rows[0].name : null;

    // 4) Upsert one canonical row per summary period key.
    const upsertQuery = `
      INSERT INTO summary_reports (
        authority_id, ward_id, report_period, period_start, period_end,
        total_issues, open_issues, resolved_issues, pending_issues,
        escalated_issues, avg_resolution_days, top_category, generated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      ON CONFLICT (authority_id, ward_id, report_period, period_start)
      DO UPDATE SET
        period_end = EXCLUDED.period_end,
        total_issues = EXCLUDED.total_issues,
        open_issues = EXCLUDED.open_issues,
        resolved_issues = EXCLUDED.resolved_issues,
        pending_issues = EXCLUDED.pending_issues,
        escalated_issues = EXCLUDED.escalated_issues,
        avg_resolution_days = EXCLUDED.avg_resolution_days,
        top_category = EXCLUDED.top_category,
        generated_at = EXCLUDED.generated_at
      RETURNING *;
    `;

    const upsertParams = [
      authority_id,
      ward_id || null,
      report_period,
      period_start,
      period_end,
      stats.total_issues || 0,
      stats.open_issues || 0,
      stats.resolved_issues || 0,
      stats.pending_issues || 0,
      escalated_issues || 0,
      stats.avg_resolution_days || 0,
      top_category
    ];

    const finalRes = await db.query(upsertQuery, upsertParams);

    res.status(201).json({ message: 'Summary report generated', report: finalRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/summary
 */
const listSummaryReports = async (req, res, next) => {
  try {
    const { authority_id } = req.query;
    let query = 'SELECT * FROM summary_reports';
    let params = [];

    // Optional authority filter.
    if (authority_id) {
      query += ' WHERE authority_id = $1';
      params.push(authority_id);
    }

    query += ' ORDER BY period_start DESC';

    const result = await db.query(query, params);
    res.json({ reports: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/summary/:id
 */
const getSummaryReportById = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    // Join names to avoid extra frontend lookups.
    const result = await db.query(
      `SELECT sr.*, a.name as authority_name, w.name as ward_name
       FROM summary_reports sr
       JOIN authorities a ON sr.authority_id = a.id
       LEFT JOIN wards w ON sr.ward_id = w.id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Report not found' } });
    res.json({ report: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateSummaryReport,
  listSummaryReports,
  getSummaryReportById
};
