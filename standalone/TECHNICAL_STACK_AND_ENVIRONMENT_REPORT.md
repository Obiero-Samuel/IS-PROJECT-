# Technical Stack and Environment (Student Version)

## 1) Controlled Development Environment and Design Expectations

Our system was built in a controlled local environment where each part has its own responsibility:

- `client/` = frontend (Next.js)
- `server/` = backend API (Node.js + Express)
- PostgreSQL = database

This structure helped us meet our design expectations:

- **Modularity**: each feature has separate routes/controllers (auth, reports, officer, admin, analytics).
- **Separation of concerns**: UI logic stays in frontend, business logic in backend, data storage in PostgreSQL.
- **Scalability**: new modules can be added without rewriting the full system architecture.
- **Maintainability**: migration-based DB updates and organized folders make updates safer.

---

## 2) Hardware Environment and Concurrent Processing Capacity

The project was developed and tested on:

- **OS**: Windows 11 Home Insider Preview Single Language
- **CPU**: AMD Ryzen 5 7530U (6 cores / 12 logical processors)
- **RAM**: 15.35 GB

This hardware can run frontend server, backend server, PostgreSQL, and browser concurrently. Node.js uses asynchronous I/O, so it handles multiple user/API operations efficiently for this project scale.

---

## 3) Backend Language and Framework Choice

Backend stack:

- **Language**: JavaScript (Node.js)
- **Framework**: Express.js

Why this was suitable:

- Easy API routing and middleware structure.
- Secure authentication support using `jsonwebtoken` and `cookie-parser`.
- Database integration using `pg` connection pooling.
- Supports scheduled automation using `node-cron`.

This choice directly supports our goal: secure and trackable issue reporting with role-based access.

---

## 4) Frontend Technology Choice and User Experience

Frontend stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- CSS Modules

This frontend combination was selected to support structure, consistency, and maintainability. Next.js App Router provides clear route organization, React supports reusable UI components, TypeScript improves type safety between frontend and backend contracts, and CSS Modules isolate styling per page/component to reduce style conflicts.

UX benefits:

- Clear role-based pages (`/my-profile`, `/officer`, `/admin`, `/analytics`).
- Responsive layout for different screen sizes.
- Reusable components for consistent dashboard behavior.
- TypeScript reduced UI/API mismatches during development.

Together, these choices provide a responsive and intuitive interface that reduces user confusion, improves navigation clarity, and supports faster task completion for residents, authority officers, and administrators.

---

## 5) Database Management

Database platform: **PostgreSQL**

PostgreSQL was selected to maintain strong relational consistency across users, reports, categories, wards, authorities, escalations, status logs, analytics snapshots, and automation sessions. Foreign keys, unique constraints, and transactional updates preserve data integrity during critical operations such as status changes, escalations, admin reassignment, and export generation. Schema updates are applied through ordered SQL migrations tracked in `_migrations`, and seed scripts provide repeatable baseline data for development and testing.

This setup supports decision-making outputs by ensuring data remains reliable from input to reporting, and it directly reflects the ERD-driven design model used in analysis. Supporting evidence is provided in **Appendix B1** (database verification queries and row checks), **Appendix C03** (core report storage flow evidence), and **Appendix E1** (approved ERD and design diagrams).

---

## 6) IDE, Version Control, and Ordered Development Steps

Primary development tools:

- **IDE**: Visual Studio Code
- **Version Control**: Git

VS Code was used for coding, debugging, lint/build validation, and staged module integration across frontend and backend layers. Git was used to maintain ordered implementation steps through incremental commits, change reviews, and traceable updates to files, routes, controllers, migrations, and UI modules. This combination ensured that each development action had a visible history, making it possible to trace when a feature was added, corrected, or extended during the SDLC lifecycle.

Ordered traceability was reinforced by numbered migrations, modular file structure, and feature-by-feature implementation flow (authentication, reporting, officer workflow, admin oversight, analytics, then backup automation). Supporting evidence is provided in **Appendix A2** (quality-gate run outputs), **Appendix E2** (diagram-to-module mapping and FR/NFR trace), and **Appendix E3** (version-control history screenshots/log trail).

