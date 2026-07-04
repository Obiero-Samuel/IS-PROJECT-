/**
 * This file handles the reusable dashboard shell layout and token controls.
 */
"use client";

import { FormEvent } from "react";
import NavBar from "@/components/NavBar";
import styles from "./dashboard-shell.module.css";

// Props define the reusable pieces this shell needs from each dashboard page.
type DashboardShellProps = {
  title: string;
  subtitle: string;
  token: string;
  onTokenChange: (value: string) => void;
  onSaveToken: () => void;
  children: React.ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  token,
  onTokenChange,
  onSaveToken,
  children,
}: DashboardShellProps) {
  // Intercept form submit so we can run save logic without full page reload.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveToken();
  };

  return (
    <>
      {/* Shared top navigation stays consistent across dashboard pages. */}
      <NavBar />
      <div className={styles.canvas}>
        <header className={styles.header}>
          <div>
            {/* Eyebrow text gives visual context for the app section. */}
            <p className={styles.eyebrow}>IS PROJECT</p>
            <h1>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          {/* Token helper card lets users paste/store JWT quickly during testing. */}
          <form className={styles.tokenCard} onSubmit={handleSubmit}>
            <label htmlFor="token-input">JWT Token</label>
            <input
              id="token-input"
              value={token}
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder="Paste login token"
            />
            <button type="submit">Save token</button>
          </form>
        </header>

        {/* Main dashboard content is injected here by each page. */}
        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}
