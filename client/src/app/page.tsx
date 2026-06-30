"use client";

import Link from "next/link";
import NavBar from "@/components/NavBar";
import styles from "./page.module.css";
import RequireAuth from "@/components/RequireAuth";

export default function Home() {
  return (
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

          <section className={styles.page}>
            <div className={styles.main}>
              <div className={styles.hero}>
                <p className={styles.badge}>IS PROJECT CONTROL CENTER</p>
                <h1>Partner B Dashboards</h1>
                <p>
                  Open a role-specific workspace for officers, administrators, or summary analytics.
                  Enter your JWT token on each page to load protected data.
                </p>
              </div>

              <div className={styles.cards}>
                <Link className={styles.card} href="/officer">
                  <h2>Officer Dashboard</h2>
                  <p>Assigned reports, quick status updates, and resolution notes.</p>
                </Link>

                <Link className={styles.card} href="/admin">
                  <h2>Admin Panel</h2>
                  <p>Manage users, wards, authorities, and categories from one place.</p>
                </Link>

                <Link className={styles.card} href="/analytics">
                  <h2>Analytics Dashboard</h2>
                  <p>Summary-report generation and trend snapshots by authority.</p>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