---

## 7) Automated Backup Strategy (Implemented)

Automated backup is integrated into the backend environment through `server/scripts/auto_postgres_backups.ps1`. The strategy performs timestamped PostgreSQL backup generation, compression, retention cleanup, and scheduled execution via Windows Task Scheduler. The job `ISProject-Postgres-AutoBackup` runs daily at 02:00 and stores outputs in `server/backups/db`, with manual trigger options retained for controlled recovery operations.

Operational commands are defined in `server/package.json`:

- `npm run db:backup:dryrun`
- `npm run db:backup`
- `npm run db:backup:register`

This procedure protects against permanent data loss and corruption risks by keeping periodic backup points, reducing dependency on ad-hoc manual exports, and maintaining predictable retention behavior. In practice, this preserves the long-term value of collected civic-reporting data and supports restoration readiness after failures. Supporting evidence is provided in **Appendix A4** (backup dry-run output), **Appendix A5** (scheduled task status), and **Appendix E4** (backup configuration and storage-path capture).

---

## 8) Alignment with Analysis and Design Diagrams (Business Logic + Data Flow)

Implementation logic follows the approved analysis/design flow and remains consistent with the IPO+S conceptual model and ERD structure. The data path is preserved as: **Input** (resident/officer/admin actions) → **Processing** (auth, routing, status/escalation, analytics logic) → **Storage** (PostgreSQL relational tables and logs) → **Output** (dashboards, reports, exports, and monitoring views). Each major process in the design is mapped to implemented modules and endpoints, preventing undocumented process additions or dropped functional requirements.

Business logic alignment is visible in the route-controller contracts used by the deployed modules (auth, reports, officer/authority, admin, analytics, automation, summary). This confirms that the technical setup matches the designed data-flow expectations rather than introducing disconnected implementation behavior. Supporting evidence is provided in **Appendix E1** (approved diagrams), **Appendix E2** (FR/NFR-to-module trace map), and **Appendix C01–C13** (role-flow execution screenshots and outputs).

---

## 9) Stakeholder Interaction and Functional Fulfilment

The system was implemented around three main stakeholder groups:

- **Residents**: report issues and monitor progress.
- **Authority Officers**: receive assigned cases and update status/notes.
- **Administrators**: manage users, categories, wards, routing logic, and oversight dashboards.

Functional fulfilment was checked per stakeholder flow, not only per screen. That means each role had to successfully complete its full journey (login → core action → status/result feedback), matching the original analysis intention.

The implemented features align with the stated functional requirements as follows:

- **FR-01**: residents can register and log in securely with email/password.
- **FR-02**: residents can submit civic reports with category, description, and map-based location.
- **FR-03**: each report is assigned a unique tracking number and routed by category-authority mapping.
- **FR-04**: residents can view personal report status and public reports within ward scope.
- **FR-05**: residents can upvote other reports to signal urgency.
- **FR-06**: authority officers can log in, view assigned reports, update status, and add resolution notes.
- **FR-07**: overdue reports are escalated automatically based on configured deadlines.
- **FR-08**: administrators can manage users, categories, wards, and authority assignments.
- **FR-09**: the system generates weekly summary outputs for unresolved issues by ward, category, and authority.

---

## 10) Access Control and User Rights Implementation According to Design

Access control was implemented with role-aware authentication and authorization:

- Auth uses token + cookie session flow in backend middleware.
- Protected endpoints are guarded by `verifyToken`.
- Role checks are enforced with `requireRole(...)` for authority/admin-only actions.
- Resident, authority, and admin interfaces are separated by route and dashboard.
- Officer visibility is scoped by authority assignment to avoid cross-authority data leakage.

So user rights are enforced in both **navigation level** (frontend) and **API level** (backend), which matches secure-by-design expectations.

---

## 11) Non-Functional Requirement (NFR) Realisation

Main NFRs and how they were addressed:

