# IS PROJECT — Combined Entity Relationship Diagram
### Chapter 4 · System Design · ERD Section

> **Diagram format**: Mermaid ER Diagram — renders natively on GitHub and most Markdown viewers.
> **Ownership**: Partner A owns tables 1–5 · Partner B owns tables 6–10.

---

```mermaid
erDiagram

  %% =========================================================
  %% PARTNER A TABLES
  %% =========================================================

  users {
    int     id            PK
    string  full_name
    string  email         UK
    string  password_hash
    string  role
    int     ward_id       FK
    boolean is_active
    timestamp created_at
    timestamp updated_at
  }

  categories {
    int     id    PK
    string  name  UK
    string  description
    string  icon
    boolean is_active
    timestamp created_at
  }

  issues {
    int     id           PK
    int     user_id      FK
    int     category_id  FK
    int     ward_id      FK
    string  title
    text    description
    string  status
    string  priority
    float   latitude
    float   longitude
    string  image_url
    timestamp created_at
    timestamp updated_at
  }

  comments {
    int     id        PK
    int     issue_id  FK
    int     user_id   FK
    text    body
    boolean is_flagged
    timestamp created_at
  }

  votes {
    int     id        PK
    int     issue_id  FK
    int     user_id   FK
    string  vote_type
    timestamp created_at
  }

  %% =========================================================
  %% PARTNER B TABLES
  %% =========================================================

  authorities {
    int     id             PK
    string  name
    string  type
    string  jurisdiction
    string  contact_email
    string  phone
    string  website
    boolean is_active
    timestamp created_at
    timestamp updated_at
  }

  wards {
    int     id            PK
    string  name
    string  code          UK
    string  county
    string  constituency
    int     authority_id  FK
    float   latitude
    float   longitude
    int     population
    boolean is_active
    timestamp created_at
    timestamp updated_at
  }

  escalations {
    int       id              PK
    int       issue_id        FK
    int       authority_id    FK
    int       escalated_by    FK
    text      reason
    string    status
    text      authority_notes
    timestamp escalated_at
    timestamp acknowledged_at
    timestamp resolved_at
    timestamp updated_at
  }

  status_logs {
    int       id          PK
    int       issue_id    FK
    int       changed_by  FK
    string    old_status
    string    new_status
    text      notes
    timestamp changed_at
  }

  summary_reports {
    int     id                   PK
    int     authority_id         FK
    int     ward_id              FK
    string  report_period
    date    period_start
    date    period_end
    int     total_issues
    int     open_issues
    int     resolved_issues
    int     pending_issues
    int     escalated_issues
    float   avg_resolution_days
    string  top_category
    text    report_notes
    timestamp generated_at
  }

  %% =========================================================
  %% RELATIONSHIPS
  %% =========================================================

  %% Users ↔ Wards (user lives in a ward)
  users         }o--o| wards          : "lives in"

  %% Issues relationships
  users         ||--o{ issues         : "reports"
  categories    ||--o{ issues         : "categorises"
  wards         ||--o{ issues         : "located in"

  %% Comments & Votes on Issues
  issues        ||--o{ comments       : "has"
  users         ||--o{ comments       : "writes"
  issues        ||--o{ votes          : "receives"
  users         ||--o{ votes          : "casts"

  %% Wards ↔ Authorities (ward managed by authority)
  authorities   ||--o{ wards          : "manages"

  %% Escalations
  issues        ||--o{ escalations    : "escalated via"
  authorities   ||--o{ escalations    : "receives"
  users         ||--o{ escalations    : "escalated by"

  %% Status Logs (audit trail)
  issues        ||--o{ status_logs    : "has audit trail"
  users         ||--o{ status_logs    : "recorded by"

  %% Summary Reports
  authorities   ||--o{ summary_reports : "generates"
  wards         |o--o{ summary_reports : "scoped to"
```

---

## Table Ownership Summary

| # | Table | Owner | Description |
|---|-------|-------|-------------|
| 1 | `users` | Partner A | Registered citizens and admin accounts |
| 2 | `categories` | Partner A | Issue classification taxonomy |
| 3 | `issues` | Partner A | Core civic issue records |
| 4 | `comments` | Partner A | Public discussion on issues |
| 5 | `votes` | Partner A | Citizen upvotes/downvotes on issues |
| 6 | `authorities` | **Partner B** | Civic/government bodies |
| 7 | `wards` | **Partner B** | Administrative geographic units |
| 8 | `escalations` | **Partner B** | Formal issue escalations to authorities |
| 9 | `status_logs` | **Partner B** | Immutable audit log of status changes |
| 10 | `summary_reports` | **Partner B** | Aggregated periodic reports |

## Key Design Decisions

- **`status_logs` is append-only** — enforced by PostgreSQL `RULE` statements preventing `UPDATE` and `DELETE`. This guarantees a tamper-proof audit trail.
- **`summary_reports` deduplication** — a `UNIQUE` constraint on `(authority_id, ward_id, report_period, period_start)` prevents duplicate reports for the same scope and time window.
- **Soft deletes on reference tables** — `authorities` and `wards` use an `is_active` flag instead of hard deletion so historical escalations and reports remain intact.
- **`set_updated_at()` trigger** — a shared reusable trigger function keeps `updated_at` accurate across `authorities`, `wards`, and `escalations` without duplicating logic.
- **`ward_id` nullable on `summary_reports`** — a `NULL` ward means the report covers the authority's entire jurisdiction, allowing both granular and aggregate views.
