"use client";

import { FormEvent } from "react";
import NavBar from "@/components/NavBar";
import styles from "./dashboard-shell.module.css";

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
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveToken();
  };

  return (
    <>
      <NavBar />
      <div className={styles.canvas}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>IS PROJECT</p>
            <h1>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

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

        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}