- **Performance (≤ 3 seconds on standard 4G target):** optimized Next.js page delivery, lightweight API payloads, pagination/filtering, and indexed PostgreSQL queries were used to reduce response time.
- **Usability (first-time user without training):** role-specific dashboards, consistent navigation, clear form labels, and validation feedback were implemented to support intuitive first use.
- **Security (bcrypt + HTTPS):** passwords are stored using `bcrypt` hashing, and role-protected authenticated flows are enforced in the API. HTTPS is required for non-local deployment/evaluation environments.
- **Reliability (99% uptime target during demo/evaluation):** health checks, controlled error handling, scheduled automation jobs, and automated PostgreSQL backups reduce outage and recovery risk.
- **Scalability (expand to more Nairobi wards without redesign):** normalized ward/category/authority schema, category-authority mapping, modular backend routes/controllers, and migration-based schema evolution support extension without architectural rewrite.

Supporting evidence is provided in **Appendix A1** (health endpoint checks), **Appendix A4–A5** (backup and scheduler reliability evidence), **Appendix B1** (database verification), and **Appendix E2** (FR/NFR trace mapping).

---

## 12) Reporting and Decision Support

Decision support is provided through analytics and operational reporting:

- Weekly summary reporting is generated for unresolved issues by **ward, category, and authority**, matching the stated functional requirement.
- Scheduled analytics snapshots and automation sessions preserve periodic reporting data for trend review.
- Admin users can generate and retrieve CSV/PDF exports for governance and follow-up workflows.
- Escalation and overdue indicators provide prioritization signals for operational decision-making.
- Summary views provide management-level visibility of unresolved volume, resolution progress, and routing bottlenecks.

This converts raw issue data into actionable information for operational decisions.

Supporting evidence is provided in **Appendix C13** (reporting/analytics execution flow), **Appendix B1** (database record validation), and **Appendix E2** (requirement-to-module mapping).

---

## 13) Logic Consistency and Traceability

To keep logic consistent across design and implementation:

- Each logical module is tied to a route + controller pair.
- Database structure is versioned through ordered SQL migrations.
- Status/audit movement is logged through operational logging tables.
- Canonical naming differences are documented (conceptual `issues` mapped to implementation `reports`).

This prevents "hidden logic" and makes review/defense easier because every process can be followed from UI to API to database.

---

## 14) Control Against Unplanned or Missing Processes

To ensure no new unplanned process was introduced (and no designed process was left out), we used a simple consistency method:

1. Start from the design flow (IPO+S + role modules).
2. Map each designed process to an actual route/controller/database path.
3. Validate each mapped process with smoke checks and DB verification queries.
4. Review edge cases (auth failures, invalid input, missing records).
5. Keep a traceable evidence list in appendices.

### Core Functional Requirement Trace Example (Use Case to Implementation to Evidence)

**Use Case (core):** Resident submits an issue report and tracks status.

- **Design source:** Resident flow in the design documentation (`docs/erd/is_project_erd.md`, IPO+S section).
- **Implementation path:**
	- Frontend submission UI: `client/src/app/reports/new/page.tsx`
	- Backend route layer: `server/routes/reports.js`
	- Backend logic layer: `server/controllers/reportController.js`
	- Storage: `reports` table (+ status/audit related logs)
	- Resident tracking views: resident report pages/dashboard flows
- **Test evidence in appendices:**
	- **Appendix A1/A3:** health, startup, and API verification evidence
	- **Appendix B1:** DB validation checks in `docs/sql/pgadmin_database_check.sql`
	- **Appendix C03:** manual flow evidence (request/response screenshots and DB row confirmation for report creation and status tracking)

This gives end-to-end traceability from design intent to working output with evidence.

---

## 15) Error Messages and Error Handling Approach

Error handling is centralized and standardized to keep feedback clear:

- API errors use a consistent JSON shape with `message` and `status`.
- Validation/security errors return meaningful messages (for example invalid credentials, unauthorized role, blocked CORS origin, or file too large).
- Server-side logs capture technical details for debugging, while client-facing messages stay understandable.

This approach balances developer diagnostics and user clarity.

---

## 16) Implementation Challenges, Adjustments, and Deviations from Proposal

Main implementation challenges and how they were adjusted:

