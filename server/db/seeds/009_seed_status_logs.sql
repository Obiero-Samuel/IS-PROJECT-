-- =============================================================
-- Seed 009: Seed status_logs
-- Owner: Partner B
-- NOTE: Requires issues (ids 1–5) and users (ids 1–3) to exist.
--       status_logs is append-only — no UPDATE/DELETE allowed.
-- =============================================================

INSERT INTO status_logs (issue_id, changed_by, old_status, new_status, notes, changed_at) VALUES
  -- Issue 1: pothole, full lifecycle
  (1, 1, NULL,         'open',        'Issue reported by citizen.',                                          '2026-04-10 08:00:00+03'),
  (1, 2, 'open',       'in_review',   'Ward officer confirmed and assigned to maintenance queue.',            '2026-04-12 10:00:00+03'),
  (1, 2, 'in_review',  'escalated',   'No action after 2 weeks. Escalated to KENHA.',                       '2026-05-01 09:00:00+03'),
  (1, 2, 'escalated',  'resolved',    'KENHA maintenance crew repaired pothole. Verified by officer.',       '2026-05-20 16:00:00+03'),

  -- Issue 2: water pipe, still in progress
  (2, 1, NULL,         'open',        'Burst pipe reported. Photos attached.',                               '2026-04-25 07:30:00+03'),
  (2, 3, 'open',       'in_review',   'Nairobi Water team notified.',                                        '2026-04-26 09:00:00+03'),
  (2, 3, 'in_review',  'escalated',   'No repair after 2 weeks. Escalated to county authority.',            '2026-05-10 10:30:00+03'),

  -- Issue 3: power outage
  (3, 1, NULL,         'open',        'Power cuts reported affecting 3 streets.',                            '2026-05-12 06:00:00+03'),
  (3, 2, 'open',       'in_review',   'Forwarded to KPLC liaison.',                                         '2026-05-13 08:00:00+03'),
  (3, 3, 'in_review',  'escalated',   'KPLC unresponsive. Formal escalation filed.',                        '2026-05-15 14:00:00+03'),

  -- Issue 4: illegal dumping
  (4, 1, NULL,         'open',        'Dumping site growing. Multiple residents complaining.',               '2026-05-05 09:00:00+03'),
  (4, 2, 'open',       'in_review',   'Environmental health officer alerted.',                               '2026-05-07 10:00:00+03'),
  (4, 2, 'in_review',  'escalated',   'Still no action after 2 weeks. County escalated.',                   '2026-05-20 08:00:00+03'),

  -- Issue 5: street lights
  (5, 1, NULL,         'open',        'Street lights on Westlands Road broken since last month.',            '2026-05-18 19:00:00+03'),
  (5, 3, 'open',       'in_review',   'Sub-county office reviewing responsibility.',                        '2026-05-20 09:00:00+03'),
  (5, 3, 'in_review',  'escalated',   'Escalated to Westlands Sub-County for urgent action.',               '2026-06-01 11:00:00+03'),
  (5, 3, 'escalated',  'closed',      'Redirected to Kenya Power. Issue closed here.',                      '2026-06-03 09:30:00+03')
ON CONFLICT DO NOTHING;
