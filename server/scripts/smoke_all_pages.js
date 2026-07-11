require('dotenv').config();

const jwt = require('jsonwebtoken');
const db = require('../config/db');

const WEB_BASE = process.env.SMOKE_WEB_BASE || 'http://localhost:3000';
const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:5000/api';

const checks = [];
const failures = [];

const print = (message) => console.log(message);

const record = (name, pass, details = '') => {
  checks.push({ name, pass, details });
  if (!pass) failures.push({ name, details });
  const icon = pass ? '✅' : '❌';
  print(`${icon} ${name}${details ? ` — ${details}` : ''}`);
};

const assertStatus = (name, actualStatus, expectedStatus) => {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const pass = expected.includes(actualStatus);
  record(name, pass, `status=${actualStatus}; expected=${expected.join('|')}`);
  return pass;
};

const request = async (url, { method = 'GET', token, body, headers = {} } = {}) => {
  const finalHeaders = { ...headers };

  if (token) {
    finalHeaders.Cookie = `is_project_session=${token}`;
  }

  let payload;
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: payload,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    text,
    json,
    headers: response.headers,
  };
};

const createSessionToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is missing.');
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      authority_id: user.authority_id,
      is_active: true,
    },
    secret,
    { expiresIn: '30m' }
  );
};

const getRoleUser = (rows, role) => rows.find((row) => row.role === role);