- **Authentication data consistency:** username whitespace/case mismatch caused login failures; normalization was added in auth flow.
- **Route evolution:** canonical route structure was expanded while keeping compatibility where needed.
- **Migration differences:** SQL syntax inconsistencies across migration history required careful PostgreSQL-safe handling.
- **Dashboard scope growth:** officer/admin modules needed additional fields and workflow refinements to fully satisfy role expectations.
- **Backup strategy update:** backup moved from standalone concept to integrated project automation for maintainability.

### Deviations from initial proposal

- No major deviation in core business objective (resident report, authority handling, admin oversight, analytics automation).
- Minor implementation-level deviations were technical refinements for reliability/security (naming compatibility, guard hardening, migration alignment, and integrated backup operations).

---

## 17) Testing for Verification and Validation (Chapter 5)

### 17.1 Comment (How this testing section should be read)

- This chapter section provides **testing narrative and structured test-case tables only**.
- **No screenshots, scripts, or raw terminal dumps are included inside Chapter 5**.
- All evidence is referenced through appendices for easier assessor cross-checking.

### 17.2 Verification and Validation Approach

Testing was conducted to ensure both:

- **Verification (Built the system right):**
	- code quality checks (`lint`, production build),
	- API contract checks (status codes and payload behavior),
	- access control checks,
	- migration/data checks,
	- backup automation checks.
- **Validation (Built the right system / fit for purpose):**
	- resident, officer, and admin end-to-end flows were tested against intended use-case behavior.

### 17.3 Brief Description of Tests Carried Out

The following testing activities were performed:

1. API smoke and negative checks (public endpoints, protected endpoint rejection without token, invalid login paths).
2. Frontend quality gate (`npm run check` → lint + production build).
3. Role-based functional tests (resident, authority officer, admin).
4. Data consistency and persistence checks against PostgreSQL.
5. Reporting and decision-support tests (analytics snapshots and weekly exports).
6. Backup automation tests (dry-run command and scheduled task state verification).

### 17.4 Manual or Automated?

| Mode | Scope | Reason |
|---|---|---|
| Manual testing | End-user journeys (resident/officer/admin), UI usability, business flow correctness | Best for validation and fit-for-purpose assessment |
| Semi-automated command checks | API smoke, lint/build, backup dry-run, scheduler status | Fast verification of technical correctness |
| Automated scheduled operation | Daily DB backup task, cron-based analytics/escalation jobs | Ongoing operational reliability |

### 17.5 Test Environment Description (ENV-01)

| Environment Item | Description |
|---|---|
| OS | Windows 11 Home Insider Preview Single Language |
| CPU | AMD Ryzen 5 7530U (6 cores / 12 logical processors) |
| RAM | 15.35 GB |
| Frontend Runtime | Next.js 16.2.9, React 19.2.4, TypeScript |
| Backend Runtime | Node.js + Express 4.19.2 |
| Database | PostgreSQL (`is_project_db`) |
| Main Local Ports | Frontend `3000`, Backend `5000` |
| Security Context | JWT + HttpOnly cookie session + role middleware |

### 17.6 Test Tools Used

| Tool | Usage |
|---|---|
| VS Code | Development and debugging environment |
| Browser (manual UAT) | End-user validation of resident/officer/admin workflows |
| PowerShell + `Invoke-WebRequest` | API smoke and negative status checks |
| npm scripts | Frontend quality gate (`npm run check`) and backup automation commands |
| PostgreSQL checks (`docs/sql/pgadmin_database_check.sql`) | Data integrity and row-count verification |

### 17.7 Test Data Used (DATA-SET-01)

| Data Group | Description |
|---|---|
| User accounts | Resident, Authority Officer, Administrator test accounts |
| Ward/category references | Existing valid IDs + invalid IDs for negative tests |
| Report payloads | Valid and invalid title/description/category/ward combinations |
| Auth payloads | Valid credentials, invalid credentials, missing fields, wrong role context |
| Export requests | CSV/PDF requests with valid and invalid period/authority combinations |

### 17.8 Results Summary

- API smoke checks in this session returned expected status classes:
	- health/public endpoints: `200`
	- validation error: `400`
	- unauthorized protected access: `401`
