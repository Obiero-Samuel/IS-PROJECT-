# IS PROJECT

A modern web application built with a Next.js frontend, Express backend, and PostgreSQL database.

## Directory Structure

- `/client` - Next.js frontend application (TypeScript, App Router, Vanilla CSS)
- `/server` - Express backend application (Node.js, PostgreSQL client connection)

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