(async () => {
  print('');
  print('=== IS PROJECT FULL SMOKE CHECK ===');
  print(`WEB_BASE=${WEB_BASE}`);
  print(`API_BASE=${API_BASE}`);
  print('');

  try {
    // -----------------------------------------------------------------------
    // 1) Core reachability checks
    // -----------------------------------------------------------------------
    const apiHealth = await request(`${API_BASE}/health`);
    assertStatus('API health endpoint', apiHealth.status, 200);

    const webPaths = [
      '/',
      '/login',
      '/register',
      '/verify-email',
      '/reports',
      '/reports/new',
      '/my-profile',
      '/my-reports',
      '/ward-map',
      '/officer',
      '/admin',
      '/analytics',
    ];

    for (const path of webPaths) {
      const webResponse = await request(`${WEB_BASE}${path}`);
      assertStatus(`Web route ${path}`, webResponse.status, 200);
    }

    // -----------------------------------------------------------------------
    // 2) Resolve active role users from DB
    // -----------------------------------------------------------------------
    const userQuery = await db.query(
      `SELECT id, username, email, role, authority_id, is_active
       FROM users
       WHERE is_active = true
       ORDER BY id ASC`
    );

    const residentUser = getRoleUser(userQuery.rows, 'resident');
    const authorityUser = getRoleUser(userQuery.rows, 'authority');
    const adminUser = getRoleUser(userQuery.rows, 'admin');

    record('Active resident user exists', Boolean(residentUser), residentUser ? `id=${residentUser.id}` : 'missing');
    record('Active authority user exists', Boolean(authorityUser), authorityUser ? `id=${authorityUser.id}` : 'missing');
    record('Active admin user exists', Boolean(adminUser), adminUser ? `id=${adminUser.id}` : 'missing');

    if (!residentUser || !authorityUser || !adminUser) {
      throw new Error('Cannot continue smoke checks: one or more role users are missing.');
    }

    const residentToken = createSessionToken(residentUser);
    const authorityToken = createSessionToken(authorityUser);
    const adminToken = createSessionToken(adminUser);

    const sampleReportRes = await db.query(
      `SELECT id
       FROM reports
       WHERE resident_deleted_at IS NULL
       ORDER BY id ASC
       LIMIT 1`
    );
    const sampleReportId = sampleReportRes.rows[0]?.id ?? null;

    const latestExportRes = await db.query(
      `SELECT id
       FROM summary_reports
       WHERE report_file_url IS NOT NULL
         AND report_period = 'weekly'::report_period
       ORDER BY generated_at DESC
       LIMIT 1`
    );
    let weeklyExportId = latestExportRes.rows[0]?.id ?? null;

    // -----------------------------------------------------------------------
    // 3) Public + unauth checks
    // -----------------------------------------------------------------------
    assertStatus('Public reports list', (await request(`${API_BASE}/reports`)).status, 200);
    assertStatus('Public report categories', (await request(`${API_BASE}/reports/categories`)).status, 200);
    assertStatus('Public wards list', (await request(`${API_BASE}/auth/wards`)).status, 200);

    assertStatus('Unauth /auth/me rejected', (await request(`${API_BASE}/auth/me`)).status, 401);
    assertStatus('Unauth /auth/profile rejected', (await request(`${API_BASE}/auth/profile`)).status, 401);
    assertStatus('Unauth /reports/mine rejected', (await request(`${API_BASE}/reports/mine`)).status, 401);
    assertStatus('Unauth /officer/queue rejected', (await request(`${API_BASE}/officer/queue`)).status, 401);
    assertStatus('Unauth /admin/users rejected', (await request(`${API_BASE}/admin/users`)).status, 401);
    assertStatus('Unauth /analytics rejected', (await request(`${API_BASE}/analytics`)).status, 401);
    assertStatus('Unauth /summary rejected', (await request(`${API_BASE}/summary`)).status, 401);
    assertStatus('Unauth /automation/sessions rejected', (await request(`${API_BASE}/automation/sessions`)).status, 401);

    // -----------------------------------------------------------------------
    // 4) Resident checks
    // -----------------------------------------------------------------------
    const residentMe = await request(`${API_BASE}/auth/me`, { token: residentToken });
    assertStatus('Resident /auth/me', residentMe.status, 200);
    const residentRole = residentMe.json?.user?.role;
    record('Resident role in /auth/me payload', residentRole === 'resident', `role=${residentRole ?? 'unknown'}`);

    assertStatus('Resident /auth/profile', (await request(`${API_BASE}/auth/profile`, { token: residentToken })).status, 200);
    assertStatus('Resident /reports/mine', (await request(`${API_BASE}/reports/mine`, { token: residentToken })).status, 200);
    assertStatus(
      'Resident /routing/category-authorities?category_id=1',
      (await request(`${API_BASE}/routing/category-authorities?category_id=1`, { token: residentToken })).status,
      200
    );
    assertStatus('Resident blocked from /officer/queue', (await request(`${API_BASE}/officer/queue`, { token: residentToken })).status, 403);
    assertStatus('Resident blocked from /admin/users', (await request(`${API_BASE}/admin/users`, { token: residentToken })).status, 403);
    assertStatus('Resident blocked from /summary', (await request(`${API_BASE}/summary`, { token: residentToken })).status, 403);

    if (sampleReportId) {
      assertStatus(
        'Unauth upvote rejected',
        (await request(`${API_BASE}/reports/${sampleReportId}/upvote`, { method: 'POST' })).status,
        401
      );
    } else {
      record('Upvote auth check', true, 'skipped (no sample reports available)');
    }

    // -----------------------------------------------------------------------
    // 5) Authority checks
    // -----------------------------------------------------------------------
    const officerQueue = await request(`${API_BASE}/officer/queue`, { token: authorityToken });
    assertStatus('Authority /officer/queue', officerQueue.status, 200);

    const queueItems = Array.isArray(officerQueue.json?.reports) ? officerQueue.json.reports : [];

    if (queueItems.length > 0) {
      const target = queueItems.find((item) => item.status !== 'resolved') || queueItems[0];
      const noteStamp = new Date().toISOString();

      const resolveWithoutNote = await request(`${API_BASE}/officer/queue/${target.id}/status`, {
        method: 'PATCH',
        token: authorityToken,
        body: { status: 'resolved' },
      });
      assertStatus('Authority resolve without note rejected', resolveWithoutNote.status, 400);

      const statusUpdate = await request(`${API_BASE}/officer/queue/${target.id}/status`, {
        method: 'PATCH',
        token: authorityToken,
        body: { status: 'in-progress', notes: `smoke-status-${noteStamp}` },
      });
      assertStatus('Authority status update with note', statusUpdate.status, 200);

      const addNote = await request(`${API_BASE}/officer/queue/${target.id}/notes`, {
        method: 'POST',
        token: authorityToken,
        body: { notes: `smoke-note-${noteStamp}` },
      });
      assertStatus('Authority add queue note', addNote.status, 201);
    } else {
      record('Authority queue action checks', true, 'skipped (queue empty)');
    }

    assertStatus('Authority /analytics', (await request(`${API_BASE}/analytics`, { token: authorityToken })).status, 200);
    assertStatus('Authority /summary', (await request(`${API_BASE}/summary`, { token: authorityToken })).status, 200);
    assertStatus('Authority /escalations', (await request(`${API_BASE}/escalations`, { token: authorityToken })).status, 200);
    assertStatus('Authority blocked from /admin/users', (await request(`${API_BASE}/admin/users`, { token: authorityToken })).status, 403);
    assertStatus('Authority blocked from /automation/sessions', (await request(`${API_BASE}/automation/sessions`, { token: authorityToken })).status, 403);

    // -----------------------------------------------------------------------
    // 6) Admin checks
    // -----------------------------------------------------------------------
    assertStatus('Admin /admin/users', (await request(`${API_BASE}/admin/users`, { token: adminToken })).status, 200);
    assertStatus('Admin /admin/reports', (await request(`${API_BASE}/admin/reports`, { token: adminToken })).status, 200);
    assertStatus(
      'Admin /admin/category-authority-map',
      (await request(`${API_BASE}/admin/category-authority-map`, { token: adminToken })).status,
      200
    );
    assertStatus('Admin /admin/weekly-exports', (await request(`${API_BASE}/admin/weekly-exports`, { token: adminToken })).status, 200);
    assertStatus('Admin /analytics', (await request(`${API_BASE}/analytics`, { token: adminToken })).status, 200);
    assertStatus('Admin /automation/sessions', (await request(`${API_BASE}/automation/sessions`, { token: adminToken })).status, 200);
    assertStatus('Admin /summary', (await request(`${API_BASE}/summary`, { token: adminToken })).status, 200);
    assertStatus('Admin blocked from /officer/queue', (await request(`${API_BASE}/officer/queue`, { token: adminToken })).status, 403);

    const summaryGenerate = await request(`${API_BASE}/summary/generate`, {
      method: 'POST',
      token: adminToken,
      body: {
        authority_id: authorityUser.authority_id || 1,
        report_period: 'monthly',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
      },
    });
    assertStatus('Admin summary generate', summaryGenerate.status, 201);

    const generatedSummaryId = summaryGenerate.json?.report?.id;
    if (generatedSummaryId) {
      assertStatus(
        'Admin fetch generated summary by id',
        (await request(`${API_BASE}/summary/${generatedSummaryId}`, { token: adminToken })).status,
        200
      );
    } else {
      record('Admin summary id check', false, 'generate endpoint returned no report id');
    }

    const generatedWeeklyExport = await request(`${API_BASE}/admin/weekly-exports`, {
      method: 'POST',
      token: adminToken,
      body: {
        authority_id: authorityUser.authority_id || 1,
        format: 'csv',
      },
    });

    assertStatus('Admin weekly export generate (CSV)', generatedWeeklyExport.status, 201);

    if (generatedWeeklyExport.json?.export?.id) {
      weeklyExportId = generatedWeeklyExport.json.export.id;
    }

    if (weeklyExportId) {
      const exportDownload = await request(`${API_BASE}/admin/weekly-exports/${weeklyExportId}/download`, {
        token: adminToken,
      });

      const hasCsvContentType = String(exportDownload.headers.get('content-type') || '')
        .toLowerCase()
        .includes('text/csv');

      assertStatus('Admin weekly export download', exportDownload.status, 200);
      record(
        'Admin weekly export content-type',
        hasCsvContentType,
        `content-type=${exportDownload.headers.get('content-type') || 'missing'}`
      );
    } else {
      record('Admin weekly export download check', false, 'no export id available for download test');
    }

    // -----------------------------------------------------------------------
    // 7) Final summary + exit
    // -----------------------------------------------------------------------
    print('');
    print('=== SMOKE CHECK SUMMARY ===');
    print(`Total checks: ${checks.length}`);
    print(`Passed: ${checks.filter((item) => item.pass).length}`);
    print(`Failed: ${failures.length}`);

    if (failures.length > 0) {
      print('');
      print('Failed checks:');
      failures.forEach((failure, index) => {
        print(`${index + 1}. ${failure.name}${failure.details ? ` — ${failure.details}` : ''}`);
      });
      process.exitCode = 1;
    } else {
      print('All smoke checks passed. ✅');
      process.exitCode = 0;
    }
  } catch (error) {
    print('');
    print('Smoke run terminated with an unexpected error:');
    print(error?.stack || String(error));
    process.exitCode = 1;
  } finally {
    try {
      await db.pool.end();
    } catch {
      // Ignore pool close errors in smoke script teardown.
    }
  }
})();