- Frontend quality gate passed:
	- lint passed,
	- production build passed.
- Backup automation checks passed:
	- dry-run command completed,
	- scheduled task exists and is in `Ready` state with next run time.

### 17.9 Appendix Index (Referenced from Chapter 5)

| Appendix ID | Evidence Content |
|---|---|
| Appendix A1 | API and web availability evidence (`/api/health` and frontend status `200`) |
| Appendix A2 | Frontend quality gate output (`npm run check`) |
| Appendix A3 | API smoke + negative status sweep (`T-API-01` to `T-API-07`) |
| Appendix A4 | Backup dry-run output (`npm run db:backup:dryrun`) |
| Appendix A5 | Scheduled task status (`ISProject-Postgres-AutoBackup`) |
| Appendix B1 | Database verification output from `docs/sql/pgadmin_database_check.sql` |
| Appendix C01–C13 | Functional screenshots/responses for role-based workflows |
| Appendix D01–D06 | Error-handling evidence (invalid/missing inputs and permission denials) |
| Appendix E1 | Final approved analysis and design diagrams (Use Case/DFD-UML/ERD) |
| Appendix E2 | Functional-requirement to route/controller mapping matrix (logic and data-flow trace) |
| Appendix E3 | IDE/version-control traceability evidence (`git log`, commit history screenshots) |
| Appendix E4 | Backup architecture evidence (script path, backup directory, scheduler configuration) |

All appendix screenshots and diagrams should be labelled as figures (for example, `Figure E1.1`, `Figure E2.1`) and included in the List of Figures after references.

---

## 18) Complete Individual Test Cases (Unique Functionalities)

### Test Case 1 — Resident Registration with Ward Validation

| Field | Details |
|---|---|
| Test Case ID | TC-01 |
| Type of Test | Functional + Validation + Negative |
| Functionality Tested | Resident account registration (`POST /api/auth/register`) |
| Reason for Test | Confirm new residents can register only with valid required fields and ward linkage |
| Test Environment | ENV-01 |
| Test Tool | Browser UAT + API client |
| Preconditions | `wards` table seeded with active wards |
| Test Data | Valid payload; invalid payload missing `ward_id`; invalid `ward_id` |
| Test Steps | 1) Submit valid resident form 2) Submit without ward 3) Submit invalid ward |
| Expected Result | Valid registration accepted; missing/invalid ward rejected with clear `400` message |
| Actual Result | Matched expected behavior during UAT cycle |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C01, Appendix D01 |

### Test Case 2 — Email OTP Verification

| Field | Details |
|---|---|
| Test Case ID | TC-02 |
| Type of Test | Functional + Security + Negative |
| Functionality Tested | OTP verification and resend (`/api/auth/verify-email-otp`, `/api/auth/resend-verification-otp`) |
| Reason for Test | Ensure only verified users can complete activation and login |
| Test Environment | ENV-01 |
| Test Tool | Browser UAT + API client |
| Preconditions | User exists but `is_email_verified = false` |
| Test Data | Correct OTP, incorrect OTP, expired OTP, resend flow |
| Test Steps | 1) Verify with correct OTP 2) Verify with wrong OTP 3) Request resend |
| Expected Result | Correct OTP verifies account; wrong/expired OTP returns validation error |
| Actual Result | Matched expected behavior in manual verification run |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C02, Appendix D02 |

### Test Case 3 — Login and Access Control Guard

| Field | Details |
|---|---|
| Test Case ID | TC-03 |
| Type of Test | Security + Functional + Negative |
| Functionality Tested | Login and protected-route access control |
| Reason for Test | Confirm authentication and authorization barriers enforce user rights |
| Test Environment | ENV-01 |
| Test Tool | PowerShell `Invoke-WebRequest` + Browser |
| Preconditions | Auth endpoints available |
| Test Data | Missing login fields, invalid credentials, no-token request to protected routes |
| Test Steps | 1) Submit empty login payload 2) Submit invalid credentials 3) Call `/api/officer/queue` and `/api/admin/users` without token |
| Expected Result | Empty payload -> `400`; invalid credentials -> `401`; protected routes without token -> `401` |
| Actual Result | Observed: `400`, `401`, `401` as expected |
| Pass/Fail | Pass |
| Appendix Reference | Appendix A3, Appendix D03 |

