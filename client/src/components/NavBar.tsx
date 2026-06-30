"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { authFromSnapshot, clearAuth, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";

export default function NavBar() {
    const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
    const auth = authFromSnapshot(authRaw);
    const user = auth?.user ?? null;
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (!pathname) return false;
        if (href === "/") return pathname === "/";
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const linkClass = (href: string) => `nav-link${isActive(href) ? " nav-link-active" : ""}`;

    const handleLogout = () => {
        clearAuth();
        window.location.href = "/";
    };

    return (
        <header className="topbar">
            <div className="container topbar-inner">
                <Link href="/" className="brand">IS PROJECT</Link>

                <nav className="nav" aria-label="Primary">
                    <Link href="/" className={linkClass("/")}>Home</Link>
                    {!user ? (
                        <>
                            <Link href="/login" className={linkClass("/login")}>Login</Link>
                            <Link href="/register" className={linkClass("/register")}>Register</Link>
                        </>
                    ) : (
                        <>
                            <Link href="/my-profile" className={linkClass("/my-profile")}>My profile</Link>
                            <Link href="/reports" className={linkClass("/reports")}>Reports</Link>
                            <Link href="/reports/new" className={linkClass("/reports/new")}>Submit</Link>
                            <Link href="/my-reports" className={linkClass("/my-reports")}>My reports</Link>
                            <Link href="/ward-map" className={linkClass("/ward-map")}>Ward map</Link>
                            {(user.role === "authority" || user.role === "admin") && (
                                <Link href="/officer" className={linkClass("/officer")}>Officer</Link>
                            )}
                            {user.role === "admin" && (
                                <>
                                    <Link href="/admin" className={linkClass("/admin")}>Admin</Link>
                                    <Link href="/analytics" className={linkClass("/analytics")}>Analytics</Link>
                                </>
                            )}
                            <span className="muted nav-user-label">
                                {user.username} · {user.role}
                            </span>
                            <button type="button" className="nav-link" onClick={handleLogout}>Logout</button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
