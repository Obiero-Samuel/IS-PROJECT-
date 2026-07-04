/**
 * This file handles the home page with role-based dashboard links.
 */
"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import NavBar from "@/components/NavBar";
import styles from "./page.module.css";
import RequireAuth from "@/components/RequireAuth";
import { authFromSnapshot, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";

export default function Home() {
  // Subscribe to auth store so role-based dashboard cards update immediately.
  const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
  // Parse raw auth storage snapshot into structured object.
  const auth = authFromSnapshot(authRaw);
  // Role determines which dashboard shortcuts are shown.
  const role = auth?.user?.role;

  // Authority and admin users can open officer dashboard.
  const showOfficerDashboard = role === "authority" || role === "admin";
  // Only admins can open admin and analytics dashboards.
  const showAdminDashboards = role === "admin";

  return (
    // Home page is still protected so users are guided through account flows first.
    <RequireAuth>
      <NavBar />
      <main className="main">
        <div className="container stack">
          <section className="card stack">
            <h1 className="title">Civic Issues - Resident Portal</h1>
            <p className="subtitle">
              Report issues, track progress, and support community priorities through upvotes.
            </p>
            <div className="row">
              <Link href="/my-profile" className="primary">Go to my profile</Link>
              <Link href="/reports/new" className="ghost">Submit a report</Link>
            </div>
          </section>

          {/* Resident-focused quick actions. */}
          <section className="grid two">
            <article className="card stack">
              <h2>Resident actions</h2>
              <p className="muted">Create and manage your issue submissions.</p>
              <div className="stack">
                <Link href="/my-reports" className="ghost">My reports</Link>
                <Link href="/reports/new" className="ghost">Submit issue</Link>
              </div>
            </article>

            <article className="card stack">
              <h2>Community visibility</h2>
              <p className="muted">Explore reports on map and support priority issues.</p>
              <div className="stack">
                <Link href="/ward-map" className="ghost">Ward map view</Link>
                <Link href="/reports" className="ghost">Reports + upvote</Link>
              </div>
            </article>
          </section>

          {/* Role-aware dashboard launcher section. */}
          <section className={styles.page}>
            <div className={styles.main}>
              <div className={styles.hero}>
                <p className={styles.badge}>IS PROJECT CONTROL CENTER</p>
                <h1>Dashboards</h1>
                <p>
                  Open a role-specific workspace for officers, administrators, or summary analytics.
                  Enter your JWT token on each page to load protected data.
                </p>
              </div>

              <div className={styles.cards}>
                {showOfficerDashboard && (
                  // Authority/admin shortcut.
                  <Link className={styles.card} href="/officer">
                    <h2>Officer Dashboard</h2>
                    <p>Assigned reports, quick status updates, and resolution notes.</p>
                  </Link>
                )}

                {showAdminDashboards && (
                  // Admin-only shortcut.
                  <Link className={styles.card} href="/admin">
                    <h2>Admin Panel</h2>
                    <p>Manage users, wards, authorities, and categories from one place.</p>
                  </Link>
                )}

                {showAdminDashboards && (
                  // Admin-only analytics shortcut.
                  <Link className={styles.card} href="/analytics">
                    <h2>Analytics Dashboard</h2>
                    <p>Summary-report generation and trend snapshots by authority.</p>
                  </Link>
                )}

                {!showOfficerDashboard && !showAdminDashboards && (
                  // Resident fallback card when elevated dashboards are not available.
                  <article className={styles.card}>
                    <h2>Resident Workspace</h2>
                    <p>
                      Dashboard access is limited to authority officers and administrators.
                      Use My reports, Submit issue, and Ward map for resident actions.
                    </p>
                  </article>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