### Test Case 4 — Resident Report Submission

| Field | Details |
|---|---|
| Test Case ID | TC-04 |
| Type of Test | Core Functional + Integration |
| Functionality Tested | Report submission (`POST /api/reports`) |
| Reason for Test | Core requirement: resident can submit issue and get tracking number |
| Test Environment | ENV-01 |
| Test Tool | Browser UAT + API validation |
| Preconditions | Resident logged in, valid category and ward available |
| Test Data | Valid report payload with and without photo |
| Test Steps | 1) Submit report 2) Confirm tracking number response 3) Verify stored record in DB |
| Expected Result | `201` response, generated tracking number (`CP-YYYYMMDD-XXXX`), persisted report row |
| Actual Result | Matched expected behavior during core-flow UAT |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C03, Appendix B1 |

### Test Case 5 — Public/Resident Report Retrieval and Tracking

| Field | Details |
|---|---|
| Test Case ID | TC-05 |
| Type of Test | Functional + Integration |
| Functionality Tested | Report listing/detail (`GET /api/reports`, `GET /api/reports/:id`, `GET /api/reports/mine`) |
| Reason for Test | Validate report visibility and resident tracking capability |
| Test Environment | ENV-01 |
| Test Tool | PowerShell + Browser |
| Preconditions | At least one report exists |
| Test Data | Public list query (`page`, `limit`), detail by valid id, own reports query |
| Test Steps | 1) Call public list 2) Open report detail 3) Open resident “my reports” |
| Expected Result | Public endpoints return `200`; resident list includes own undeleted reports |
| Actual Result | Public list and category endpoints returned `200`; full flow matched UAT expectations |
| Pass/Fail | Pass |
| Appendix Reference | Appendix A3, Appendix C04 |

### Test Case 6 — Upvote Toggle

| Field | Details |
|---|---|
| Test Case ID | TC-06 |
| Type of Test | Functional + Regression |
| Functionality Tested | Upvote toggle (`POST /api/reports/:id/upvote`) |
| Reason for Test | Ensure engagement action is idempotent/toggle-safe and count updates correctly |
| Test Environment | ENV-01 |
| Test Tool | Browser UAT + API validation |
| Preconditions | Logged-in user and target report exist |
| Test Data | Repeated upvote calls on same report |
| Test Steps | 1) Upvote once 2) Upvote again 3) Confirm count/action changes |
| Expected Result | First call adds upvote; second call removes it; count consistent |
| Actual Result | Matched expected toggle behavior in manual run |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C05 |

### Test Case 7 — One-Time Resident Soft Delete

| Field | Details |
|---|---|
| Test Case ID | TC-07 |
| Type of Test | Functional + Negative + Data Integrity |
| Functionality Tested | Resident delete own report once (`DELETE /api/reports/:id`) |
| Reason for Test | Validate one-time soft-delete policy and prevent repeated deletion abuse |
| Test Environment | ENV-01 |
| Test Tool | API client + DB verification |
| Preconditions | Resident owns a report |
| Test Data | Same report delete request sent twice |
| Test Steps | 1) Delete own report 2) Repeat delete on same report 3) Verify soft-delete metadata |
| Expected Result | First delete succeeds; second delete returns conflict message |
| Actual Result | Matched expected one-time soft-delete behavior |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C06, Appendix B1, Appendix D04 |

### Test Case 8 — Officer Queue Retrieval and Filtering

| Field | Details |
|---|---|
| Test Case ID | TC-08 |
| Type of Test | Core Functional + Authorization |
| Functionality Tested | Officer queue (`GET /api/officer/queue` / `GET /api/authority/reports`) |
| Reason for Test | Ensure officer sees only authority-scoped assigned workload |
| Test Environment | ENV-01 |
| Test Tool | Browser officer dashboard + API checks |
| Preconditions | Officer account mapped to authority, routing mappings available |
| Test Data | Status/ward/date filters |
| Test Steps | 1) Open queue 2) Apply filters 3) Validate scope and ordering |
| Expected Result | Only scoped reports returned; invalid filters rejected with clear error |
| Actual Result | Scope and filter behavior matched expected design in UAT |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C07 |

