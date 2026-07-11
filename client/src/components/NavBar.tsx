/**
 * This file handles the top navigation and role-aware menu links.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { authFromSnapshot, clearAuth, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";
import { logout as logoutSession } from "@/lib/api";

export default function NavBar() {
    // Read auth state from the shared auth store so this navbar reacts to login/logout instantly.
    const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
    // Parse raw snapshot into structured auth payload.
    const auth = authFromSnapshot(authRaw);
    // `user` is null when logged out.
    const user = auth?.user ?? null;
    // Current URL path is used to highlight active links.
    const pathname = usePathname();

    // Return true when the current path matches a link path.
    const isActive = (href: string) => {
        if (!pathname) return false;
        if (href === "/") return pathname === "/";
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    // Build a CSS class string with optional active styling.
    const linkClass = (href: string) => `nav-link${isActive(href) ? " nav-link-active" : ""}`;

    const handleLogout = async () => {
        try {
            // Ask backend to clear HttpOnly session cookie.
            await logoutSession();
        } catch {
            // Ignore network/logout API failures and still clear local snapshot.
        } finally {
            clearAuth();
            window.location.href = "/";
        }
    };

    return (
        <header className="topbar">
            <div className="container topbar-inner">
                <nav className="nav" aria-label="Primary">
                    {/* Home link is always visible. */}
                    <Link href="/" className={linkClass("/")}>Home</Link>
                    {!user ? (
                        <>
                            {/* Public links shown before login. */}
                            <Link href="/login" className={linkClass("/login")}>Login</Link>
                            <Link href="/register" className={linkClass("/register")}>Register</Link>
                        </>
                    ) : (
                        <>
                            {/* Core resident navigation shown to every authenticated user. */}
                            <Link href="/my-profile" className={linkClass("/my-profile")}>My profile</Link>
                            <Link href="/reports" className={linkClass("/reports")}>Reports</Link>
                            <Link href="/reports/new" className={linkClass("/reports/new")}>Submit</Link>
                            <Link href="/my-reports" className={linkClass("/my-reports")}>My reports</Link>
                            <Link href="/ward-map" className={linkClass("/ward-map")}>Ward map</Link>
                            {user.role === "authority" && (
                                // Officer workspace is for authority users.
                                <Link href="/officer" className={linkClass("/officer")}>Officer</Link>
                            )}
                            {user.role === "admin" && (
                                <>
                                    {/* Admin-only pages. */}
                                    <Link href="/admin" className={linkClass("/admin")}>Admin</Link>
                                    <Link href="/analytics" className={linkClass("/analytics")}>Analytics</Link>
                                </>
                            )}
                            {/* Small identity label helps users confirm which account is active. */}
                            <span className="muted nav-user-label">
                                {user.username} · {user.role}
                            </span>
                            {/* Logout clears auth state and exits private pages. */}
                            <button type="button" className="nav-link" onClick={handleLogout}>Logout</button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
