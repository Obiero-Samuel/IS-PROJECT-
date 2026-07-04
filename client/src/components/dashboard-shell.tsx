/**
 * This file handles the reusable dashboard shell layout.
 */
"use client";

import NavBar from "@/components/NavBar";
import styles from "./dashboard-shell.module.css";

// Props define the reusable pieces this shell needs from each dashboard page.
type DashboardShellProps = {
  title: string;
  subtitle: string;
  showEyebrow?: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  showEyebrow = true,
  children,
}: DashboardShellProps) {
  return (
    <>
      {/* Shared top navigation stays consistent across dashboard pages. */}
      <NavBar />
      <div className={styles.canvas}>
        <header className={styles.header}>
          <div>
            {/* Eyebrow text gives visual context for the app section. */}
            {showEyebrow ? <p className={styles.eyebrow}>IS PROJECT</p> : null}
            <h1>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </header>

        {/* Main dashboard content is injected here by each page. */}
        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}