### Test Case 9 — Officer Status Update and Resolution Note Rule

| Field | Details |
|---|---|
| Test Case ID | TC-09 |
| Type of Test | Core Functional + Business Rule + Negative |
| Functionality Tested | Status update (`PATCH /api/officer/queue/:id/status`) |
| Reason for Test | Enforce process rule: resolving a case requires notes |
| Test Environment | ENV-01 |
| Test Tool | Officer dashboard + API checks |
| Preconditions | Officer has at least one assigned report |
| Test Data | `status=resolved` with empty notes; then with valid notes |
| Test Steps | 1) Try resolve without note 2) Resolve with note 3) Verify status log entry |
| Expected Result | Without note -> `400`; with note -> success and status log update |
| Actual Result | Rule enforcement and successful update observed |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C08, Appendix D05 |

### Test Case 10 — Escalation Lifecycle

| Field | Details |
|---|---|
| Test Case ID | TC-10 |
| Type of Test | Functional + Integration |
| Functionality Tested | Escalation create/list/update (`/api/escalations` and `/api/authority/escalations`) |
| Reason for Test | Confirm escalation mechanism supports authority/admin decision workflows |
| Test Environment | ENV-01 |
| Test Tool | API checks + officer/admin UI |
| Preconditions | Eligible report exists |
| Test Data | Create escalation reason; update status to acknowledged/resolved |
| Test Steps | 1) Create escalation 2) List escalations 3) Update escalation status |
| Expected Result | Escalation records created and transitions applied with audit consistency |
| Actual Result | Escalation lifecycle behaved as expected |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C09 |

### Test Case 11 — Admin Report Oversight (Reassign + Override Close)

| Field | Details |
|---|---|
| Test Case ID | TC-11 |
| Type of Test | Core Functional + Integration + Negative |
| Functionality Tested | Admin report management (`GET /api/admin/reports`, reassign, override-close) |
| Reason for Test | Validate administrative intervention and routing correction capabilities |
| Test Environment | ENV-01 |
| Test Tool | Admin dashboard + API checks |
| Preconditions | Admin logged in; target report exists |
| Test Data | Reassign payload (authority/category/note), override-close note |
| Test Steps | 1) Filter reports 2) Reassign report 3) Override-close report |
| Expected Result | Reassignment creates escalation + log; override-close marks report resolved with admin metadata |
| Actual Result | Admin oversight actions completed as designed |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C10 |

### Test Case 12 — Admin User Lifecycle Management

| Field | Details |
|---|---|
| Test Case ID | TC-12 |
| Type of Test | Security + Functional + Negative |
| Functionality Tested | Activate/deactivate user (`PATCH /api/admin/users/:id/lifecycle`) |
| Reason for Test | Enforce governance on account state and access rights |
| Test Environment | ENV-01 |
| Test Tool | Admin dashboard + API checks |
| Preconditions | Admin logged in; target non-admin-self user exists |
| Test Data | `is_active=false` without reason; with reason; `is_active=true` |
| Test Steps | 1) Deactivate without reason 2) Deactivate with reason 3) Reactivate |
| Expected Result | Missing reason rejected; valid lifecycle updates succeed; self-deactivation prevented |
| Actual Result | Lifecycle controls behaved as expected |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C11, Appendix D06 |

### Test Case 13 — Category-Authority Mapping and Deadline SLA

| Field | Details |
|---|---|
| Test Case ID | TC-13 |
| Type of Test | Functional + Configuration Integrity |
| Functionality Tested | Mapping CRUD (`/api/admin/category-authority-map`) |
| Reason for Test | Ensure routing rules and response deadline configuration are valid and enforceable |
| Test Environment | ENV-01 |
| Test Tool | Admin dashboard + API checks |
| Preconditions | Valid category and authority records exist |
| Test Data | Valid mapping, invalid/non-positive IDs, out-of-range deadline |
| Test Steps | 1) Save mapping 2) Update deadline 3) Remove mapping |
| Expected Result | Valid mapping upserts; invalid payloads rejected; list reflects changes |
| Actual Result | Mapping behavior matched expected admin config flow |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C12 |

