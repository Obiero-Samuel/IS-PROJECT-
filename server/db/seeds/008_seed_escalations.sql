-- =============================================================
-- Seed 008: Seed escalations
-- Owner: Partner B
-- NOTE: Requires issues (ids 1–5) and users (ids 1–3) to exist first.
--       Run after 003_seed_issues.sql and 001_seed_users.sql.
-- =============================================================

INSERT INTO escalations (issue_id, authority_id, escalated_by, reason, status, authority_notes, escalated_at, acknowledged_at, resolved_at) VALUES
  (1, 4, 1,
   'Road pothole has gone unrepaired for 3 months causing vehicle damage. Escalating to KENHA.',
   'resolved',
   'Road maintenance crew dispatched. Pothole filled and sealed on 2026-05-18.',
   '2026-05-01 09:00:00+03', '2026-05-03 11:00:00+03', '2026-05-20 16:00:00+03'),

  (2, 6, 1,
   'Water pipe burst flooding the road for over 2 weeks. Multiple reports ignored at ward level.',
   'acknowledged',
   'Engineering team has assessed the site. Repair scheduled for next week.',
   '2026-05-10 10:30:00+03', '2026-05-12 09:00:00+03', NULL),

  (3, 5, 2,
   'Recurring power outages affecting the business district. KPLC unresponsive to calls.',
   'pending',
   NULL,
   '2026-05-15 14:00:00+03', NULL, NULL),

  (4, 1, 2,
   'Illegal dumping site has grown unchecked for 6 weeks, posing a health hazard.',
   'acknowledged',
   'Clean-up team allocated. Environmental health officer scheduled for inspection.',
   '2026-05-20 08:00:00+03', '2026-05-22 10:00:00+03', NULL),

  (5, 9, 3,
   'Street lights have been out for 45 days along Westlands Road. Safety concern at night.',
   'rejected',
   'Issue falls under Kenya Power jurisdiction. Redirected to KPLC.',
   '2026-06-01 11:00:00+03', '2026-06-03 09:30:00+03', NULL)
ON CONFLICT DO NOTHING;
