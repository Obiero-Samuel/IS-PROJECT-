# IS PROJECT

A modern web application built with a Next.js frontend, Express backend, and PostgreSQL database.

## Directory Structure

- `/client` - Next.js frontend application (TypeScript, App Router, Vanilla CSS)
- `/server` - Express backend application (Node.js, PostgreSQL client connection)

## Why there are no `.html` page files

This project uses **Next.js App Router**, so pages are authored as React components in `.tsx` files (for example `client/src/app/page.tsx`, `client/src/app/login/page.tsx`).

At runtime, Next.js renders these components into real HTML that the browser receives.

- HTML shell is defined in: `client/src/app/layout.tsx` (`<html>` and `<body>`)
- Route content is defined in: `client/src/app/**/page.tsx`

So we are still using HTML on the web — it is generated from TSX instead of being hand-written in separate `.html` files.

## Prerequisites

- Node.js (v20+ recommended)
- PostgreSQL instance running locally (default port `5432`)

## Getting Started

### 1. Database Setup
Ensure PostgreSQL is running on your machine. The backend will automatically try to connect to the database `is_project_db`.
If it doesn't exist, you can create it:
```bash
createdb -U postgres is_project_db
```

### 2. Backend Setup
1. Navigate to `/server`:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the `.env` file (copy from `.env.example` and customize if needed).
4. Run the development server:
   ```bash
   npm run dev
   ```
   The backend will be running at `http://localhost:5000`.

### 2b. Database Backup Automation (Integrated)
From `/server`, you can now run and schedule PostgreSQL backups:

- `npm run db:backup:dryrun` → preview backup actions without writing files.
- `npm run db:backup` → run one real backup now.
- `npm run db:backup:register` → create/update daily Windows scheduled task at `02:00`.

Backups are stored in `server/backups/db` and old backup archives are removed using the script retention setting.

### 3. Frontend Setup
1. Navigate to `/client`:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend will be running at `http://localhost:3000`.

## Quick Verification (Supervisor Friendly)

Use the checks below to validate the project in under 3 minutes.

### Backend health
```bash
curl http://localhost:5000/api/health
```
Expected: JSON with `status: "healthy"` and `database: "connected"`.

### Frontend quality gate
```bash
cd client
npm run check
```
This runs lint + production build.

### Critical pages
- Home: `http://localhost:3000/`
- Resident profile: `http://localhost:3000/my-profile`
- Officer dashboard: `http://localhost:3000/officer`
- Admin panel: `http://localhost:3000/admin`
- Analytics dashboard: `http://localhost:3000/analytics`

### Auth flow checkpoints
- Register a resident account and select ward
- Verify email via OTP
- Login with role context (resident / authority / admin)
- Confirm role-based navigation and redirect behavior

## IPO+S Backend Contract (Always-On Guardrail)

The backend is structured to preserve this module flow at all times:

- **Resident**: input through report submission, validated by JWT/RBAC, stored in `reports`, surfaced via public/resident dashboards.
- **Authority Officer**: case-queue access with role filtering, category-to-authority routing, status updates back into system.
- **Administrator**: user/category/ward/routing configuration and escalation oversight.
- **Automated System**: scheduled deadline monitoring + weekly analytics generation.

### Canonical shared PostgreSQL tables

- `users`
- `reports`
- `authorities`
- `audit_trail`
- `analytics`
- `sessions`

### Module route/controller pairs

- Report Submission → `server/routes/reports.js` / `server/controllers/reportController.js`
- Auth & Role Manager → `server/routes/auth.js` / `server/controllers/authController.js`
- Authority Routing Engine → `server/routes/routing.js` / `server/controllers/routingController.js`
- Officer Login & Case Access → `server/routes/officer.js` / `server/controllers/officerController.js`
- Admin Login & Configuration → `server/routes/admin.js` / `server/controllers/adminController.js`
- Escalation Engine & Audit Logger → `server/routes/escalation.js` / `server/controllers/escalationController.js`
- Automated Triggers → `server/routes/automation.js` + `server/jobs/`
- Analytics & Reporting Engine → `server/routes/analytics.js` / `server/controllers/analyticsController.js`

> After pulling updates, run backend migrations so canonical tables and triggers exist:
>
> - `cd server`
> - `npm run db:migrate`