### Test Case 14 — Weekly Export Generation and Download

| Field | Details |
|---|---|
| Test Case ID | TC-14 |
| Type of Test | Functional + Reporting + File Handling |
| Functionality Tested | Weekly exports (`/api/admin/weekly-exports`) |
| Reason for Test | Validate decision-support artifact generation (CSV/PDF) and secure retrieval |
| Test Environment | ENV-01 |
| Test Tool | Admin dashboard + API checks |
| Preconditions | Admin logged in; unresolved report data exists |
| Test Data | `authority_id`, optional `ward_id`, `format=csv/pdf`, date window |
| Test Steps | 1) Generate export 2) List exports 3) Download by id |
| Expected Result | Export metadata saved, file generated in uploads, download returns correct content type |
| Actual Result | Weekly export flow executed successfully in UAT |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C13 |

### Test Case 15 — Analytics, Automation Sessions, and Summary Reports

| Field | Details |
|---|---|
| Test Case ID | TC-15 |
| Type of Test | Functional + Integration + Decision Support |
| Functionality Tested | Analytics (`/api/analytics`), automation (`/api/automation`), summary (`/api/summary`) |
| Reason for Test | Confirm reporting pipeline supports monitoring and management decisions |
| Test Environment | ENV-01 |
| Test Tool | API checks + admin analytics UI |
| Preconditions | Admin/authority access; data present for at least one period |
| Test Data | Limit filters, weekly trigger call, summary generation payload |
| Test Steps | 1) List analytics/latest 2) Trigger weekly analytics 3) Run automation cycle 4) List sessions 5) Generate/list summary |
| Expected Result | Snapshots and sessions stored; summary report generated and retrievable |
| Actual Result | Reporting modules behaved as expected in integration run |
| Pass/Fail | Pass |
| Appendix Reference | Appendix C13, Appendix B1 |

### Test Case 16 — Frontend Verification Quality Gate

| Field | Details |
|---|---|
| Test Case ID | TC-16 |
| Type of Test | Verification + Build/Static Quality |
| Functionality Tested | Frontend lint/build readiness (`npm run check`) |
| Reason for Test | Ensure deployable frontend build with no lint/type/build blockers |
| Test Environment | ENV-01 |
| Test Tool | npm CLI |
| Preconditions | Dependencies installed |
| Test Data | Project source code at current revision |
| Test Steps | Run `npm run check` in `client` |
| Expected Result | Lint passes and production build compiles successfully |
| Actual Result | Command completed successfully; build generated all routes |
| Pass/Fail | Pass |
| Appendix Reference | Appendix A2 |

### Test Case 17 — Backup Automation and Scheduler Validation

| Field | Details |
|---|---|
| Test Case ID | TC-17 |
| Type of Test | Non-Functional (Reliability/Recoverability) + Operational |
| Functionality Tested | Backup command and schedule (`db:backup:dryrun`, Windows Scheduled Task) |
| Reason for Test | Ensure data recovery mechanism is operational and repeatable |
| Test Environment | ENV-01 |
| Test Tool | npm CLI + PowerShell scheduled-task inspection |
| Preconditions | Backend project scripts configured |
| Test Data | Default DB parameters from `server/.env` |
| Test Steps | 1) Run dry-run backup command 2) Verify scheduled task state and next run |
| Expected Result | Dry-run completes without script errors; task exists with `Ready` state and next run time |
| Actual Result | Backup dry-run completed; scheduled task `ISProject-Postgres-AutoBackup` is `Ready` |
| Pass/Fail | Pass |
| Appendix Reference | Appendix A4, Appendix A5 |

### 18.1 Comment (Assessment Readiness)

- Each implementation statement in this chapter points to an appendix ID for evidence-based marking.
- Core functional requirements are covered in **TC-04, TC-08, TC-09, TC-11, and TC-14**.
- Verification and validation are both represented, supporting the conclusion that the system is fit for purpose and free from critical blocking errors under the tested environment.
