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
