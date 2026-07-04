-- =============================================================
-- Seed 012: Seed default report categories
-- Purpose: Provide resident-facing categories for report submission dropdowns
-- =============================================================

INSERT INTO categories (name, description)
VALUES
  ('Roads & Potholes', 'Potholes, road surface damage, blocked lanes, and unsafe road conditions.'),
  ('Street Lighting', 'Broken, flickering, or missing public street lights.'),
  ('Water Supply', 'Water outages, low pressure, leaks, burst pipes, and supply interruptions.'),
  ('Drainage & Flooding', 'Blocked drains, flooding hotspots, storm-water overflow, and poor drainage.'),
  ('Waste Management', 'Uncollected garbage, illegal dumping, overflowing bins, and waste accumulation.'),
  ('Sanitation & Sewage', 'Sewage leaks, foul odors, blocked sewer lines, and sanitation hazards.'),
  ('Public Safety', 'Unsafe public spaces, exposed hazards, and urgent community safety concerns.'),
  ('Parks & Public Spaces', 'Damaged playgrounds, neglected parks, and broken public amenities.'),
  ('Noise & Nuisance', 'Persistent loud noise, disruptive public nuisance, or disturbance complaints.'),
  ('Other / General', 'General civic issues that do not clearly fit another category.')
ON CONFLICT (name) DO NOTHING;