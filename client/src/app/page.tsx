/**
 * This file renders the resident-focused home page and quick actions.
 */
"use client";

import Link from "next/link";
import NavBar from "@/components/NavBar";
import styles from "./page.module.css";
import RequireAuth from "@/components/RequireAuth";

export default function Home() {
  return (
    // Home page is still protected so users are guided through account flows first.
    <RequireAuth>
      <NavBar />
      <main className="main">
        <div className={`container ${styles.layout}`}>
          <section className={styles.residentHero}>
            <div className={styles.residentHeroContent}>
              <p className={styles.residentBadge}>RESIDENT PORTAL</p>
              <h1 className={styles.residentTitle}>Make community issues visible and resolved faster.</h1>
              <p className={styles.residentLead}>
                Submit reports with location evidence, track progress updates, and support the most urgent
                issues in your ward.
              </p>
              <div className={styles.residentActions}>
                <Link href="/reports/new" className="primary">Report an issue</Link>
                <Link href="/my-reports" className="ghost">My reports</Link>
                <Link href="/my-profile" className="ghost">My profile</Link>
              </div>
            </div>

            <div className={styles.residentHighlights}>
              <article className={styles.highlightCard}>
                <h2>Clear report tracking</h2>
                <p>Follow every status change from submission to resolution without losing context.</p>
              </article>
              <article className={styles.highlightCard}>
                <h2>Map-based visibility</h2>
                <p>See what is happening around your ward and identify priority hotspots quickly.</p>
              </article>
              <article className={styles.highlightCard}>
                <h2>Community momentum</h2>
                <p>Upvote relevant reports so the highest-impact issues rise to the top.</p>
              </article>
            </div>
          </section>

          {/* Resident-focused quick actions. */}
          <section className={styles.quickGrid}>
            <article className={styles.quickCard}>
              <p className={styles.quickBadge}>Resident actions</p>
              <h2>Manage your submissions</h2>
              <p>Open, review, and continue tracking every issue you reported.</p>
              <div className={styles.quickLinks}>
                <Link href="/my-reports" className={styles.inlineLink}>Open my report history</Link>
                <Link href="/reports/new" className={styles.inlineLink}>Create a new issue report</Link>
              </div>
            </article>

            <article className={styles.quickCard}>
              <p className={styles.quickBadge}>Community visibility</p>
              <h2>Explore what matters nearby</h2>
              <p>Use ward-level insights and open reports to understand neighborhood concerns.</p>
              <div className={styles.quickLinks}>
                <Link href="/ward-map" className={styles.inlineLink}>Open ward map view</Link>
                <Link href="/reports" className={styles.inlineLink}>Browse public reports</Link>
              </div>
            </article>

            <article className={styles.quickCard}>
              <p className={styles.quickBadge}>Account</p>
              <h2>Keep your profile ready</h2>
              <p>Update your details and keep your reporting workspace personalized.</p>
              <div className={styles.quickLinks}>
                <Link href="/my-profile" className={styles.inlineLink}>Go to my profile</Link>
                <Link href="/reports/new" className={styles.inlineLink}>Report another issue</Link>
              </div>
            </article>
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
