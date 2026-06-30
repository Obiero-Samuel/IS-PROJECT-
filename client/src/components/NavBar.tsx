"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { authFromSnapshot, clearAuth, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";

export default function NavBar() {
    const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
    const auth = authFromSnapshot(authRaw);
    const user = auth?.user ?? null;

    const handleLogout = () => {
        clearAuth();
        window.location.href = "/";
    };

    return (
        <header className="topbar">
            <div className="container topbar-inner">
                <Link href="/" className="brand">IS PROJECT</Link>

                <nav className="nav">
                    {!user ? (
                        <>
                            <Link href="/login">Login</Link>
                            <Link href="/register">Register</Link>
                        </>
                    ) : (
                        <>
                            <Link href="/my-profile">My profile</Link>
                            <Link href="/reports">Reports</Link>
                            <Link href="/ward-map">Ward map</Link>
                            <Link href="/reports/new">Submit</Link>
                            <Link href="/my-reports">My reports</Link>
                            <span className="muted nav-user-label">
                                {user.username} · {user.role}
                            </span>
                            <button type="button" onClick={handleLogout}>Logout</button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
