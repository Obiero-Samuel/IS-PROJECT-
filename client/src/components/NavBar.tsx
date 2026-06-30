"use client";

import Link from "next/link";
import { useState } from "react";
import { clearAuth, getAuth } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export default function NavBar() {
    const [user, setUser] = useState<AuthUser | null>(() => getAuth()?.user ?? null);

    const handleLogout = () => {
        clearAuth();
        setUser(null);
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
